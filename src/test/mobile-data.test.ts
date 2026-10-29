import { describe, expect, it } from "vitest";
import { toDataPlans } from "@/components/slikpay/MobileData";

describe("toDataPlans", () => {
  it("parses a plans array with price/validity fields", () => {
    const plans = toDataPlans({ plans: [
      { itemCode: "MTN-1GB", name: "1GB 30 days", price: 350, validity: "30 days", dataValue: "1GB" },
      { itemCode: "MTN-500MB", name: "500MB daily", price: 150, duration: "1 day" },
    ] });
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({ code: "MTN-500MB", amount: 150, validity: "1 day" });
    expect(plans[1]).toMatchObject({ code: "MTN-1GB", amount: 350, size: "1GB" });
  });

  it("parses a bare array and sorts by amount", () => {
    const plans = toDataPlans([
      { code: "B", title: "Big", amount: 1000 },
      { code: "A", title: "Small", amount: 200 },
    ]);
    expect(plans.map((p) => p.code)).toEqual(["A", "B"]);
  });

  it("drops entries without a code, name or positive amount", () => {
    const plans = toDataPlans({ data: [
      { code: "OK", name: "Good", amount: 100 },
      { code: "NO-AMT", name: "Free", amount: 0 },
      { name: "No code", amount: 100 },
      { code: "NO-NAME", amount: 100 },
    ] });
    expect(plans).toHaveLength(1);
    expect(plans[0]?.code).toBe("OK");
  });

  it("returns an empty list for unrecognised payloads", () => {
    expect(toDataPlans(null)).toEqual([]);
    expect(toDataPlans({ unexpected: true })).toEqual([]);
    expect(toDataPlans("nope")).toEqual([]);
  });
});
