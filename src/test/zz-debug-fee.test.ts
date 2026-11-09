import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn(), settle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: mocks.settle }));
vi.mock("@/lib/fx-pricing.server", () => ({ fetchLiveNipTransferFee: async () => 10.75 }));
import { runPaddleOperation } from "@/lib/paddle.functions";
const invoke = runPaddleOperation as unknown as (input: { data: Record<string, unknown> }) => Promise<unknown>;
describe("debug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.user.mockResolvedValue({ db: { from: vi.fn().mockReturnValue({ select, upsert }) }, user: { id: "user" }, role: "merchant", mode: "live", review: "approved" });
    mocks.guard.mockResolvedValue(undefined);
    mocks.settle.mockResolvedValue(undefined);
    mocks.call.mockResolvedValueOnce({ data: { accountName: "Verified recipient" } });
  });
  it("logs the real error", async () => {
    mocks.guard.mockRejectedValue(new Error("Insufficient balance including fees."));
    try {
      await invoke({ data: { id: "post-payouts-transfer", body: { amount: 100, destinationBankCode: "058", destinationAccountNumber: "0123456789" }, params: {}, currency: "NGN", pin: "1234", idempotencyKey: "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d" } });
      console.log("NO ERROR THROWN");
    } catch (e) {
      console.log("ERROR:", (e as Error).message);
      console.log("STACK:", (e as Error).stack?.split("\n").slice(0, 6).join(" | "));
    }
    expect(true).toBe(true);
  });
});
