import { expect, it } from "vitest";
import { MAX_WEBHOOK_BYTES, readWebhookBody, redactConsole, webhookAccount, webhookRetry } from "@/lib/developer-console";
it("redacts nested credentials and card secrets before returning console responses", () => {
  expect(redactConsole({ token: "private", card: { cvv: "123", cardNumber: "12345678", status: "ACTIVE" }, items: [{ apiKey: "secret" }] })).toEqual({ token: "[Redacted]", card: { cvv: "[Redacted]", cardNumber: "[Redacted]", status: "ACTIVE" }, items: [{ apiKey: "[Redacted]" }] });
});
it("binds event visibility to an exact ten-digit receiving account", () => {
  expect(webhookAccount({ data: { metadata: { recipientAccountNumber: "0123456789" } } })).toBe("0123456789");
  expect(webhookAccount({ data: { accountNumber: "foreign-owner" } })).toBeNull();
});
it("bounds reconciliation IDs", () => {
  expect(webhookRetry.safeParse({ id: "" }).success).toBe(false);
  expect(webhookRetry.safeParse({ id: "x".repeat(241) }).success).toBe(false);
});
it("limits inbound bodies to 100000 bytes even with multibyte characters", async () => {
  expect(MAX_WEBHOOK_BYTES).toBe(100000);
  expect(await readWebhookBody(new Request("https://slikpay.test", { method: "POST", body: "é".repeat(50001) }))).toBeNull();
  expect(await readWebhookBody(new Request("https://slikpay.test", { method: "POST", body: '{"event":"collection"}' }))).toBe('{"event":"collection"}');
});