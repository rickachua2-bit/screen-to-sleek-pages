import { bankingUser, callPaddle } from "./paddle.server";
import { authorizeMoney, guardMoney, settleMoney } from "./wallets.server";
import { confirmedSwap, requireVerifiedSwapContract, UNCERTAIN_PAYMENT } from "./wallet-safety";

type Context = Awaited<ReturnType<typeof bankingUser>>;
export interface SwapRequest { from: string; to: string; amount: number; pin?: string; idempotencyKey: string }
/** Replay uses the original owner/mode/pair/amount and reservation, never a fresh debit. */
export async function executeVerifiedSwap(ctx: Context, data: SwapRequest) {
  requireVerifiedSwapContract(data.from, data.to);
  if (!Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 1e12) throw new Error("Enter a valid amount.");
  await authorizeMoney(ctx, data.pin);
  const operation = `SWAP ${data.from}->${data.to}`;
  const read = async () => {
    const r = await ctx.db.from("payment_receipts").select("operation,currency,amount,status,summary,provider_reference")
      .eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (r.error) throw new Error("Could not check the original conversion. No new conversion was submitted.");
    if (r.data && (r.data.operation !== operation || r.data.currency !== data.from || Number(r.data.amount) !== data.amount)) throw new Error("This reference belongs to a different payment.");
    return r.data;
  };
  let receipt = await read();
  if (!receipt) {
    try { await guardMoney(ctx, data.from, data.amount, data.pin, operation, data.idempotencyKey); }
    catch (error) {
      // Concurrent same-key calls may race at the atomic insertion. Only an exact owned receipt can resume.
      receipt = await read();
      if (!receipt) throw error;
    }
  }
  const resultFromSummary = (summary: Record<string, unknown>, reference: string | null) => {
    const confirmed = confirmedSwap({ status: "COMPLETED", toAmount: summary["toAmount"], rate: summary["rate"] });
    const fee = Number(summary["fee"]);
    if (!confirmed || summary["to"] !== "NGN" || !reference || !Number.isFinite(fee) || fee < 0) throw new Error(UNCERTAIN_PAYMENT);
    return { reference, fromAmount: data.amount, toAmount: confirmed.amount, credited: confirmed.amount, rate: confirmed.rate, fee, feeCurrency: "NGN" };
  };
  if (receipt?.status === "failed") throw new Error("This conversion was declined. Check your ledger.");
  if (receipt?.status === "succeeded") return resultFromSummary((receipt.summary ?? {}) as Record<string, unknown>, receipt.provider_reference);
  try {
    const r = await callPaddle(ctx.mode, "POST", "/v1/crypto/swap", { fromCurrency: data.from, toCurrency: data.to, amount: data.amount }, data.idempotencyKey);
    const d = (r.data ?? {}) as Record<string, unknown>;
    const confirmed = confirmedSwap(d);
    const fee = Number(d["platformFee"]);
    const reference = typeof d["reference"] === "string" && d["reference"].trim() ? d["reference"] : null;
    if (!confirmed || !reference || d["platformFee"] == null || !Number.isFinite(fee) || fee < 0) throw new Error(UNCERTAIN_PAYMENT);
    // toAmount is the final credit, already net of platformFee; never subtract it again.
    const credited = confirmed.amount;
    await settleMoney(ctx, data.idempotencyKey, "succeeded", reference, { to: "NGN", toAmount: credited, rate: confirmed.rate, fee, feeCurrency: "NGN" }, { currency: "NGN", amount: credited });
    const settled = await read();
    if (settled?.status !== "succeeded") throw new Error(UNCERTAIN_PAYMENT);
    return resultFromSummary((settled.summary ?? {}) as Record<string, unknown>, settled.provider_reference);
  } catch { throw new Error(UNCERTAIN_PAYMENT); }
}