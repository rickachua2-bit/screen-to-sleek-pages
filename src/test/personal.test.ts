import { describe, expect, it } from "vitest";
import { PERSONAL_NAV, PERSONAL_TABS, personalModule } from "@/lib/personal";

describe("personal navigation", () => {
  it("has 8 modules with unique ids", () => {
    expect(PERSONAL_NAV).toHaveLength(8);
    expect(new Set(PERSONAL_NAV.map((n) => n.id)).size).toBe(8);
  });
  it("mobile bottom bar has exactly Home, Transfers, Bills, Cards, Profile", () => {
    expect(PERSONAL_TABS.map((t) => t.label)).toEqual(["Home & Wallet", "Transfers", "Bills", "Cards", "Profile"]);
  });
  it("validates module search param and falls back to home", () => {
    expect(personalModule("savings")).toBe("savings");
    expect(personalModule("rewards")).toBe("rewards");
    expect(personalModule("unknown")).toBe("home");
    expect(personalModule(undefined)).toBe("home");
  });
});
