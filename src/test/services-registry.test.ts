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
