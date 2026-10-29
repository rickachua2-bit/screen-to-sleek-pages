import { payoutStatus } from "./transfer-validation";
// The public service spec has no binding quote or swap recovery contract.
// This gate applies to server execution, not only the bank cash-out screen.
export const SWAP_NOT_READY = "Currency conversion is not active yet. Confirmed quotes and payment recovery are required before funds can be converted.";
export function requireVerifiedSwapContract(): never {
  throw new Error(SWAP_NOT_READY);
}
export function confirmedSwap(value: unknown) {
  const d = value as Record<string, unknown> | null;
  const amount = Number(d?.["toAmount"]);
  const rate = Number(d?.["rate"]);
  if (payoutStatus(value) !== "succeeded" || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return { amount, rate };
}
export const UNCERTAIN_PAYMENT = "Payment status is awaiting confirmation. Check your ledger before retrying; funds remain reserved.";