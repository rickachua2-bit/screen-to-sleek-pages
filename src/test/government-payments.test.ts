import { beforeEach, expect, it, vi } from "vitest";
import { governmentAssessment, governmentLookup } from "@/lib/government-payments";
import { accessFor, scopeOf } from "@/lib/paddle-policy";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn(), settle: vi.fn(), prior: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: mocks.settle }));
import { executeGovernment } from "@/lib/government-payments.server";
const id = "123456789012";
const key = "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d";
const input = { identifier: id, expectedAmount: 1000, expectedFee: 50 };
beforeEach(() => {
  vi.resetAllMocks();
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "contains"]) chain[method] = vi.fn().mockReturnValue(chain);
  chain["limit"] = mocks.prior;
  const update = { eq: vi.fn().mockReturnValue({ eq: mocks.save }) };
  const db = { from: vi.fn().mockReturnValue({ ...chain, update: vi.fn().mockReturnValue(update) }) };
  mocks.user.mockResolvedValue({ db, user: { id: "user" }, role: "merchant", mode: "live", review: "approved" });
  mocks.prior.mockResolvedValue({ data: [], error: null }); mocks.save.mockResolvedValue({ error: null });
  mocks.call.mockResolvedValueOnce({ data: { beneficiaryName: "Ada", rrr: id, amount: 1000, fee: 50, currency: "NGN" } });
});
it("requires confirmed identity and exact fees, including a genuine zero fee", () => {
  expect(governmentAssessment("remita", id, { beneficiaryName: "Ada", amount: 1000 })?.ready).toBe(false);
  expect(governmentAssessment("remita", id, { beneficiaryName: "Ada", amount: 1000, fee: 0 })?.total).toBe(1000);
  expect(governmentAssessment("remita", id, { valid: false, beneficiaryName: "Ada", amount: 1000, fee: 0 })).toBeNull();
  expect(governmentAssessment("remita", id, { beneficiaryName: "Ada", rrr: "999999999999", amount: 1000, fee: 0 })).toBeNull();
});
it("validates 12-digit RRR on the server and restricts federal tax to merchants", () => {
  expect(governmentLookup.safeParse({ service: "remita", identifier: "123" }).success).toBe(false);
  expect(accessFor({ method: "POST", path: "/v1/bills/firs/pay" }, "personal", "live").allowed).toBe(false);
  expect(scopeOf({ method: "POST", path: "/v1/bills/remita/validate" })).toBe("reference");
});
it("revalidates before reserving principal plus exact fee and dispatches the original reference", async () => {
  mocks.call.mockResolvedValueOnce({ data: { status: "COMPLETED", amount: 1000, reference: "tax-1" } });
  const result = await executeGovernment("remita", input, key, "1234");
  expect(mocks.guard.mock.calls[0]?.slice(1)).toEqual(["NGN", 1050, "1234", "POST /v1/bills/remita/pay", key]);
  expect(mocks.call).toHaveBeenLastCalledWith("live", "POST", "/v1/bills/remita/pay", { rrr: id, amount: 1000, reference: key }, key);
  expect(result.receipt.status).toBe("succeeded");
});
it("blocks a changed assessment or fee before any debit", async () => {
  await expect(executeGovernment("remita", { ...input, expectedAmount: 999 }, key)).rejects.toThrow("changed");
  expect(mocks.guard).not.toHaveBeenCalled();
  expect(mocks.call).toHaveBeenCalledTimes(1);
});
it("blocks another payment of an already-submitted obligation", async () => {
  mocks.prior.mockResolvedValue({ data: [{ id: "existing" }], error: null });
  await expect(executeGovernment("remita", input, key)).rejects.toThrow("submitted payment");
  expect(mocks.guard).not.toHaveBeenCalled();
});
it("keeps mismatched success amounts pending", async () => {
  mocks.call.mockResolvedValueOnce({ data: { status: "COMPLETED", amount: 2000, reference: "tax-1" } });
  expect((await executeGovernment("remita", input, key)).receipt.status).toBe("pending");
});
it("does not release holds or replay after a dispatch timeout", async () => {
  mocks.call.mockRejectedValueOnce(new Error("timeout"));
  await expect(executeGovernment("remita", input, key)).rejects.toThrow("Funds remain reserved");
  expect(mocks.settle).not.toHaveBeenCalled();
  expect(mocks.call).toHaveBeenCalledTimes(2);
});
it("never guesses an unknown service fee", async () => {
  mocks.call.mockReset().mockResolvedValue({ data: { beneficiaryName: "Ada", amount: 1000 } });
  await expect(executeGovernment("remita", input, key)).rejects.toThrow("assessed amount and fee");
  expect(mocks.guard).not.toHaveBeenCalled();
});