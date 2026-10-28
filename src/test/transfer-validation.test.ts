import { describe, expect, it } from "vitest";
import { exactPayoutFee, payoutBody, payoutStatus, validTransferAmount } from "@/lib/transfer-validation";

describe("API bank transfers", () => {
  it("requires a 10 digit recipient account", () => { expect(payoutBody.safeParse({ amount: 100, destinationBankCode: "058", destinationAccountNumber: "0123456789" }).success).toBe(true); expect(payoutBody.safeParse({ amount: 100, destinationBankCode: "058", destinationAccountNumber: "123" }).success).toBe(false); });
  it("rejects malformed amounts and fractions below a kobo", () => { expect(validTransferAmount("100.25")).toBe(true); for (const value of ["1.2.3", "Infinity", "-1", "0", "0.001"]) expect(validTransferAmount(value)).toBe(false); });
  it("requires an exact provider fee rather than inventing zero", () => { expect(exactPayoutFee({ rail: "payouts", fee: "10.50", currency: "NGN" })).toBe(10.5); expect(() => exactPayoutFee({ rail: "payouts" })).toThrow(); expect(() => exactPayoutFee({ rail: "collections", fee: 0 })).toThrow(); });
  it("only confirms completed payouts, not HTTP acceptance", () => { expect(payoutStatus({ status: "successful" })).toBe("succeeded"); expect(payoutStatus({ status: "failed" })).toBe("failed"); expect(payoutStatus({ status: "processing" })).toBe("pending"); expect(payoutStatus({ reference: "bank-ref" })).toBe("pending"); });
});