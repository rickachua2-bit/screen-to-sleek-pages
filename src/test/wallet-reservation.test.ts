import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/paddle.server", () => ({ callPaddle: vi.fn() }));
import { guardMoney, settleMoney } from "@/lib/wallets.server";
describe("atomic wallet reservation boundary", () => {
  it("uses a single transactional receipt/reservation call and rejects duplicate RPC results", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } });
    const ctx = { db: { rpc }, user: { id: "user" }, mode: "sandbox", review: "approved" } as unknown as Parameters<typeof guardMoney>[0];
    await expect(guardMoney(ctx, "USDT", 10, undefined, "SWAP", "same-reference")).rejects.toThrow("could not be prepared");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("begin_wallet_payment", expect.objectContaining({ p_reference: "same-reference", p_amount: 10 }));
  });
  it("passes pending without releasing or posting through separate writes", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const ctx = { db: { rpc }, user: { id: "user" }, mode: "live", review: "approved" } as unknown as Parameters<typeof settleMoney>[0];
    await settleMoney(ctx, "reference", "pending", null);
    expect(rpc).toHaveBeenCalledWith("finish_wallet_payment", expect.objectContaining({ p_user: "user", p_status: "pending", p_credit_amount: null }));
  });
  it("rejects uncommitted settlement so it cannot be presented as a successful swap", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "transaction rolled back" } });
    const ctx = { db: { rpc }, user: { id: "user" }, mode: "live", review: "approved" } as unknown as Parameters<typeof settleMoney>[0];
    await expect(settleMoney(ctx, "ref", "succeeded", "provider", {}, { currency: "NGN", amount: 100 })).rejects.toThrow("reconciliation");
  });
});