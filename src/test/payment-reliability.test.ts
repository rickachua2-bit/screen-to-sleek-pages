import { describe, expect, it } from "vitest";
import { bulkTotals, insufficientBulkBalance, parseBulkCsv } from "@/lib/transfer-rules";
import { confirmedSwap, requireVerifiedSwapContract } from "@/lib/wallet-safety";
describe("payment reliability", () => {
  it("blocks conversion without a verified quote and recovery contract", () => {
    expect(() => requireVerifiedSwapContract()).toThrow("not active yet");
  });
  it("allows only owner-confirmed stablecoin to NGN pairs", () => {
    expect(() => requireVerifiedSwapContract("USDT", "NGN")).not.toThrow();
    expect(() => requireVerifiedSwapContract("USDC", "NGN")).not.toThrow();
    expect(() => requireVerifiedSwapContract("NGN", "USDT")).toThrow();
    expect(() => requireVerifiedSwapContract("USDT", "USD")).toThrow();
  });
  it("accepts the supplied completed conversion without deducting its included fee", () => {
    expect(confirmedSwap({ success: true, reference: "SWP_example", status: "COMPLETED", toAmount: 172000, rate: 1725, platformFee: 500 })).toEqual({ amount: 172000, rate: 1725 });
    expect(confirmedSwap({ success: false, status: "COMPLETED", toAmount: 172000, rate: 1725 })).toBeNull();
  });
  it("does not require a live ledger balance for sandbox batch tests", () => {
    expect(insufficientBulkBalance(false, 101, undefined)).toBe(false);
    expect(insufficientBulkBalance(false, 101, 0)).toBe(false);
  });
  it("requires the fee-inclusive available balance for live batches", () => {
    expect(insufficientBulkBalance(true, 101, undefined)).toBe(true);
    expect(insufficientBulkBalance(true, 101, 100)).toBe(true);
    expect(insufficientBulkBalance(true, 101, 101)).toBe(false);
  });
  it("uses one-percent fees individually capped at 80 NGN in batch totals", () => {
    expect(bulkTotals([{ amount: 100 }, { amount: 5000 }, { amount: 10000 }])).toEqual({ principal: 15100, fees: 131, total: 15231 });
  });
  it("parses quoted notes containing commas and newlines", () => {
    expect(parseBulkCsv('bank_code,account_number,amount,note\n058,0123456789,100,"Invoice, October\nPaid"')[0]?.note).toBe("Invoice, October\nPaid");
  });
  it("rejects nonfinite payments", () => { expect(parseBulkCsv("058,0123456789,Infinity")[0]?.error).toBe("Bad amount"); });
  it("rejects fractional kobo", () => { expect(parseBulkCsv("058,0123456789,1.001")[0]?.error).toBe("Bad amount"); });
  it("blocks duplicate account bank and amount rows", () => { expect(parseBulkCsv("058,0123456789,100\n058,0123456789,100")[1]?.error).toBe("Duplicate payment in this file"); });
  it("limits uploads to 500 rows", () => {
    expect(() => parseBulkCsv(Array.from({ length: 501 }, () => "058,0123456789,100").join("\n"))).toThrow("500");
  });
  it("limits input to one megabyte", () => { expect(() => parseBulkCsv("x".repeat(1_000_001))).toThrow("1 MB"); });
  it("keeps unknown swap outcomes unconfirmed even with an amount", () => { expect(confirmedSwap({ toAmount: 1000, rate: 1000 })).toBeNull(); });
  it("does not confirm a pending swap", () => { expect(confirmedSwap({ status: "pending", toAmount: 1000, rate: 1000 })).toBeNull(); });
  it("confirms only completed swaps with finite positive credit and rate", () => {
    expect(confirmedSwap({ status: "completed", toAmount: 1000, rate: 1000 })).toEqual({ amount: 1000, rate: 1000 });
    expect(confirmedSwap({ status: "completed", toAmount: Infinity, rate: 1000 })).toBeNull();
  });
});