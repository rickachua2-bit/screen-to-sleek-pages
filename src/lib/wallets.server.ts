import type { User } from "@supabase/supabase-js";
import { callPaddle } from "./paddle.server";
import type { accountAdmin } from "./merchant-verification.server";
import type { Mode } from "./paddle-policy";
import { STABLECOINS, currencyDef, isNotEnabled, shouldAutoIssueStablecoins, walletCurrencyOf, walletOperation } from "./wallets";

type Db = ReturnType<typeof accountAdmin>;
export interface WalletDetails { id: string; accountNumber: string; accountName: string | null; bankName: string | null; routing: string | null; network: string | null; status: string }

export async function ownedWallets(db: Db, userId: string, mode: Mode) {
  const rows = await db.from("paddle_resources").select("resource_id, operation").eq("user_id", userId).eq("mode", mode).like("operation", "POST /v1/% %");
  const out: Record<string, WalletDetails> = {};
  for (const r of rows.data ?? []) { const c = walletCurrencyOf(r.operation); if (!c) continue; try { out[c] = JSON.parse(r.resource_id) as WalletDetails; } catch { /* legacy row */ } }
  return out;
}

export async function holderName(db: Db, user: User) {
  const sec = await db.from("merchant_security").select("company_name").eq("user_id", user.id).maybeSingle();
  const m = user.user_metadata ?? {};
  return String(sec.data?.company_name ?? m["company_name"] ?? m["full_name"] ?? "Slikpay customer");
}

const s = (d: Record<string, unknown>, ...k: string[]) => { for (const x of k) if (typeof d[x] === "string" && d[x]) return d[x] as string; return null; };

/** Issues one wallet; returns null on success-already-owned. Throws a safe message, NOT_ACTIVE when the currency isn't enabled. */
export async function issueWallet(db: Db, user: User, mode: Mode, code: string) {
  const def = currencyDef(code);
  if (!def || code === "NGN") throw new Error("Unsupported currency.");
  const existing = await ownedWallets(db, user.id, mode);
  if (existing[code]) return existing[code];
  const name = await holderName(db, user);
  const idem = `wallet-${user.id}-${mode}-${code}`;
  let d: Record<string, unknown>;
  try {
    const r = def.kind === "crypto"
      ? await callPaddle(mode, "POST", "/v1/crypto/address", { currency: code, network: def.network, label: name }, idem)
      : await callPaddle(mode, "POST", "/v1/accounts/global", { currency: code, accountName: name, customerEmail: user.email }, idem);
    d = (r.data ?? {}) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    throw new Error(isNotEnabled(msg) ? "NOT_ACTIVE" : msg || "Could not issue this account.");
  }
  const accountNumber = s(d, "address", "accountNumber", "iban");
  if (!accountNumber) throw new Error("NOT_ACTIVE");
  const w: WalletDetails = def.kind === "crypto"
    ? { id: accountNumber, accountNumber, accountName: `${name} (${code})`, bankName: null, routing: null, network: s(d, "network") ?? def.network ?? null, status: "ACTIVE" }
    : { id: s(d, "id") ?? accountNumber, accountNumber, accountName: (s(d, "accountName") ?? name).replace(/\s*\/?\s*paddle.*$/i, ""), bankName: s(d, "bankName")?.replace(/paddle\s*/ig, "") ?? null, routing: s(d, "routingNumber", "sortCode", "bic"), network: null, status: s(d, "status") ?? "ACTIVE" };
  await db.from("paddle_resources").upsert({ user_id: user.id, mode, resource_id: JSON.stringify(w), operation: walletOperation(code) }, { onConflict: "mode,resource_id", ignoreDuplicates: true });
  return w;
}

/** Auto-issue USDT + USDC once a verified account holds its naira account. Never throws. */
export async function ensureStablecoinWallets(db: Db, user: User, mode: Mode, hasNairaAccount: boolean) {
  const owned = Object.keys(await ownedWallets(db, user.id, mode));
  for (const c of shouldAutoIssueStablecoins(mode, hasNairaAccount, owned)) { try { await issueWallet(db, user, mode, c); } catch { /* retried on next load */ } }
}
export { STABLECOINS };

/* ---------- money guard shared by swap / withdraw ---------- */
type Ctx = { db: Db; user: User; mode: Mode; review: string };
export async function authorizeMoney(ctx: Ctx, pin: string | undefined) {
  if (ctx.mode === "live") {
    if (ctx.review !== "approved") throw new Error("Complete verification before moving money.");
    if (!pin) throw new Error("Enter your 4-digit transaction PIN.");
    const sec = await ctx.db.from("merchant_security").select("pin_digest, pin_salt").eq("user_id", ctx.user.id).maybeSingle();
    const { pinDigest } = await import("./merchant-verification.server");
    if (!sec.data || sec.data.pin_digest !== await pinDigest(pin, sec.data.pin_salt)) throw new Error("Incorrect transaction PIN.");
  }
}
export async function guardMoney(ctx: Ctx, currency: string, amount: number, pin: string | undefined, operation: string, reference: string) {
  await authorizeMoney(ctx, pin);
  const r = await ctx.db.rpc("begin_wallet_payment", { p_user: ctx.user.id, p_mode: ctx.mode, p_currency: currency, p_amount: amount, p_operation: operation, p_reference: reference });
  if (r.error) throw new Error("Payment could not be prepared. Check your ledger; the payment reliability setup may be required.");
  if (r.data !== true) throw new Error("Insufficient balance including fees.");
}
export async function settleMoney(ctx: Ctx, reference: string, status: "pending" | "succeeded" | "failed", providerRef: string | null, summary?: object, credit?: { currency: string; amount: number }) {
  const r = await ctx.db.rpc("finish_wallet_payment", { p_user: ctx.user.id, p_mode: ctx.mode, p_reference: reference, p_status: status, p_provider_ref: providerRef, p_summary: summary ?? {}, p_credit_currency: credit?.currency ?? null, p_credit_amount: credit?.amount ?? null });
  if (r.error || r.data !== true) throw new Error("Payment requires reconciliation. Do not send again.");
}

/* ---------- small per-user JSON records (rates, payout accounts) ---------- */
export async function readRecord<T>(db: Db, userId: string, step: string, fallback: T): Promise<T> {
  const r = await db.from("kyc_steps").select("summary").eq("user_id", userId).eq("step", step).maybeSingle();
  try { return r.data?.summary ? (JSON.parse(r.data.summary) as T) : fallback; } catch { return fallback; }
}
export async function writeRecord(db: Db, userId: string, step: string, value: unknown) {
  await db.from("kyc_steps").upsert({ user_id: userId, step, status: "verified", summary: JSON.stringify(value) }, { onConflict: "user_id,step" });
}
