import { describe, expect, it } from "vitest";
import { fromReceipt, fromTransaction, providerFee } from "@/lib/ledger-history";

describe("ledger history", () => {
  it("does not charge the fee twice when the reservation includes it", () => {
    const t = fromReceipt({ id: "atomic", created_at: "2026-10-29", operation: "POST /v1/payouts/transfer", status: "succeeded", amount: 101, currency: "NGN", provider_reference: "provider", session_id: null, summary: { principal: 100, fee: 1, nipSessionId: "bank-session" } });
    expect(t?.amount).toBe(100);
    expect(t?.net).toBe(101);
    expect(t?.nipSessionId).toBe("bank-session");
  });
  it("reads the provider's fee and never invents one", () => {
    expect(providerFee({ fee: "10.75" })).toBe(10.75);
    expect(providerFee({ metadata: { charges: 25 } })).toBe(25);
    expect(providerFee({ amount: 5000 })).toBeUndefined();
  });
  it("credit net = amount minus fee, keeps currency", () => {
    const t = fromTransaction({ id: "1", created_at: "2026-01-01", reference: "col:x", channel: "NIP", customer: "Ada", amount: 1000, direction: "credit", status: "Successful", metadata: { fee: 10, currency: "GHS" } });
    expect(t.net).toBe(990);
    expect(t.currency).toBe("GHS");
  });
  it("credit without a recorded fee has no fee", () => {
    const t = fromTransaction({ id: "1", created_at: "2026-01-01", reference: "r", channel: "NIP", customer: "Ada", amount: 1000, direction: "credit", status: "Successful", metadata: {} });
    expect(t.fee).toBeUndefined();
  });
  it("withdrawal receipt is a debit with total = amount + fee", () => {
    const t = fromReceipt({ id: "abc", created_at: "2026-01-01", operation: "WITHDRAW USD", status: "succeeded", amount: 100, currency: "USD", provider_reference: "P1", session_id: null, summary: { fee: 2, to: "0123" } })!;
    expect(t.direction).toBe("debit");
    expect(t.currency).toBe("USD");
    expect(t.net).toBe(102);
    expect(t.status).toBe("Successful");
  });
  it("swap fee in target currency is not added to source amount", () => {
    const t = fromReceipt({ id: "s", created_at: "2026-01-01", operation: "SWAP NGN->USDT", status: "succeeded", amount: 5000, currency: "NGN", provider_reference: null, session_id: null, summary: { fee: 0.1 } })!;
    expect(t.fee).toBeUndefined();
    expect(t.customer).toBe("NGN → USDT");
  });
});
