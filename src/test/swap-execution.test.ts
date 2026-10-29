import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ call: vi.fn(), authorize: vi.fn(), guard: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/paddle.server", () => ({ callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ authorizeMoney: mocks.authorize, guardMoney: mocks.guard, settleMoney: mocks.settle }));
import { executeVerifiedSwap } from "@/lib/swap-execution.server";
type Row = { operation: string; currency: string; amount: number; status: string; summary: Record<string, unknown>; provider_reference: string | null };
const request = { from: "USDT", to: "NGN", amount: 100, pin: "1234", idempotencyKey: "original-key" };
function fixture(initial: Row | null = null) {
  let row = initial;
  const eq = vi.fn();
  const query = { select: vi.fn(), eq, maybeSingle: vi.fn(async () => ({ data: row, error: null })) };
  query.select.mockReturnValue(query); eq.mockReturnValue(query);
  const ctx = { db: { from: vi.fn(() => query) }, user: { id: "owner" }, mode: "live", review: "approved" } as unknown as Parameters<typeof executeVerifiedSwap>[0];
  mocks.guard.mockImplementation(async () => { row = { operation: "SWAP USDT->NGN", currency: "USDT", amount: 100, status: "pending", summary: {}, provider_reference: null }; });
  mocks.settle.mockImplementation(async (_ctx, _key, _status, ref, summary) => { if (row?.status === "pending") row = { ...row, status: "succeeded", summary, provider_reference: ref }; });
  return { ctx, eq };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.call.mockResolvedValue({ data: { success: true, reference: "SWP_confirmed", status: "COMPLETED", toAmount: 172000, rate: 1725, platformFee: 500 } });
});
describe("owner-confirmed conversion execution", () => {
  it("credits the full 172000 net amount once and reports the included 500 fee", async () => {
    const { ctx, eq } = fixture();
    const result = await executeVerifiedSwap(ctx, request);
    expect(result).toMatchObject({ credited: 172000, fee: 500, feeCurrency: "NGN" });
    expect(mocks.settle).toHaveBeenCalledWith(ctx, "original-key", "succeeded", "SWP_confirmed", expect.any(Object), { currency: "NGN", amount: 172000 });
    await executeVerifiedSwap(ctx, request);
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.guard).toHaveBeenCalledTimes(1);
    expect(mocks.settle).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("user_id", "owner");
    expect(eq).toHaveBeenCalledWith("mode", "live");
  });
  it("recovers a timed-out conversion with its original key and existing reservation", async () => {
    const { ctx } = fixture();
    mocks.call.mockRejectedValueOnce(new Error("timeout"));
    await expect(executeVerifiedSwap(ctx, request)).rejects.toThrow("awaiting confirmation");
    const result = await executeVerifiedSwap(ctx, request);
    expect(result.credited).toBe(172000);
    expect(mocks.guard).toHaveBeenCalledTimes(1);
    expect(mocks.call).toHaveBeenNthCalledWith(2, "live", "POST", "/v1/crypto/swap", { fromCurrency: "USDT", toCurrency: "NGN", amount: 100 }, "original-key");
  });
  it("rejects changed amounts on original keys before provider replay", async () => {
    const { ctx } = fixture({ operation: "SWAP USDT->NGN", currency: "USDT", amount: 100, status: "pending", summary: {}, provider_reference: null });
    await expect(executeVerifiedSwap(ctx, { ...request, amount: 101 })).rejects.toThrow("different payment");
    expect(mocks.call).not.toHaveBeenCalled();
    expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("never settles a pending response even if it contains amounts", async () => {
    const { ctx } = fixture();
    mocks.call.mockResolvedValue({ data: { success: true, status: "PENDING", reference: "SWP_pending", toAmount: 172000, rate: 1725, platformFee: 500 } });
    await expect(executeVerifiedSwap(ctx, request)).rejects.toThrow("awaiting confirmation");
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("does not contact the provider without PIN authorization", async () => {
    const { ctx } = fixture();
    mocks.authorize.mockRejectedValue(new Error("Incorrect transaction PIN"));
    await expect(executeVerifiedSwap(ctx, request)).rejects.toThrow("PIN");
    expect(mocks.call).not.toHaveBeenCalled();
    expect(mocks.guard).not.toHaveBeenCalled();
  });
});