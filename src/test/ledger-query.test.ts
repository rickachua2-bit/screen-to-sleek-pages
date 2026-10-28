import { describe, expect, it } from "vitest";
import { matchLedger, parseLedgerQuery, runningBalances } from "@/lib/ledger-query";
import type { Txn } from "@/lib/api";

const t = (o: Partial<Txn>): Txn => ({ id: "1", date: "2026-03-10T10:00:00Z", ref: "R1", channel: "NIP", customer: "Ada Obi", amount: 1000, direction: "credit", status: "Successful", ...o });

describe("ledger query", () => {
  it("reads failed + over 50k", () => {
    const q = parseLedgerQuery("failed transfers over 50k");
    expect(q.status).toBe("Failed");
    expect(q.min).toBe(50000);
  });
  it("reads name and month", () => {
    const q = parseLedgerQuery("how much did ada pay in march");
    expect(q.month).toBe(2);
    expect(matchLedger(t({}), { ...q, text: "ada" })).toBe(true);
  });
  it("amount range filters", () => {
    const q = parseLedgerQuery("between 500 and 2k");
    expect(matchLedger(t({ amount: 1000 }), q)).toBe(true);
    expect(matchLedger(t({ amount: 3000 }), q)).toBe(false);
  });
});

describe("running balance", () => {
  it("walks back from current, skipping failed", () => {
    const rows = [t({ id: "a", amount: 300 }), t({ id: "b", amount: 200, status: "Failed" }), t({ id: "c", amount: 100, direction: "debit" })];
    const m = runningBalances(rows, 1000);
    expect(m.get("a")).toBe(1000);
    expect(m.get("b")).toBe(700);
    expect(m.get("c")).toBe(700);
  });
});
