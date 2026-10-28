import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
describe("banking safety", () => {
  it("never manufactures transfer success while banking is unconfigured", async () => {
    await expect(api.transfer({ recipientBank: "232", accountNumber: "0123456789", amount: 100, narration: "Test" })).rejects.toThrow("locked");
  });
  it("does not fabricate a bank account name when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    try { await expect(api.nameEnquiry("232", "0123456789")).rejects.toThrow("offline"); }
    finally { vi.unstubAllGlobals(); }
  });
});