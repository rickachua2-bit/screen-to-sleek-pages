import { bankingUser, callPaddle } from "./paddle.server";
import { guardMoney, settleMoney } from "./wallets.server";
import { governmentLookup, governmentPayment, governmentBody, governmentAssessment, type GovernmentService } from "./government-payments";
import { payoutStatus } from "./transfer-validation";

export async function lookupGovernment(service: GovernmentService, identifier: string) {
  const input = governmentLookup.parse({ service, identifier });
  const ctx = await bankingUser();
  if (service === "firs" && ctx.role !== "merchant") throw new Error("Federal tax payments require a business account.");
  if (ctx.mode === "live" && ctx.review !== "approved") throw new Error("Complete verification before using live services.");
  const r = await callPaddle(ctx.mode, "POST", `/v1/bills/${service}/validate`, governmentBody(service, input.identifier));
  const assessment = governmentAssessment(service, input.identifier, r.data);
  if (!assessment) throw new Error("Customer details could not be verified. Check the identifier and try again.");
  return { ctx, assessment };
}

export async function executeGovernment(service: GovernmentService, raw: unknown, idempotencyKey: string, pin?: string) {
  const input = governmentPayment.parse(raw);
  const { ctx, assessment } = await lookupGovernment(service, input.identifier);
  if (!assessment.ready || assessment.amount === null || assessment.fee === null || assessment.total === null) throw new Error("The service has not confirmed the assessed amount and fee. Payment is unavailable.");
  if (assessment.amount !== input.expectedAmount || assessment.fee !== input.expectedFee) throw new Error("The assessed amount or fee has changed. Verify the details again before paying.");
  const operation = `POST /v1/bills/${service}/pay`;
  // Block another attempt for the same obligation while an earlier one is unresolved or paid.
  const prior = await ctx.db.from("payment_receipts").select("id").eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("operation", operation).in("status", ["pending", "succeeded"]).contains("summary", { identifier: assessment.identifier }).limit(1);
  if (prior.error) throw new Error("Payment history is unavailable. Check your ledger before paying.");
  if (prior.data?.length) throw new Error("This obligation already has a submitted payment. Check its original receipt before sending again.");
  await guardMoney(ctx, "NGN", assessment.total, pin, operation, idempotencyKey);
  const summary = { identifier: assessment.identifier, customerName: assessment.name, organisation: assessment.organisation, principal: assessment.amount, fee: assessment.fee, assessmentReference: assessment.assessmentReference };
  // Persist identifier before dispatch, including for timed-out requests.
  const saved = await ctx.db.from("payment_receipts").update({ summary }).eq("user_id", ctx.user.id).eq("idempotency_key", idempotencyKey);
  if (saved.error) {
    await settleMoney(ctx, idempotencyKey, "failed", null, summary);
    throw new Error("Payment could not be prepared. No payment was sent.");
  }
  try {
    const r = await callPaddle(ctx.mode, "POST", `/v1/bills/${service}/pay`, { ...governmentBody(service, assessment.identifier), amount: assessment.amount, reference: idempotencyKey }, idempotencyKey);
    const d = r.data && typeof r.data === "object" ? r.data as Record<string, unknown> : {};
    const reference = typeof d["reference"] === "string" ? d["reference"] : null;
    let status = payoutStatus(d);
    // Only an explicit success matching the obligation's amount can settle it.
    if (status === "succeeded" && (Number(d["amount"]) !== assessment.amount || !reference)) status = "pending";
    const receiptNumber = typeof d["receiptNumber"] === "string" ? d["receiptNumber"] : null;
    await settleMoney(ctx, idempotencyKey, status, reference, { ...summary, receiptNumber });
    return { mode: ctx.mode, message: null, resultJson: JSON.stringify({ ...summary, receiptNumber }), receipt: { status, reference, sessionId: null, amount: assessment.amount, currency: "NGN", mode: ctx.mode } };
  } catch { throw new Error("Payment status could not be confirmed. Funds remain reserved. Check the original receipt; do not pay again."); }
}