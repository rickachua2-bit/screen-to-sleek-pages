import { describe, expect, it } from "vitest";
import { bulkTotals, parseBulkCsv } from "@/lib/transfer-rules";
import { confirmedSwap } from "@/lib/wallet-safety";
describe("payment reliability", () => {
  it("uses one-percent fees individually capped at 80 NGN in batch totals", () => {
    expect(bulkTotals([{ amount: 100 }, { amount: 5000 }, { amount: 10000 }])).toEqual({ principal: 15100, fees: 131, total: 15231 });
  });
  it("parses quoted notes containing commas and newlines", () => {
    expect(parseBulkCsv('bank_code,account_number,amount,note\n058,0123456789,100,"Invoice, October\nPaid"')[0]?.note).toBe("Invoice, October\nPaid");
  });
  it("rejects nonfinite payments", () => { expect(parseBulkCsv("058,0123456789,Infinity")[0]?.error).toBe("Bad amount"); });
  it("rejects fractional kobo", () => { expect(parseBulkCsv("058,0123456789,1.001")[0]?.error).toBe("Bad amount"); });
  it("blocks duplicate account bank and amount rows", () => { expect(parseBulkCsv("058,0123456789,100\n058,0123456789,100")[1]?.error).toBe("Duplicate payment in this file"); });
  it("keeps unknown swap outcomes unconfirmed even with an amount", () => { expect(confirmedSwap({ toAmount: 1000, rate: 1000 })).toBeNull(); });
  it("does not confirm a pending swap", () => { expect(confirmedSwap({ status: "pending", toAmount: 1000, rate: 1000 })).toBeNull(); });
  it("confirms only completed swaps with finite positive credit and rate", () => {
    expect(confirmedSwap({ status: "completed", toAmount: 1000, rate: 1000 })).toEqual({ amount: 1000, rate: 1000 });
    expect(confirmedSwap({ status: "completed", toAmount: Infinity, rate: 1000 })).toBeNull();
  });
});