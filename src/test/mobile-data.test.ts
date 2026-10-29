import { describe, expect, it } from "vitest";
import { matchOperator, toDataPlans } from "@/components/slikpay/MobileData";

const OPS = [
  { id: "341", label: "MTN" },
  { id: "342", label: "Airtel" },
  { id: "343", label: "Glo" },
  { id: "344", label: "9mobile" },
];

describe("matchOperator", () => {
  it("matches by operator id when the payload carries one", () => {
    expect(matchOperator({ operatorId: "342", network: "Airtel" }, OPS)?.label).toBe("Airtel");
  });

  it("matches decorated names like 'Airtel Nigeria'", () => {
    expect(matchOperator({ network: "Airtel Nigeria" }, OPS)?.id).toBe("342");
    expect(matchOperator({ operator: "MTN NIGERIA LTD" }, OPS)?.id).toBe("341");
  });

  it("matches aliases like Etisalat to 9mobile", () => {
    expect(matchOperator({ network: "Etisalat" }, OPS)?.id).toBe("344");
  });

  it("returns null when nothing matches", () => {
    expect(matchOperator({ network: "Vodafone" }, OPS)).toBeNull();
    expect(matchOperator(null, OPS)).toBeNull();
    expect(matchOperator({ network: "MTN" }, [])).toBeNull();
  });
});

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

  it("keeps only the requested network when plans are tagged", () => {
    const plans = toDataPlans({ plans: [
      { code: "A1", name: "Airtel 1GB", amount: 350, network: "Airtel" },
      { code: "M1", name: "MTN 1GB", amount: 350, network: "MTN" },
      { code: "G1", name: "Glo 1GB", amount: 300, operator: "Glo" },
    ] }, "Airtel");
    expect(plans.map((p) => p.code)).toEqual(["A1"]);
  });

  it("drops untagged plans when the payload is tagged and a network is chosen", () => {
    const plans = toDataPlans([
      { code: "A1", name: "1GB", amount: 350, network: "Airtel" },
      { code: "U1", name: "1GB universal", amount: 400 },
    ], "airtel");
    expect(plans.map((p) => p.code)).toEqual(["A1"]);
  });

  it("keeps everything when no plan carries a network tag", () => {
    const plans = toDataPlans([
      { code: "P1", name: "1GB", amount: 350 },
      { code: "P2", name: "2GB", amount: 700 },
    ], "airtel");
    expect(plans).toHaveLength(2);
  });

  it("reads plans nested under the matching network key", () => {
    const plans = toDataPlans({ airtel: [{ code: "A1", name: "Airtel 1GB", amount: 350 }], mtn: [{ code: "M1", name: "MTN 1GB", amount: 350 }] }, "Airtel");
    expect(plans.map((p) => p.code)).toEqual(["A1"]);
  });

  it("reads plans nested inside the matching operator entry", () => {
    const plans = toDataPlans({ operators: [
      { name: "MTN", plans: [{ code: "M1", name: "MTN 1GB", amount: 350 }] },
      { name: "Airtel", plans: [{ code: "A1", name: "Airtel 2GB", amount: 700 }] },
    ] }, "airtel");
    expect(plans.map((p) => p.code)).toEqual(["A1"]);
  });

  it("recognises biller and serviceType as network tags", () => {
    const plans = toDataPlans([
      { code: "A1", name: "1GB", amount: 350, biller: "Airtel NG" },
      { code: "M1", name: "1GB", amount: 350, serviceType: "mtn-data" },
    ], "airtel");
    expect(plans.map((p) => p.code)).toEqual(["A1"]);
  });

  it("returns an empty list for unrecognised payloads", () => {
    expect(toDataPlans(null)).toEqual([]);
    expect(toDataPlans({ unexpected: true })).toEqual([]);
    expect(toDataPlans("nope")).toEqual([]);
  });
});
