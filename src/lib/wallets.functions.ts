import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CURRENCIES, NOT_ACTIVE, type WalletStatus } from "./wallets";
import { UNCERTAIN_PAYMENT } from "./wallet-safety";
import { payoutStatus, slikpayTransferFee } from "./transfer-validation";
import { INTERNATIONAL_NOT_ACTIVE } from "./international";

export interface WalletView { code: string; status: WalletStatus; balance: number; accountNumber: string | null; accountName: string | null; bankName: string | null; routing: string | null; network: string | null; note: string | null }

export const getWallets = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { ownedWallets, ensureStablecoinWallets } = await import("./wallets.server");
  const { db, user, mode } = await bankingUser();
  const nuban = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", "POST /v1/accounts/virtual").limit(1).maybeSingle();
  await ensureStablecoinWallets(db, user, mode, Boolean(nuban.data));
  const [owned, ledger, blocked] = await Promise.all([
    ownedWallets(db, user.id, mode),
    db.from("ledger_entries").select("amount, currency").eq("user_id", user.id).eq("mode", mode).in("status", ["held", "posted"]),
    db.from("kyc_steps").select("summary").eq("user_id", user.id).eq("step", `wallet_blocked_${mode}`).maybeSingle(),
  ]);
  const notActive = new Set((blocked.data?.summary ?? "").split(",").filter(Boolean));
  const bal: Record<string, number> = {};
  for (const e of ledger.data ?? []) bal[e.currency] = (bal[e.currency] ?? 0) + Number(e.amount);
  const wallets: WalletView[] = CURRENCIES.filter((c) => c.code !== "NGN").map((c) => { const w = owned[c.code]; return { code: c.code, status: w ? "active" : notActive.has(c.code) ? "not_active" : "not_issued", balance: bal[c.code] ?? 0, accountNumber: w?.accountNumber ?? null, accountName: w?.accountName ?? null, bankName: w?.bankName ?? null, routing: w?.routing ?? null, network: w?.network ?? null, note: !w && notActive.has(c.code) ? NOT_ACTIVE : null }; });
  return { mode, wallets };
});

export const issueCurrencyWallet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ currency: z.enum(["GHS", "KES", "ZAR", "USD", "EUR", "GBP", "USDT", "USDC"]) }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { issueWallet } = await import("./wallets.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before issuing accounts.");
    try { await issueWallet(db, user, mode, data.currency); return { ok: true as const, note: null }; }
    catch (e) {
      if (e instanceof Error && e.message === "NOT_ACTIVE") {
        const step = `wallet_blocked_${mode}`;
        const cur = await db.from("kyc_steps").select("summary").eq("user_id", user.id).eq("step", step).maybeSingle();
        const set = new Set([...(cur.data?.summary ?? "").split(",").filter(Boolean), data.currency]);
        await db.from("kyc_steps").upsert({ user_id: user.id, step, status: "failed", summary: [...set].join(",") }, { onConflict: "user_id,step" });
        return { ok: false as const, note: NOT_ACTIVE };
      }
      throw e;
    }
  });

const money = z.object({ amount: z.number().positive().max(1e12), pin: z.string().regex(/^\d{4}$/).optional() });
const CODES = ["NGN", "GHS", "KES", "ZAR", "USD", "EUR", "GBP", "USDT", "USDC"] as const;
export interface PayoutAccount { accountNumber: string; accountName: string; bankName: string; bankCode?: string | undefined }

export const getWalletExtras = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { readRecord, holderName } = await import("./wallets.server");
  const { db, user, mode } = await bankingUser();
  const [rates, payouts, settlement, receipts, ledger, name] = await Promise.all([
    readRecord<Record<string, number>>(db, user.id, `fx_rates_${mode}`, {}),
    readRecord<Record<string, PayoutAccount>>(db, user.id, `payout_accounts_${mode}`, {}),
    readRecord<PayoutAccount | null>(db, user.id, "settlement_account", null),
    db.from("payment_receipts").select("id, idempotency_key, operation, status, amount, currency, provider_reference, summary, created_at").eq("user_id", user.id).eq("mode", mode).order("created_at", { ascending: false }).limit(100),
    db.from("ledger_entries").select("amount, currency, status, operation, reference, created_at").eq("user_id", user.id).eq("mode", mode).order("created_at", { ascending: false }).limit(200),
    holderName(db, user),
  ]);
  const ngn = (ledger.data ?? []).filter((e) => e.currency === "NGN" && e.status !== "released").reduce((a, e) => a + Number(e.amount), 0);
  const pending: Record<string, number> = {};
  for (const e of ledger.data ?? []) if (e.status === "held") pending[e.currency] = (pending[e.currency] ?? 0) + Math.abs(Number(e.amount));
  return { mode, holder: name, rates, payouts: { ...payouts, ...(settlement ? { NGN: settlement } : {}) }, ngnBalance: ngn, pending, receipts: receipts.data ?? [], ledger: (ledger.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) };
});

export const swapCurrency = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => money.extend({ from: z.enum(CODES), to: z.enum(CODES), idempotencyKey: z.string().uuid() }).refine((x) => x.from !== x.to, "Pick two different currencies.").parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { executeVerifiedSwap } = await import("./swap-execution.server");
    const ctx = await bankingUser();
    return executeVerifiedSwap(ctx, data);
  });

export const savePayoutAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ currency: z.enum(["GHS", "KES", "ZAR", "USD", "EUR", "GBP"]), accountNumber: z.string().trim().min(4).max(40), accountName: z.string().trim().min(2).max(120), bankName: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { readRecord, writeRecord, holderName } = await import("./wallets.server");
    const { isOwnPayoutAccount } = await import("./wallet-actions");
    const { db, user, mode } = await bankingUser();
    if (!isOwnPayoutAccount(await holderName(db, user), data.accountName)) throw new Error("Withdrawals can only go to an account in your verified business name.");
    const key = `payout_accounts_${mode}`;
    const cur = await readRecord<Record<string, PayoutAccount>>(db, user.id, key, {});
    await writeRecord(db, user.id, key, { ...cur, [data.currency]: { accountNumber: data.accountNumber, accountName: data.accountName, bankName: data.bankName } });
    return { ok: true };
  });

export const withdrawFunds = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => money.extend({ currency: z.enum(["NGN", "GHS", "KES", "ZAR", "USD", "EUR", "GBP"]), idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { guardMoney, settleMoney, readRecord, holderName } = await import("./wallets.server");
    const { isOwnPayoutAccount } = await import("./wallet-actions");
    const { currencyDef } = await import("./wallets");
    const ctx = await bankingUser();
    if (data.currency !== "NGN") throw new Error(INTERNATIONAL_NOT_ACTIVE);
    const acct = data.currency === "NGN"
      ? await readRecord<PayoutAccount | null>(ctx.db, ctx.user.id, "settlement_account", null)
      : (await readRecord<Record<string, PayoutAccount>>(ctx.db, ctx.user.id, `payout_accounts_${ctx.mode}`, {}))[data.currency] ?? null;
    if (!acct) throw new Error(data.currency === "NGN" ? "Verify your settlement account in KYB first." : "Add your payout account for this currency first.");
    if (!isOwnPayoutAccount(await holderName(ctx.db, ctx.user), acct.accountName)) throw new Error("Payout account is not in your verified name.");
    const op = `WITHDRAW ${data.currency}`;
    const transferFee = data.currency === "NGN" ? slikpayTransferFee(data.amount) : 0;
    if (data.currency === "NGN") {
      const resolved = await callPaddle(ctx.mode, "POST", "/v1/accounts/resolve", { accountNumber: acct.accountNumber, bankCode: acct.bankCode });
      const name = (resolved.data as Record<string, unknown> | null)?.["accountName"];
      if (typeof name !== "string" || !isOwnPayoutAccount(await holderName(ctx.db, ctx.user), name)) throw new Error("The bank did not confirm your settlement account name.");
      acct.accountName = name;
    }
    await guardMoney(ctx, data.currency, data.amount + transferFee, data.pin, op, data.idempotencyKey);
    try {
      const r = data.currency === "NGN"
        ? await callPaddle(ctx.mode, "POST", "/v1/payouts/transfer", { amount: data.amount, destinationBankCode: acct.bankCode, destinationAccountNumber: acct.accountNumber, destinationAccountName: acct.accountName, narration: "Slikpay withdrawal", reference: data.idempotencyKey }, data.idempotencyKey)
        : await callPaddle(ctx.mode, "POST", "/v1/payouts/global", { amount: data.amount, currency: data.currency, destinationCurrency: data.currency, beneficiary: { accountNumber: acct.accountNumber, accountName: acct.accountName, bankName: acct.bankName, country: currencyDef(data.currency)?.country } }, data.idempotencyKey);
      const d = (r.data ?? {}) as Record<string, unknown>;
      const reference = [d["reference"], d["transactionReference"], d["id"]].find((v) => typeof v === "string") as string | undefined;
      const { providerFee } = await import("./ledger-history");
      const fee = data.currency === "NGN" ? transferFee : providerFee(d);
      const status = payoutStatus(d);
      await settleMoney(ctx, data.idempotencyKey, status, reference ?? null, { principal: data.amount, recipient: acct.accountName, to: acct.accountNumber, bank: acct.bankName, ...(fee !== undefined ? { fee } : {}) });
      if (status === "failed") throw new Error("The bank declined this withdrawal.");
      if (status === "pending") throw new Error(UNCERTAIN_PAYMENT);
      return { reference: reference ?? null, to: `${acct.accountName} · ${acct.bankName} · ${acct.accountNumber}` };
    } catch (e) { if (e instanceof Error && e.message === "The bank declined this withdrawal.") throw e; throw new Error(UNCERTAIN_PAYMENT); }
  });
