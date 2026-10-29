import { payoutStatus } from "./transfer-validation";
// Owner-confirmed contract covers stablecoin sell-to-NGN only.
export const SWAP_NOT_READY = "This currency pair is not active yet. Only USDT or USDC to NGN conversion is supported.";
export function requireVerifiedSwapContract(from?: string, to?: string): void {
  if ((from === "USDT" || from === "USDC") && to === "NGN") return;
  throw new Error(SWAP_NOT_READY);
}
export function confirmedSwap(value: unknown) {
  const d = value as Record<string, unknown> | null;
  const amount = Number(d?.["toAmount"]);
  const rate = Number(d?.["rate"]);
  if (d?.["success"] === false || payoutStatus(value) !== "succeeded" || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return { amount, rate };
}
export const UNCERTAIN_PAYMENT = "Payment status is awaiting confirmation. Check your ledger before retrying; funds remain reserved.";