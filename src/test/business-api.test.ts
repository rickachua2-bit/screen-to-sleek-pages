import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { DOCS_URL, docsLink, keyAction, liveKeyEligible } from "@/lib/business-api";
const mocks = vi.hoisted(() => ({ db: vi.fn(), digest: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/merchant-verification.server", () => ({ accountAdmin: mocks.db, digest: mocks.digest }));
vi.mock("@/lib/paddle.server", () => ({ callPaddle: mocks.provider, providerBalances: mocks.provider }));
import { businessApi } from "@/lib/business-api.server";
beforeEach(() => { vi.resetAllMocks(); mocks.digest.mockResolvedValue("synthetic-verifier"); });
const request = () => new Request("https://slikpay.test/api/public/business/v1/receipts", { headers: { authorization: `Bearer slk_test_${"a".repeat(64)}` } });
it("requires trusted approved KYB and an approval timestamp for live eligibility", () => {
  expect(liveKeyEligible("approved", "2026-10-29T08:00:00Z")).toBe(true);
  expect(liveKeyEligible("in_progress", null)).toBe(false);
  expect(liveKeyEligible("approved", null)).toBe(false);
});
it("requires a four digit PIN for every secret action", () => {
  expect(keyAction.safeParse({ id: "74e9b000-72de-4a87-811e-62b6222836b1", action: "claim", pin: "123" }).success).toBe(false);
});
it("rejects unsigned API requests before accessing account data", async () => {
  expect((await businessApi(new Request("https://slikpay.test"), "receipts")).status).toBe(401);
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects revoked or inactive keys", async () => {
  mocks.db.mockReturnValue({ rpc: async () => ({ data: [], error: null }) });
  expect((await businessApi(request(), "receipts")).status).toBe(401);
});
it("returns rate limit headers without accessing account records", async () => {
  mocks.db.mockReturnValue({ rpc: async () => ({ error: { message: "API_RATE_LIMIT" } }) });
  const response = await businessApi(request(), "receipts");
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
});
it("scopes receipt reads to the verified key owner and key environment", async () => {
  const eq = vi.fn(); const q = { eq, order: () => q, limit: async () => ({ data: [], error: null }) }; eq.mockReturnValue(q);
  mocks.db.mockReturnValue({ rpc: async () => ({ data: [{ owner_id: "business-owner", environment: "sandbox" }], error: null }), from: () => ({ select: () => q }) });
  const response = await businessApi(request(), "receipts");
  expect(response.status).toBe(200);
  expect(eq).toHaveBeenCalledWith("user_id", "business-owner"); expect(eq).toHaveBeenCalledWith("mode", "sandbox");
  expect(mocks.provider).not.toHaveBeenCalled();
});
const sql = readFileSync("supabase/slikpay_business_api.sql", "utf8");
it("issues sandbox keys after trusted merchant security insertion, not page load", () => {
  expect(sql).toMatch(/after insert on public\.merchant_security/);
  expect(sql).toContain("issue_business_api_key(new.user_id,'sandbox',false)");
});
it("issues live keys only on trusted approval", () => {
  expect(sql).toContain("new.review_status='approved' and new.approved_at is not null");
  expect(sql).toContain("issue_business_api_key(new.user_id,'live',false)");
});
it("makes claims one-time and rotations revoke previous active keys", () => {
  expect(sql).toContain("claimed_at=now(),encrypted_secret=null");
  expect(sql).toMatch(/if p_rotate then update business_api_keys set revoked_at=/);
});
it("points every documentation surface at the official docs site", () => {
  expect(DOCS_URL).toBe("https://docs.slikpay.online");
  expect(docsLink()).toBe(DOCS_URL);
  expect(docsLink("section-webhooks")).toBe(`${DOCS_URL}/#section-webhooks`);
});
it("shares one documentation address instead of repeating it per screen", () => {
  for (const file of ["src/components/slikpay/BusinessApiKeys.tsx", "src/components/slikpay/AuthSections.tsx", "src/components/slikpay/MerchantWorkspace.tsx"]) {
    const source = readFileSync(file, "utf8");
    expect(source).toContain('from "@/lib/business-api"');
    expect(source).not.toMatch(/https?:\/\/(?!docs\.slikpay\.online|api\.slikpay\.online)[a-z0-9.-]*slikpay\.(online|com|app)/);
  }
});
