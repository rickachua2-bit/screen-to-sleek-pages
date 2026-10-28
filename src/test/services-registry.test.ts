import { describe, expect, it } from "vitest";
import { SERVICES, reviewTotal, searchServices, serviceStatus } from "@/lib/services-registry";

describe("service status", () => {
  it("shows Sandbox while the account is in sandbox", () => {
    expect(serviceStatus({}, { role: "merchant", mode: "sandbox", review: "not_started" })).toBe("sandbox");
  });
  it("asks live users who aren't approved to verify", () => {
    expect(serviceStatus({}, { role: "merchant", mode: "live", review: "pending" })).toBe("verify");
  });
  it("is available once live and approved", () => {
    expect(serviceStatus({}, { role: "merchant", mode: "live", review: "approved" })).toBe("available");
  });
  it("keeps business-only services locked for personal users", () => {
    expect(serviceStatus({ businessOnly: true }, { role: "personal", mode: "live", review: "approved" })).toBe("business");
  });
});

describe("review totals", () => {
  it("adds the provider fee to the amount", () => {
    expect(reviewTotal(11700, 100)).toEqual({ amount: 11700, fee: 100, total: 11800 });
  });
  it("treats an unknown fee as zero", () => {
    expect(reviewTotal(500, null).total).toBe(500);
  });
});

describe("search by intent", () => {
  it("finds electricity from 'pay electricity'", () => {
    expect(searchServices("pay electricity").map((s) => s.id)).toContain("power");
  });
  it("finds cable TV from 'DStv'", () => {
    expect(searchServices("dstv").map((s) => s.id)).toEqual(["tv"]);
  });
  it("finds international transfer from 'send to Ghana'", () => {
    expect(searchServices("send to ghana").map((s) => s.id)).toContain("intl");
  });
  it("every guided flow has a pay operation", () => {
    for (const s of SERVICES) if (s.flow) expect(s.flow.pay.op).toMatch(/^post-/);
  });
});

import { parseFxRates, quoteSwap, railFor, nairaValueLive } from "@/lib/pricing";
describe("live FX", () => {
  const fx = parseFxRates({ USDT_NGN: 1362.2, NGN_USDT_PRICE: 1420.23, GBP_NGN: 1825.78, NGN_GBP_PRICE: 1855.78 });
  it("values USDT holdings at the provider's sell rate", () => {
    expect(nairaValueLive("USDT", 10, fx)).toBe(13622);
  });
  it("buys USDT with naira at the provider's buy price", () => {
    expect(quoteSwap("NGN", "USDT", 142023, fx)?.amount).toBeCloseTo(100, 6);
  });
  it("crosses two currencies through naira", () => {
    expect(quoteSwap("USDT", "GBP", 1, fx)?.amount).toBeCloseTo(1362.2 / 1855.78, 9);
  });
  it("has no rate for currencies the provider didn't quote", () => {
    expect(quoteSwap("NGN", "ZAR", 100, fx)).toBeNull();
  });
  it("uses the NIP payout rail for naira sends and the crypto rail for coin swaps", () => {
    expect(railFor("send", "NGN", false)).toBe("payouts");
    expect(railFor("swap", "USDT", true)).toBe("crypto_swap");
  });
});
