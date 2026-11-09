import { z } from "zod";

export const payoutBody = z.object({
  amount: z.number().finite().positive().max(1e12).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "Use at most two decimal places."),
  destinationBankCode: z.string().regex(/^\d{3,6}$/),
  destinationAccountNumber: z.string().regex(/^\d{10}$/),
  destinationAccountName: z.string().trim().max(160).optional(),
  narration: z.string().trim().max(160).optional(),
  reference: z.string().max(120).optional(),
});

export function validTransferAmount(value: string) { return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1e12; }

export function exactPayoutFee(value: unknown): number {
  const d = value as Record<string, unknown> | null;
  if (!d || d["rail"] !== "payouts" || (d["currency"] && d["currency"] !== "NGN") || (typeof d["fee"] !== "number" && typeof d["fee"] !== "string") || d["fee"] === "") throw new Error("Transfer fees are unavailable. Try again before sending.");
  const fee = Number(d["fee"]);
  if (!Number.isFinite(fee) || fee < 0) throw new Error("Transfer fees are unavailable. Try again before sending.");
  return fee;
}

export function payoutStatus(value: unknown): "succeeded" | "failed" | "pending" {
  const d = value as Record<string, unknown> | null;
  const status = String(d?.["status"] ?? d?.["transactionStatus"] ?? "").toLowerCase();
  if (["successful", "success", "succeeded", "completed"].includes(status)) return "succeeded";
  if (["failed", "rejected", "declined", "reversed"].includes(status)) return "failed";
  return "pending";
}
/**
 * Slikpay's NGN bank-transfer fee: a flat amount streamed live from the pricing
 * service (feeStructure.transfers.nipDomestic.flatFeeNgn). Callers must supply
 * the live value — a fee is never invented or reused from a hardcoded fallback.
 */
export function slikpayTransferFee(amount: number, flatFeeNgn: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  if (!Number.isFinite(flatFeeNgn) || flatFeeNgn <= 0) throw new Error("Transfer fees are unavailable. Try again before sending.");
  return Math.round(flatFeeNgn * 100) / 100;
}
