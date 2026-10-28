import { describe, expect, it } from "vitest";
import { filterLedger, merchantModule, MERCHANT_GROUPS, MERCHANT_NAV } from "@/lib/merchant";
import { MOCK_TXNS } from "@/lib/api";

describe("Merchant modules", () => {
  it("contains all 29 modules in eight service-aligned groups", () => {
    expect(MERCHANT_GROUPS).toHaveLength(8);
    expect(MERCHANT_NAV).toHaveLength(29);
    expect(new Set(MERCHANT_NAV.map((n) => n.id)).size).toBe(29);
  });
  it("validates module navigation", () => {
    expect(merchantModule("approvals")).toBe("approvals");
    expect(merchantModule("unknown")).toBe("overview");
  });
});
describe("Ledger filtering", () => {
  it("searches customers and references", () => {
    expect(filterLedger(MOCK_TXNS, "Adaora", "All", "", "").map((t) => t.id)).toEqual(["2"]);
    expect(filterLedger(MOCK_TXNS, "SLK-CRD-30118722", "All", "", "").map((t) => t.id)).toEqual(["6"]);
  });
  it("filters successful records", () => {
    expect(filterLedger(MOCK_TXNS, "", "Successful", "", "").map((t) => t.id)).toEqual(["1", "2", "4", "5"]);
  });
  it("includes both dates of the selected range", () => {
    expect(filterLedger(MOCK_TXNS, "", "All", "2026-10-25", "2026-10-26").map((t) => t.id)).toEqual(["3", "4", "5", "6"]);
  });
});