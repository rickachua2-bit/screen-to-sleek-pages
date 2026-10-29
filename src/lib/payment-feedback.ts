/** Presentation-only messages. Never echo payment payloads or infer settlement from an error. */
export function paymentFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  // Unknown/dispatch outcomes take precedence over incidental words in the error.
  if (/timeout|timed out|network|fetch|awaiting|unavailable|not confirmed|could not be confirmed|remain reserved|reconciliation/i.test(message)) {
    return "uncertain";
  }
  if (/insufficient (balance|funds)|not enough (balance|funds)/i.test(message)) return "insufficient_funds";
  if (/incorrect transaction pin|invalid (transaction )?pin/i.test(message)) return "incorrect_pin";
  if (/4-digit.*pin|valid amount.*pin/i.test(message)) return "missing_pin";
  if (/complete verification|not approved|account not active/i.test(message)) return "verification_required";
  if (/already submitted|different payment|different.*reference/i.test(message)) return "used_reference";
  if (/recipient|account details|account name|settlement account/i.test(message)) return "invalid_recipient";
  if (/declined|rejected|withdrawal failed|transfer failed/i.test(message)) return "declined";
  if (/valid amount/i.test(message)) return "invalid_amount";
  return "uncertain";
}

export function paymentFeedback(error: unknown, action: "conversion" | "withdrawal" | "transfer" = "withdrawal"): string {
  const label = action === "conversion" ? "Conversion" : action === "transfer" ? "Transfer" : "Withdrawal";
  const messages = {
    uncertain: `${label} status is not confirmed. Check your ledger before trying again. Reserved funds may remain unavailable; do not submit another payment.`,
    insufficient_funds: "Insufficient funds. Your available balance must cover the amount and all applicable fees. Add funds or reduce the amount.",
    incorrect_pin: "Incorrect transaction PIN. Check your 4-digit PIN and try again.",
    missing_pin: "Enter a valid amount and your 4-digit transaction PIN.",
    verification_required: "Your account is not ready for withdrawals. Complete verification and check that live banking is active.",
    used_reference: "This payment reference has already been used. Check the original payment in your ledger before sending again.",
    invalid_recipient: "Recipient account could not be verified. Check the bank and account number, then confirm the recipient name.",
    declined: `${label} failed. The payment was declined. Check your ledger for the final status and balance before trying again.`,
    invalid_amount: "Enter a valid amount greater than zero.",
  };
  return messages[paymentFailureReason(error)];
}