import { describe, expect, it, vi } from "vitest";
import { createCryptoBankFlow, type CryptoBankState } from "@/lib/crypto-bank-flow";
import { SWAP_NOT_READY } from "@/lib/wallet-safety";

function setup(swap = vi.fn().mockResolvedValue({ credited: 1000 }), withdraw = vi.fn().mockResolvedValue({ reference: "bank-confirmed" })) {
  let state: CryptoBankState | undefined;
  let next = 0;
  const flow = createCryptoBankFlow({ swap, withdraw, id: () => `leg-${++next}`, changed: (value) => { state = value; } });
  return { flow, swap, withdraw, state: () => state };
}
describe("guarded two-step crypto bank review", () => {
  it("does not submit bank payout when the verified conversion gate blocks", async () => {
    const t = setup(vi.fn().mockRejectedValue(new Error(SWAP_NOT_READY)));
    await t.flow.convert("USDT", 1, "1234");
    await t.flow.pay("1234");
    expect(t.withdraw).not.toHaveBeenCalled();
    expect(t.state()?.stage).toBe("ready");
  });
  it("uses confirmed credited funds, includes the 1% bank fee and requires a separate payout confirmation", async () => {
    const t = setup();
    await t.flow.convert("USDC", 1, "1234");
    expect(t.withdraw).not.toHaveBeenCalled();
    expect(t.state()?.payoutAmount).toBe(990.1);
    await t.flow.pay("1234");
    expect(t.swap).toHaveBeenCalledWith({ from: "USDC", to: "NGN", amount: 1, pin: "1234", idempotencyKey: "leg-1" });
    expect(t.withdraw).toHaveBeenCalledWith({ currency: "NGN", amount: 990.1, pin: "1234", idempotencyKey: "leg-2" });
    expect(t.state()?.stage).toBe("completed");
  });
  it("never repeats conversion or payout after an uncertain bank dispatch", async () => {
    const t = setup(undefined, vi.fn().mockRejectedValue(new Error("timeout")));
    await t.flow.convert("USDT", 1, "1234");
    await t.flow.pay("1234");
    await t.flow.convert("USDT", 1, "1234");
    await t.flow.pay("1234");
    expect(t.state()?.stage).toBe("payout_pending");
    expect(t.swap).toHaveBeenCalledTimes(1);
    expect(t.withdraw).toHaveBeenCalledTimes(1);
  });
  it("locks an uncertain conversion without submitting any bank withdrawal", async () => {
    const t = setup(vi.fn().mockRejectedValue(new Error("timeout")));
    await t.flow.convert("USDT", 1, "1234");
    await t.flow.convert("USDT", 1, "1234");
    await t.flow.pay("1234");
    expect(t.state()?.stage).toBe("conversion_pending");
    expect(t.swap).toHaveBeenCalledTimes(1);
    expect(t.withdraw).not.toHaveBeenCalled();
  });
  it("reserves the capped 80 NGN fee out of confirmed proceeds", async () => {
    const t = setup(vi.fn().mockResolvedValue({ credited: 10000 }));
    await t.flow.convert("USDT", 10, "1234");
    expect(t.state()?.payoutAmount).toBe(9920);
  });
  it("suppresses overlapping conversion requests", async () => {
    let finish: ((value: { credited: number }) => void) | undefined;
    const t = setup(vi.fn().mockImplementation(() => new Promise<{ credited: number }>((resolve) => { finish = resolve; })));
    const first = t.flow.convert("USDT", 1, "1234");
    await t.flow.convert("USDT", 1, "1234");
    finish?.({ credited: 1000 });
    await first;
    expect(t.swap).toHaveBeenCalledTimes(1);
    expect(t.state()?.stage).toBe("converted");
  });
});