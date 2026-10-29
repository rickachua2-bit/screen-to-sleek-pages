import { describe, expect, it } from "vitest";
import { paymentFeedback } from "@/lib/payment-feedback";
import { createCryptoBankFlow, type CryptoBankState } from "@/lib/crypto-bank-flow";

describe("withdrawal failure classification", () => {
  it("distinguishes insufficient funds from an unknown dispatch", () => {
    expect(paymentFeedback(new Error("Insufficient balance including fees."))).toContain("Insufficient funds.");
    expect(paymentFeedback(new Error("timeout: insufficient funds"))).toContain("status is not confirmed");
  });
  it("does not expose provider payloads or identity", () => {
    const result = paymentFeedback(new Error("Paddle Sterling Bank account 0123456789 crashed"));
    expect(result).not.toMatch(/Paddle|Sterling|0123456789/);
  });
  it("preserves payout locking while showing the actual preflight failure", async () => {
    let current: CryptoBankState | undefined;
    let calls = 0;
    const flow = createCryptoBankFlow({ swap: async () => ({ credited: 1000 }), withdraw: async () => { calls++; throw new Error("Insufficient balance including fees."); }, id: () => "stable", changed: (s) => { current = s; } });
    await flow.convert("USDT", 1, "1234");
    await flow.pay("1234");
    await flow.pay("1234");
    expect(current?.stage).toBe("payout_pending");
    expect(current?.message).toContain("Insufficient funds.");
    expect(calls).toBe(1);
  });
  it("distinguishes a confirmed decline from an uncertain withdrawal", () => {
    expect(paymentFeedback(new Error("The bank declined this withdrawal."))).toContain("Withdrawal failed.");
    expect(paymentFeedback(new Error("Bank payment is awaiting confirmation."))).not.toContain("failed");
  });
  it("identifies incorrect PIN without declaring a completed payment", () => {
    expect(paymentFeedback(new Error("Incorrect transaction PIN."))).toContain("Incorrect transaction PIN.");
  });
});