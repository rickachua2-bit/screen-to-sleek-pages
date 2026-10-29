import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn(), settle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: mocks.settle }));
import { runPaddleOperation } from "@/lib/paddle.functions";
const invoke = runPaddleOperation as unknown as (input: { data: Record<string, unknown> }) => Promise<{ receipt: { status: string; amount: number } }>;
describe("bank payout transactional execution", () => {
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
  const input = () => ({ data: { id: "post-payouts-transfer", body: { amount: 100, destinationBankCode: "058", destinationAccountNumber: "0123456789" }, params: {}, currency: "NGN", pin: "1234", idempotencyKey: "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d" } });
  it("reserves principal plus 1% and settles the original principal exactly once", async () => {
    mocks.call.mockResolvedValueOnce({ data: { status: "completed", reference: "provider", sessionId: "bank-session" } });
    const r = await invoke(input());
    expect(mocks.guard).toHaveBeenCalledOnce();
    expect(mocks.guard.mock.calls[0]?.[2]).toBe(101);
    expect(mocks.settle).toHaveBeenCalledOnce();
    expect(mocks.settle.mock.calls[0]?.slice(2)).toEqual(["succeeded", "provider", { principal: 100, fee: 1, nipSessionId: "bank-session", recipient: "Verified recipient" }]);
    expect(r.receipt.amount).toBe(100);
  });
  it("does not dispatch a payout if atomic reservation fails", async () => {
    mocks.guard.mockRejectedValue(new Error("Insufficient balance including fees."));
    await expect(invoke(input())).rejects.toThrow("Insufficient balance");
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("never releases uncertain funds on a dispatch timeout", async () => {
    mocks.call.mockRejectedValueOnce(new Error("timeout"));
    await expect(invoke(input())).rejects.toThrow("funds remain reserved");
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});