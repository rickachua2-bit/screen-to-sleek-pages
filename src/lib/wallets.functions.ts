import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CURRENCIES, NOT_ACTIVE, type WalletStatus } from "./wallets";

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
