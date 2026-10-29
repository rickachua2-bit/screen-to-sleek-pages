import { beforeEach, expect, it, vi } from "vitest";
import { changePinSchema, invitationSchema, invitationState, invitationRoles } from "@/lib/team-security";
const mocks = vi.hoisted(() => ({ user: vi.fn(), digest: vi.fn(), rpc: vi.fn(), select: vi.fn(), event: vi.fn() }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user }));
vi.mock("@/lib/merchant-verification.server", () => ({ pinDigest: mocks.digest }));
import { securityOwner, verifySecurityPin } from "@/lib/team-security.server";
beforeEach(() => vi.resetAllMocks());
it("rejects malformed PINs and requires a different replacement PIN", () => {
  expect(changePinSchema.safeParse({ currentPin: "1234", newPin: "1234" }).success).toBe(false);
  expect(changePinSchema.safeParse({ currentPin: "1234", newPin: "5678" }).success).toBe(true);
  expect(changePinSchema.safeParse({ currentPin: "123", newPin: "5678" }).success).toBe(false);
});
it("normalizes invitation emails and never accepts permission fields", () => {
  expect(invitationSchema.parse({ name: "Ada", email: "ADA@example.com", pin: "1234", permissions: ["pay"] })).toEqual({ name: "Ada", email: "ada@example.com", pin: "1234", role: "viewer" });
  expect(invitationSchema.safeParse({ name: "Ada", email: "bad", pin: "1234" }).success).toBe(false);
});
it("offers at least seven validated invitation roles without allowing owner escalation", () => {
  expect(invitationRoles.length).toBeGreaterThanOrEqual(7);
  for (const role of invitationRoles) expect(invitationSchema.parse({ name: "Ada", email: "ada@example.com", pin: "1234", role: role.value }).role).toBe(role.value);
  expect(invitationSchema.safeParse({ name: "Ada", email: "ada@example.com", pin: "1234", role: "owner" }).success).toBe(false);
});
it("expires pending invitations without changing revoked ones", () => {
  expect(invitationState("pending", "2026-10-01T00:00:00Z", Date.parse("2026-10-29T00:00:00Z"))).toBe("expired");
  expect(invitationState("revoked", "2026-10-01T00:00:00Z")).toBe("revoked");
});
it("authorizes using protected profile, not a merchant value in browser metadata", async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { role: "personal" }, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  mocks.user.mockResolvedValue({ db: { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) }, user: { id: "me", user_metadata: { role: "merchant" } } });
  await expect(securityOwner()).rejects.toThrow("business account");
  expect(eq).toHaveBeenCalledWith("id", "me");
});
it("stops PIN verification when the atomic attempt limit rejects it", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  const db = { rpc: mocks.rpc, from: mocks.select };
  const ctx = { db, user: { id: "me" } } as unknown as Awaited<ReturnType<typeof securityOwner>>;
  await expect(verifySecurityPin(ctx, "1234")).rejects.toThrow("15 minutes");
  expect(mocks.digest).not.toHaveBeenCalled();
  expect(mocks.select).not.toHaveBeenCalled();
});
it("rejects the wrong PIN without returning security material", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const db = { rpc: mocks.rpc, from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { pin_digest: "expected", pin_salt: "salt" }, error: null }) }) }) }) };
  mocks.digest.mockResolvedValue("incorrect");
  const ctx = { db, user: { id: "me" } } as unknown as Awaited<ReturnType<typeof securityOwner>>;
  await expect(verifySecurityPin(ctx, "9999")).rejects.toThrow("Incorrect transaction PIN");
  expect(mocks.rpc).toHaveBeenCalledWith("claim_security_attempt", { p_user: "me" });
});