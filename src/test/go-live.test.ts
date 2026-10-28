import { describe, expect, it } from "vitest";
import { MERCHANT_STEPS, namesMatch, progress } from "@/lib/go-live";

describe("business go-live", () => {
  it("has 7 steps with no tax or sanctions review", () => {
    expect(MERCHANT_STEPS.map((s) => s.key)).toEqual(["contacts", "business_identity", "director_bvn", "beneficial_owners", "operations", "settlement_account", "two_factor"]);
  });
  it("is complete only when every step is verified", () => {
    const all = MERCHANT_STEPS.map((s) => ({ step: s.key, status: "verified" }));
    expect(progress("merchant", all).canGoLive).toBe(true);
    expect(progress("merchant", all.filter((r) => r.step !== "two_factor")).canGoLive).toBe(false);
  });
  it("settlement name must match the business", () => {
    expect(namesMatch("ACME LOGISTICS LIMITED", "Acme Logistics Ltd.")).toBe(true);
    expect(namesMatch("Acme Logistics Nigeria Ltd", "ACME LOGISTICS NIG LIMITED")).toBe(true);
    expect(namesMatch("TUNDE ADEBAYO BALOGUN", "Acme Logistics Ltd")).toBe(false);
  });
  it("accepts a short bank tag before the business name", () => {
    expect(namesMatch("FIN-TRAVSIFY GLOBAL INCLUSIVE LIMITED", "TRAVSIFY GLOBAL INCLUSIVE LIMITED")).toBe(true);
    expect(namesMatch("FLW/TRAVSIFY GLOBAL INCLUSIVE LTD", "TRAVSIFY GLOBAL INCLUSIVE LIMITED")).toBe(true);
    expect(namesMatch("JOHN DOE TRAVSIFY GLOBAL INCLUSIVE LIMITED", "TRAVSIFY GLOBAL INCLUSIVE LIMITED")).toBe(false);
    expect(namesMatch("FIN-OTHER COMPANY LTD", "TRAVSIFY GLOBAL INCLUSIVE LIMITED")).toBe(false);
  });
});

import { personalTier } from "@/lib/go-live";
describe("personal tier", () => {
  it("is 0 until tier-1 identity is verified, then rises tier by tier", () => {
    expect(personalTier([])).toBe(0);
    expect(personalTier([{ step: "personal_bvn", status: "verified" }])).toBe(1);
    expect(personalTier([{ step: "personal_bvn", status: "verified" }, { step: "liveness", status: "verified" }])).toBe(2);
    expect(personalTier([{ step: "liveness", status: "verified" }])).toBe(0);
  });
});
