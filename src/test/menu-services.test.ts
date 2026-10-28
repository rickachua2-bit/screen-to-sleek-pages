import { describe, expect, it } from "vitest";
import { MERCHANT_NAV, merchantModule } from "@/lib/merchant";
import { SERVICES } from "@/lib/services-registry";

describe("sidebar service items", () => {
  const svc = MERCHANT_NAV.filter((n) => n.id.startsWith("svc-"));
  it("every service menu item opens a guided service that exists", () => {
    expect(svc.length).toBe(10);
    for (const n of svc) expect(SERVICES.find((s) => s.id === n.id.slice(4))?.flow, n.id).toBeTruthy();
  });
  it("service menu items are valid dashboard modules", () => {
    expect(merchantModule("svc-airtime")).toBe("svc-airtime");
    expect(merchantModule("svc-unknown")).toBe("overview");
  });
});
