import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), verify: vi.fn(), event: vi.fn(), rpc: vi.fn(), digest: vi.fn(), update: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/team-security.server", () => ({ securityOwner: mocks.owner, verifySecurityPin: mocks.verify, recordSecurityEvent: mocks.event }));
vi.mock("@/lib/merchant-verification.server", () => ({ pinDigest: mocks.digest }));
import { changeTransactionPin, revokeTeamInvitation } from "@/lib/team-security.functions";
const pin = changeTransactionPin as unknown as (v: { data: { currentPin: string; newPin: string } }) => Promise<unknown>;
const revoke = revokeTeamInvitation as unknown as (v: { data: { id: string; pin: string } }) => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  const chain = { eq: mocks.eq, select: vi.fn().mockReturnValue({ maybeSingle: mocks.maybeSingle }) };
  mocks.eq.mockReturnValue(chain); mocks.update.mockReturnValue(chain);
  mocks.owner.mockResolvedValue({ db: { rpc: mocks.rpc, from: vi.fn().mockReturnValue({ update: mocks.update }) }, user: { id: "owner" } });
});
it("compares the original PIN digest atomically when changing the PIN", async () => {
  mocks.verify.mockResolvedValue({ pin_digest: "original", pin_salt: "salt" });
  mocks.digest.mockResolvedValue("replacement"); mocks.rpc.mockResolvedValue({ data: true, error: null });
  await pin({ data: { currentPin: "1234", newPin: "5678" } });
  expect(mocks.rpc).toHaveBeenCalledWith("replace_transaction_pin", expect.objectContaining({ p_user: "owner", p_old_digest: "original", p_new_digest: "replacement" }));
});
it("does not change the PIN after failed current-PIN verification", async () => {
  mocks.verify.mockRejectedValue(new Error("Incorrect transaction PIN."));
  await expect(pin({ data: { currentPin: "9999", newPin: "5678" } })).rejects.toThrow("Incorrect");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("scopes revocation to the authenticated owner and requires an existing row", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(revoke({ data: { id: "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d", pin: "1234" } })).rejects.toThrow("another business");
  expect(mocks.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(mocks.event).not.toHaveBeenCalled();
});