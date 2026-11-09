import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/fx-pricing.server", () => ({ fetchLiveNipTransferFee: async () => 10.75 }));
describe("debug fee mock", () => {
  it("intercepts the dynamic import", async () => {
    const m = await import("@/lib/fx-pricing.server");
    console.log("via alias:", String(m.fetchLiveNipTransferFee).slice(0, 80));
    const rel = await import("../lib/fx-pricing.server");
    console.log("via relative:", String(rel.fetchLiveNipTransferFee).slice(0, 80));
    expect(await m.fetchLiveNipTransferFee()).toBe(10.75);
  });
});
