import { describe, expect, it } from "vitest";
import { paddleFailure, retryAfterSeconds, verificationRetry } from "@/lib/provider-errors";
describe("Paddle retry handling", () => {
  it("honors provider Retry-After seconds", () => { expect(retryAfterSeconds("120")).toBe(120); expect(verificationRetry(new Error(paddleFailure(429, {}, "120"))).seconds).toBe(120); });
  it("honors provider Retry-After dates", () => expect(retryAfterSeconds("Wed, 28 Oct 2026 08:52:00 GMT", Date.parse("2026-10-28T08:51:00Z"))).toBe(60));
  it("uses a safe retry backoff for 429 without a retry header", () => expect(verificationRetry(new Error(paddleFailure(429, {}, null))).seconds).toBe(60));
  it("distinguishes exhausted credits from temporary retry failures", () => { const e = paddleFailure(429, { error: "insufficient_sms_balance" }, null); expect(e).toContain("SMS balance or quota"); expect(verificationRetry(new Error(e)).seconds).toBe(0); });
  it("never echoes private provider payload fields", () => expect(paddleFailure(429, { phone: "+2348030000000", privateField: "private-payload" }, "30")).not.toContain("private-payload"));
});