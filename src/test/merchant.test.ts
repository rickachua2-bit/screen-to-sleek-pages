import { describe, expect, it } from "vitest";
import { filterLedger, merchantModule, MERCHANT_GROUPS, MERCHANT_NAV } from "@/lib/merchant";
import type { Txn } from "@/lib/api";

const TXNS: Txn[] = [
  { id: "1", date: "2026-10-27T09:14:00", ref: "SLK-NIP-88213904", channel: "NIP", customer: "Chukwuemeka Aliyu", amount: 250000, direction: "credit", status: "Successful" },
  { id: "2", date: "2026-10-27T08:02:00", ref: "SLK-POS-55120877", channel: "SoftPOS", customer: "Adaora Nwosu", amount: 18500, direction: "credit", status: "Successful" },
  { id: "3", date: "2026-10-26T17:45:00", ref: "SLK-TRS-10293844", channel: "Treasury Sweep", customer: "Prime Tech Ltd", amount: 1200000, direction: "credit", status: "Pending" },
  { id: "4", date: "2026-10-26T13:20:00", ref: "SLK-NIP-77349012", channel: "NIP", customer: "Bola Adeyemi", amount: 45000, direction: "debit", status: "Successful" },
  { id: "5", date: "2026-10-25T11:05:00", ref: "SLK-BIL-66012455", channel: "Bills", customer: "Ikeja Electric", amount: 15000, direction: "debit", status: "Successful" },
  { id: "6", date: "2026-10-25T09:30:00", ref: "SLK-CRD-30118722", channel: "Card", customer: "AWS EMEA", amount: 32400, direction: "debit", status: "Failed" },
];

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
    expect(filterLedger(TXNS, "Adaora", "All", "", "").map((t) => t.id)).toEqual(["2"]);
    expect(filterLedger(TXNS, "SLK-CRD-30118722", "All", "", "").map((t) => t.id)).toEqual(["6"]);
  });
  it("filters successful records", () => {
    expect(filterLedger(TXNS, "", "Successful", "", "").map((t) => t.id)).toEqual(["1", "2", "4", "5"]);
  });
  it("includes both dates of the selected range", () => {
    expect(filterLedger(TXNS, "", "All", "2026-10-25", "2026-10-26").map((t) => t.id)).toEqual(["3", "4", "5", "6"]);
  });
});
