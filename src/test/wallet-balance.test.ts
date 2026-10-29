import { describe, expect, it } from "vitest";
import { parseWalletBalances } from "@/lib/wallet-balance";

describe("provider wallet balance parsing", () => {
  it("reads a balances array with availableBalance", () => {
    expect(parseWalletBalances({ balances: [{ currency: "NGN", availableBalance: 98640.2 }, { currency: "USDT", balance: 12.5 }] })).toEqual({ NGN: 98640.2, USDT: 12.5 });
  });
  it("reads a flat currency map", () => {
    expect(parseWalletBalances({ NGN: 5000, USD: "120.50" })).toEqual({ NGN: 5000, USD: 120.5 });
  });
  it("reads a top-level array", () => {
    expect(parseWalletBalances([{ currency: "NGN", amount: 100 }])).toEqual({ NGN: 100 });
  });
  it("reads per-currency objects", () => {
    expect(parseWalletBalances({ NGN: { balance: 42 }, EUR: { available: 7 } })).toEqual({ NGN: 42, EUR: 7 });
  });
  it("returns null for unrecognised or empty payloads so no guess is shown", () => {
    expect(parseWalletBalances(null)).toBeNull();
    expect(parseWalletBalances({})).toBeNull();
    expect(parseWalletBalances({ message: "ok" })).toBeNull();
    expect(parseWalletBalances({ balances: [{ currency: "NGN" }] })).toBeNull();
  });
  it("ignores non-numeric and malformed entries", () => {
    expect(parseWalletBalances({ balances: [{ currency: "NGN", balance: "abc" }, { currency: "ngn", balance: 5 }, { currency: "GHS", balance: 9 }] })).toEqual({ GHS: 9 });
  });
});
