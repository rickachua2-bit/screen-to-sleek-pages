import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn(), settle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: mocks.settle }));
import { runPaddleOperation } from "@/lib/paddle.functions";
const invoke = runPaddleOperation as unknown as (input: { data: Record<string, unknown> }) => Promise<{ receipt: { status: string } }>;
const key = "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d";
const input = () => ({ data: { id: "post-bills-betting-fund", body: { operator: "SPORTY", customerId: "001234", amount: 1000 }, currency: "USD", params: {}, pin: "1234", idempotencyKey: key } });
beforeEach(() => {
  vi.resetAllMocks();
  const db = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) };
  mocks.user.mockResolvedValue({ db, user: { id: "user" }, role: "merchant", mode: "live", review: "approved" });
  mocks.call.mockResolvedValueOnce({ data: { customerName: "Ada", customerId: "001234" } });
});
it("validates the actual customer server-side before NGN reservation and funding", async () => {
  mocks.call.mockResolvedValueOnce({ data: { status: "COMPLETED", reference: "fund-1" } });
  expect((await invoke(input())).receipt.status).toBe("succeeded");
  expect(mocks.call).toHaveBeenNthCalledWith(1, "live", "POST", "/v1/bills/betting/validate", { operator: "SPORTY", customerId: "001234" });
  expect(mocks.guard.mock.calls[0]?.slice(1)).toEqual(["NGN", 1000, "1234", "POST /v1/bills/betting/fund", key]);
  expect(mocks.call).toHaveBeenNthCalledWith(2, "live", "POST", "/v1/bills/betting/fund", { operator: "SPORTY", customerId: "001234", amount: 1000, reference: key }, key);
});
it("never reserves or funds an invalid customer ID", async () => {
  mocks.call.mockReset().mockResolvedValue({ data: { valid: false, customerName: "Ada" } });
  await expect(invoke(input())).rejects.toThrow("Could not verify");
  expect(mocks.guard).not.toHaveBeenCalled();
  expect(mocks.call).toHaveBeenCalledTimes(1);
});
it("never funds after an insufficient-balance reservation failure", async () => {
  mocks.guard.mockRejectedValue(new Error("Insufficient balance including fees."));
  await expect(invoke(input())).rejects.toThrow("Insufficient balance");
  expect(mocks.call).toHaveBeenCalledTimes(1);
});
it.each([["PENDING", "pending"], ["FAILED", "failed"], [undefined, "pending"]])("does not label %s funding as successful", async (status, expected) => {
  mocks.call.mockResolvedValueOnce({ data: { status, reference: "fund-1" } });
  expect((await invoke(input())).receipt.status).toBe(expected);
  expect(mocks.settle.mock.calls[0]?.[2]).toBe(expected);
});
it("keeps funds reserved on uncertain dispatch without retrying", async () => {
  mocks.call.mockRejectedValueOnce(new Error("timeout"));
  await expect(invoke(input())).rejects.toThrow("funds remain reserved");
  expect(mocks.settle).not.toHaveBeenCalled();
  expect(mocks.call).toHaveBeenCalledTimes(2);
});