import { describe, expect, it } from "vitest";
import { paymentFailureReason } from "@/lib/payment-feedback";
import { createCryptoBankFlow, type CryptoBankState } from "@/lib/crypto-bank-flow";

describe("withdrawal failure classification", () => {
  it("distinguishes insufficient funds from an unknown dispatch", () => {
    expect(paymentFailureReason(new Error("Insufficient balance including fees."))).toBe("insufficient_funds");
    expect(paymentFailureReason(new Error("timeout: insufficient funds"))).toBe("uncertain");
  });
  it("does not expose provider payloads or identity", () => {
    expect(paymentFailureReason(new Error("Paddle Sterling Bank account 0123456789 crashed"))).toBe("uncertain");
  });
  it("preserves payout locking while showing the actual preflight failure", async () => {
    let current: CryptoBankState | undefined;
    let calls = 0;
    const flow = createCryptoBankFlow({ swap: async () => ({ credited: 1000 }), withdraw: async () => { calls++; throw new Error("Insufficient balance including fees."); }, id: () => "stable", changed: (s) => { current = s; } });
    await flow.convert("USDT", 1, "1234");
    await flow.pay("1234");
    await flow.pay("1234");
    expect(current?.stage).toBe("payout_pending");
    expect(calls).toBe(1);
  });
  it("distinguishes a confirmed decline from an uncertain withdrawal", () => {
    expect(paymentFailureReason(new Error("The bank declined this withdrawal."))).toBe("declined");
    expect(paymentFailureReason(new Error("Bank payment is awaiting confirmation."))).toBe("uncertain");
  });
  it("identifies incorrect PIN without declaring a completed payment", () => {
    expect(paymentFailureReason(new Error("Incorrect transaction PIN."))).toBe("incorrect_pin");
  });
});