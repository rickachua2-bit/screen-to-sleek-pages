import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: vi.fn(), readRecord: vi.fn(), holderName: vi.fn() }));
import { runPaddleOperation } from "@/lib/paddle.functions";
import { withdrawFunds } from "@/lib/wallets.functions";
import { SERVICES, serviceStatus } from "@/lib/services-registry";
import { isInternationalReceipt } from "@/lib/international";
const run = runPaddleOperation as unknown as (args: { data: Record<string, unknown> }) => Promise<unknown>;
const withdraw = withdrawFunds as unknown as typeof run;
describe("international payment availability", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ user: { id: "owner" }, db: {}, role: "merchant", mode: "live", review: "approved" }); });
  it.each(["post-payouts-global", "post-payouts-tuition"])("never reserves or dispatches unverified %s payments", async (id) => {
    await expect(run({ data: { id, params: {}, body: { amount: 100 }, currency: "USD", pin: "1234", idempotencyKey: "key" } })).rejects.toThrow("not active yet");
    expect(mocks.call).not.toHaveBeenCalled(); expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("blocks the alternate foreign-wallet withdrawal entry point before reservation", async () => {
    await expect(withdraw({ data: { currency: "USD", amount: 100, pin: "1234", idempotencyKey: "key" } })).rejects.toThrow("not active yet");
    expect(mocks.call).not.toHaveBeenCalled(); expect(mocks.guard).not.toHaveBeenCalled();
  });
  it.each(["live", "sandbox"] as const)("does not represent unconfirmed remittances as active in %s", (mode) => {
    for (const id of ["intl", "remittance"]) {
      const service = SERVICES.find((s) => s.id === id);
      expect(service).toBeDefined();
      if (!service) throw new Error("Missing international service");
      expect(serviceStatus(service, { role: "merchant", mode, review: "approved" })).toBe("not_active");
    }
  });
  it("keeps Remita government bills separate from international remittances", () => {
    expect(isInternationalReceipt("POST /v1/payouts/global")).toBe(true);
    expect(isInternationalReceipt("WITHDRAW USD")).toBe(true);
    expect(isInternationalReceipt("POST /v1/bills/remita/pay")).toBe(false);
  });
});