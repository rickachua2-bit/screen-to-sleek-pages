import { describe, expect, it } from "vitest";
import { insights, mask, weekOverWeek, greetingFor } from "@/lib/insights";
import type { Txn } from "@/lib/api";

const now = new Date("2026-10-28T12:00:00Z").getTime();
const t = (daysAgo: number, amount: number, extra: Partial<Txn> = {}): Txn => ({ id: `${daysAgo}-${amount}`, date: new Date(now - daysAgo * 864e5).toISOString(), ref: "r", channel: "NIP", customer: "Acme", amount, direction: "credit", status: "Successful", ...extra });

describe("insights", () => {
  it("computes week-over-week inflow change", () => {
    expect(weekOverWeek([t(1, 1180), t(9, 1000)], now).pct).toBe(18);
  });
  it("returns null change when last week had no inflow", () => {
    expect(weekOverWeek([t(1, 500)], now).pct).toBeNull();
  });
  it("ignores failed and debit transactions in inflow", () => {
    expect(weekOverWeek([t(1, 500), t(1, 900, { status: "Failed" }), t(2, 300, { direction: "debit" })], now).thisWeek).toBe(500);
  });
  it("counts pending transactions", () => {
    expect(insights([t(1, 1, { status: "Pending" }), t(2, 1, { status: "Pending" }), t(3, 1)], now).pending).toBe(2);
  });
  it("masks amounts when hidden", () => {
    expect(mask("₦1,000", true)).not.toContain("1,000");
    expect(mask("₦1,000", false)).toBe("₦1,000");
  });
  it("greets by time of day", () => {
    expect([greetingFor(8), greetingFor(14), greetingFor(20)]).toEqual(["Good morning", "Good afternoon", "Good evening"]);
  });
});
