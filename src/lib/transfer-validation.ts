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
/** Slikpay's NGN bank-transfer fee: 1% of the amount, never more than ₦80. */
export const TRANSFER_FEE_RATE = 0.01;
export const TRANSFER_FEE_CAP = 80;
export function slikpayTransferFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  return Math.min(Math.round(amount * TRANSFER_FEE_RATE * 100) / 100, TRANSFER_FEE_CAP);
}
