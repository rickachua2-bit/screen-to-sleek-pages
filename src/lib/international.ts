/** Provider routes whose fee, debit-currency and recovery contracts are not yet verified. */
export function isUnverifiedInternationalPayout(path: string) {
  return path === "/v1/payouts/global" || path === "/v1/payouts/tuition";
}

export const INTERNATIONAL_NOT_ACTIVE = "International payments are not active yet. Supported destinations, recipient requirements, fees and payment tracking must be confirmed before money can be sent.";

export function isInternationalReceipt(operation: string) {
  return ["POST /v1/payouts/global", "POST /v1/payouts/tuition"].includes(operation) || /^WITHDRAW (GHS|KES|ZAR|USD|EUR|GBP)$/.test(operation);
}