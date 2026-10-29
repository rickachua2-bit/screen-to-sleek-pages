/** Presentation-only messages. Never echo payment payloads or infer settlement from an error. */
export function paymentFeedback(error: unknown, action: "conversion" | "withdrawal" | "transfer" = "withdrawal"): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  // Unknown/dispatch outcomes take precedence over incidental words in the error.
  if (/timeout|timed out|network|fetch|awaiting|unavailable|not confirmed|could not be confirmed|remain reserved|reconciliation/i.test(message)) {
    return `${action === "conversion" ? "Conversion" : action === "transfer" ? "Transfer" : "Withdrawal"} status is not confirmed. Check your ledger before trying again. Reserved funds may remain unavailable; do not submit another payment.`;
  }
  if (/insufficient (balance|funds)|not enough (balance|funds)/i.test(message)) return "Insufficient funds. Your available balance must cover the amount and all applicable fees. Add funds or reduce the amount.";
  if (/incorrect transaction pin|invalid (transaction )?pin/i.test(message)) return "Incorrect transaction PIN. Check your 4-digit PIN and try again.";
  if (/4-digit.*pin|valid amount.*pin/i.test(message)) return "Enter a valid amount and your 4-digit transaction PIN.";
  if (/complete verification|not approved|account not active/i.test(message)) return "Your account is not ready for withdrawals. Complete verification and check that live banking is active.";
  if (/already submitted|different payment|different.*reference/i.test(message)) return "This payment reference has already been used. Check the original payment in your ledger before sending again.";
  if (/recipient|account details|account name|settlement account/i.test(message)) return "Recipient account could not be verified. Check the bank and account number, then confirm the recipient name.";
  if (/declined|rejected|withdrawal failed|transfer failed/i.test(message)) return `${action === "conversion" ? "Conversion" : action === "transfer" ? "Transfer" : "Withdrawal"} failed. The payment was declined. Check your ledger for the final status and balance before trying again.`;
  if (/valid amount/i.test(message)) return "Enter a valid amount greater than zero.";
  return `${action === "conversion" ? "Conversion" : action === "transfer" ? "Transfer" : "Withdrawal"} could not be confirmed. Check your ledger before trying again; do not submit another payment while its status is unclear.`;
}