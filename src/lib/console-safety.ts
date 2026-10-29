import { payoutStatus } from "./transfer-validation";

/** Presentation only: a successful HTTP request is not payment settlement. */
export function consolePaymentStatus(value: unknown) {
  const d = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const status = payoutStatus(value);
  return d?.["success"] === false && status === "succeeded" ? "pending" : status;
}
export function consoleReceiptMessage(status: string) {
  return status === "succeeded" ? "Payment confirmed" : status === "failed" ? "Payment declined" : "Payment pending — do not send again";
}
export function whiteLabelConsoleText(value: string) {
  return value.replace(/paddle(?:bus|\s*baas)?/gi, "Slikpay").replace(/sterling(?:\s+bank)?/gi, "partner bank");
}