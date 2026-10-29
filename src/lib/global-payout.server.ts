import { callPaddle } from "./paddle.server";
import { guardMoney, settleMoney } from "./wallets.server";
import { parseFxRates, type FxRates } from "./pricing";
import type { Mode } from "./paddle-policy";
import { QUOTE_CHANGED, quoteStillMatches, beneficiaryFor, corridorFor, globalWalletFee, minimumTargetAmount, nairaCrossBorderFee, safeDeclineReason } from "./international";
import { payoutStatus } from "./transfer-validation";
import { UNCERTAIN_PAYMENT } from "./wallet-safety";

type MoneyCtx = Parameters<typeof guardMoney>[0];
export type GlobalCtx = MoneyCtx & { mode: Mode };

export const GLOBAL_OPERATION = "POST /v1/payouts/global";
const AWAITING_NOTE = "Payout dispatched; awaiting international network confirmation";

export interface GlobalQuoteInput { sourceCurrency: string; country: string; accountName: string; amount: number; beneficiary: Record<string, string> }
export interface GlobalQuote {
  country: string; corridorLabel: string; sourceCurrency: string; target: string;
  rate: number | null; recipientGets: number; principal: number; fee: number; feeCurrency: string;
  totalDebit: number; minimum: number; rule: string;
}

export async function liveFxRates(mode: Mode): Promise<FxRates> {
  const r = await callPaddle(mode, "GET", "/v1/fx/rates");
  const d = (r.data ?? {}) as Record<string, unknown>;
  const raw = (d["rates"] && typeof d["rates"] === "object" ? d["rates"] : d) as Record<string, unknown>;
  const fx = parseFxRates(raw);
  if (Object.keys(fx.bid).length <= 1) throw new Error("Exchange rates are unavailable right now. Try again shortly.");
  return fx;
}

/** Validates the request against the confirmed corridors and returns the exact fee-inclusive debit, at live rates. */
export async function buildGlobalQuote(ctx: GlobalCtx, input: GlobalQuoteInput) {
  const corridor = corridorFor(input.country);
  if (!corridor) throw new Error("Choose a supported destination country.");
  const source = input.sourceCurrency;
  if (source !== "NGN" && source !== corridor.target) throw new Error("Wallet payments must match the destination currency. Use your naira wallet to convert instead.");
  const beneficiary = beneficiaryFor(corridor, input.accountName, input.beneficiary);
  const fx = await liveFxRates(ctx.mode);
  const minimum = minimumTargetAmount(source, corridor.target, fx);
  if (!minimum) throw new Error("Exchange rates for this destination are unavailable right now.");
  if (!Number.isFinite(input.amount) || input.amount < minimum) throw new Error(`The minimum for ${corridor.label} is about ${minimum.toLocaleString()} ${corridor.target}.`);
  if (source === "NGN") {
    const rate = fx.ask[corridor.target];
    if (!rate) throw new Error("Exchange rates for this destination are unavailable right now.");
    const principal = Math.round(input.amount * rate * 100) / 100;
    const fee = nairaCrossBorderFee(principal);
    return { corridor, beneficiary, quote: { country: corridor.id, corridorLabel: corridor.label, sourceCurrency: "NGN", target: corridor.target, rate, recipientGets: input.amount, principal, fee, feeCurrency: "NGN", totalDebit: Math.round((principal + fee) * 100) / 100, minimum, rule: "0.5% of the naira amount, minimum ₦5,000" } };
  }
  const fee = globalWalletFee(input.amount);
  return { corridor, beneficiary, quote: { country: corridor.id, corridorLabel: corridor.label, sourceCurrency: source, target: corridor.target, rate: null, recipientGets: input.amount, principal: input.amount, fee, feeCurrency: source, totalDebit: Math.round((input.amount + fee) * 100) / 100, minimum, rule: "0.5% of the amount, minimum 5, capped at 25 (wallet currency)" } };
}

export interface GlobalPayoutInput extends GlobalQuoteInput { pin?: string | undefined; idempotencyKey: string; confirmedTotal?: number | undefined; purpose?: string | undefined }
export type GlobalPayoutResult =
  | { status: "succeeded"; reference: string; trackingReference: string | null; recipientGets: number; fee: number; totalDebit: number; destinationCurrency: string }
  | { status: "failed"; reason: string }
  | { status: "pending"; note: string };

const str = (d: Record<string, unknown>, key: string) => (typeof d[key] === "string" && d[key] ? (d[key] as string) : null);
const providerReference = (d: Record<string, unknown>) => str(d, "reference") ?? str(d, "transactionReference") ?? str(d, "trackingReference");
const close = (a: number, b: number) => Math.abs(a - b) <= 0.02;

/** Executes one global payout: exact reservation, one dispatch, timeout retains funds as pending. */
export async function executeGlobalPayout(ctx: GlobalCtx, input: GlobalPayoutInput): Promise<GlobalPayoutResult> {
  const { corridor, beneficiary, quote } = await buildGlobalQuote(ctx, input);
  const readReceipt = async () => {
    const r = await ctx.db.from("payment_receipts").select("operation,currency,amount,status,summary,provider_reference")
      .eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (r.error) throw new Error("Could not check the original payment. No new payment was submitted.");
    if (r.data && (r.data.operation !== GLOBAL_OPERATION || r.data.currency !== quote.feeCurrency || !close(Number(r.data.amount), quote.totalDebit))) {
      throw new Error("This reference belongs to a different payment.");
    }
    return r.data as { status: string; summary: Record<string, unknown> | null; provider_reference: string | null } | null;
  };
  let receipt = await readReceipt();
  // A brand-new payment must debit exactly what the user confirmed; resumed payments are bound by their receipt instead.
  if (!receipt && input.confirmedTotal !== undefined && !quoteStillMatches(input.confirmedTotal, quote.totalDebit)) throw new Error(QUOTE_CHANGED);
  if (receipt?.status === "failed") throw new Error("This payment was declined earlier. Check your ledger.");
  if (receipt?.status === "succeeded") {
    const s = receipt.summary ?? {};
    return { status: "succeeded", reference: receipt.provider_reference ?? "", trackingReference: str(s, "trackingReference"), recipientGets: quote.recipientGets, fee: Number(s["fee"]) || quote.fee, totalDebit: Number(s["totalDebit"]) || quote.totalDebit, destinationCurrency: corridor.target };
  }
  if (!receipt) {
    try { await guardMoney(ctx, quote.feeCurrency, quote.totalDebit, input.pin, GLOBAL_OPERATION, input.idempotencyKey); }
    catch (error) {
      // Concurrent same-key calls may race at the atomic insertion; only an exact owned receipt can resume.
      receipt = await readReceipt();
      if (!receipt) throw error;
    }
  }
  if (receipt?.status === "pending") {
    const outcome = await checkGlobalPayoutStatus(ctx, input.idempotencyKey);
    if (outcome.status !== "pending") return outcome;
    return { status: "pending", note: "This payment is already awaiting confirmation. Funds remain reserved; do not send again." };
  }
  const summary = { principal: quote.principal, fee: quote.fee, feeCurrency: quote.feeCurrency, destinationCurrency: corridor.target, recipient: beneficiary.accountName, totalDebit: quote.totalDebit, recipientGets: quote.recipientGets, country: corridor.id, beneficiary, purpose: input.purpose ?? null };
  let settled = false;
  try {
    const r = await callPaddle(ctx.mode, "POST", "/v1/payouts/global", {
      amount: quote.recipientGets, currency: quote.feeCurrency, destinationCurrency: corridor.target, beneficiary,
    }, input.idempotencyKey);
    const d = (r.data ?? {}) as Record<string, unknown>;
    const status = payoutStatus(d);
    const reference = providerReference(d);
    if (status === "failed") {
      const reason = safeDeclineReason(d["failureReason"]);
      settled = true;
      await settleMoney(ctx, input.idempotencyKey, "failed", reference, { ...summary, error: reason });
      throw new Error("The clearing network declined this payment. Reserved funds have been returned.");
    }
    const debit = Number(d["debitAmount"]);
    const fee = Number(d["fee"]);
    const feeCurrency = str(d, "feeCurrency");
    if (status === "succeeded") {
      if (!reference || !Number.isFinite(debit) || !Number.isFinite(fee) || fee < 0 || feeCurrency !== quote.feeCurrency || !close(debit, quote.totalDebit)) {
        settled = true;
        await settleMoney(ctx, input.idempotencyKey, "pending", reference, { ...summary, note: "Network confirmed success with different debit totals; awaiting reconciliation" });
        throw new Error(UNCERTAIN_PAYMENT);
      }
      settled = true;
      await settleMoney(ctx, input.idempotencyKey, "succeeded", reference, { ...summary, trackingReference: str(d, "trackingReference") });
      return { status: "succeeded", reference, trackingReference: str(d, "trackingReference"), recipientGets: quote.recipientGets, fee, totalDebit: debit, destinationCurrency: corridor.target };
    }
    settled = true;
    await settleMoney(ctx, input.idempotencyKey, "pending", reference, { ...summary, note: AWAITING_NOTE });
    throw new Error(UNCERTAIN_PAYMENT);
  } catch (e) {
    if (settled) throw e;
    // Timeout or unknown dispatch: retain the reservation as pending per the owner's recovery contract. Never double-debit.
    try { await settleMoney(ctx, input.idempotencyKey, "pending", null, { ...summary, note: AWAITING_NOTE }); } catch { /* reconciliation will resolve */ }
    throw new Error(UNCERTAIN_PAYMENT);
  }
}

/** Recovery contract: query the original payment key; settle only on confirmed success or terminal decline. */
export async function checkGlobalPayoutStatus(ctx: GlobalCtx, idempotencyKey: string): Promise<GlobalPayoutResult> {
  const r = await ctx.db.from("payment_receipts").select("id,operation,status,summary,provider_reference")
    .eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (r.error || !r.data || r.data.operation !== GLOBAL_OPERATION) throw new Error("This payment could not be found in your ledger.");
  const receipt = r.data as { status: string; summary: Record<string, unknown> | null; provider_reference: string | null };
  if (receipt.status === "succeeded") return { status: "succeeded", reference: receipt.provider_reference ?? "", trackingReference: str(receipt.summary ?? {}, "trackingReference"), recipientGets: 0, fee: 0, totalDebit: 0, destinationCurrency: str(receipt.summary ?? {}, "destinationCurrency") ?? "" };
  if (receipt.status === "failed") return { status: "failed", reason: safeDeclineReason((receipt.summary ?? {})["error"]) };
  let d: Record<string, unknown>;
  try {
    const res = await callPaddle(ctx.mode, "GET", `/v1/payouts/${idempotencyKey}`);
    d = (res.data ?? {}) as Record<string, unknown>;
  } catch {
    // Unknown or not-found status never releases funds.
    return { status: "pending", note: "The payment network has not confirmed this payment yet. Funds remain reserved; do not send again." };
  }
  const outcome = payoutStatus(d);
  const reference = providerReference(d);
  if (outcome === "failed") {
    const reason = safeDeclineReason(d["failureReason"]);
    await settleMoney(ctx, idempotencyKey, "failed", reference, { ...(receipt.summary ?? {}), error: reason });
    return { status: "failed", reason };
  }
  if (outcome === "succeeded") {
    const s = receipt.summary ?? {};
    const reserved = Number(s["principal"]) + Number(s["fee"]);
    const debit = Number(d["debitAmount"]);
    const fee = Number(d["fee"]);
    if (reference && Number.isFinite(debit) && Number.isFinite(fee) && Number.isFinite(reserved) && close(debit, reserved)) {
      await settleMoney(ctx, idempotencyKey, "succeeded", reference, { ...s, trackingReference: str(d, "trackingReference"), totalDebit: debit });
      return { status: "succeeded", reference, trackingReference: str(d, "trackingReference"), recipientGets: Number(s["recipientGets"]) || 0, fee, totalDebit: debit, destinationCurrency: String(s["destinationCurrency"] ?? "") };
    }
    return { status: "pending", note: "The network reported success with different totals. Funds stay reserved for reconciliation." };
  }
  return { status: "pending", note: "Still awaiting confirmation. Funds remain reserved; do not send again." };
}

/** Reconciles up to ten pending global payouts against the provider's status endpoint. */
export async function reconcileGlobalPayouts(ctx: GlobalCtx) {
  const r = await ctx.db.from("payment_receipts").select("idempotency_key,operation,status")
    .eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("operation", GLOBAL_OPERATION)
    .in("status", ["pending", "held"]).order("created_at", { ascending: false }).limit(10);
  if (r.error) throw new Error("Pending payments could not be checked.");
  const results: Array<{ idempotencyKey: string } & Partial<GlobalPayoutResult>> = [];
  for (const row of r.data ?? []) {
    try { results.push({ idempotencyKey: row.idempotency_key, ...(await checkGlobalPayoutStatus(ctx, row.idempotency_key)) }); }
    catch { results.push({ idempotencyKey: row.idempotency_key, status: "pending" }); }
  }
  return { checked: results.length, results };
}
