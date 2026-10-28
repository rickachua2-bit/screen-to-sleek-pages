import { payoutStatus } from "./transfer-validation";
export function confirmedSwap(value: unknown) {
  const d = value as Record<string, unknown> | null;
  const amount = Number(d?.["toAmount"]);
  const rate = Number(d?.["rate"]);
  if (payoutStatus(value) !== "succeeded" || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return { amount, rate };
}
export const UNCERTAIN_PAYMENT = "Payment status is awaiting confirmation. Check your ledger before retrying; funds remain reserved.";