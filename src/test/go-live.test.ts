import { describe, expect, it } from "vitest";
import { MERCHANT_STEPS, progress } from "@/lib/go-live";

describe("go-live checklist", () => {
  it("merchant has 8 steps and stays locked until review approved", () => {
    const all = MERCHANT_STEPS.map((s) => ({ step: s.key, status: "verified" }));
    expect(progress("merchant", all, "pending").canGoLive).toBe(false);
    expect(progress("merchant", all, "approved")).toEqual({ done: 8, total: 8, canGoLive: true });
  });
  it("rejected step blocks live", () => {
    const rows = MERCHANT_STEPS.map((s) => ({ step: s.key, status: s.key === "tax_id" ? "failed" : "verified" }));
    expect(progress("merchant", rows, "approved").canGoLive).toBe(false);
  });
  it("new merchant starts with only contacts done", () => {
    expect(progress("merchant", [], null).done).toBe(1);
  });
});
