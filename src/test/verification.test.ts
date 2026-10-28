import { describe, expect, it } from "vitest";
import { contactSchema, phoneInternational, providerVerified, verificationMatches } from "@/lib/verification";
const now = Date.parse("2026-10-28T08:00:00Z");
const input = { email: "owner@example.com", phone: "+2348030000000", country: "NG", rcNumber: "RC1234" };
const row = { ...input, rc_number: input.rcNumber, email_verified: true, phone_verified: true, consumed: false, expires_at: "2026-10-28T08:10:00Z", company_name: "Verified Business Ltd" };
describe("merchant verification", () => {
  it("requires verified phone", () => { expect(verificationMatches({ ...row, phone_verified: false }, input, now)).toBe(false); expect(verificationMatches(row, input, now)).toBe(true); });
  it("requires verified email", () => expect(verificationMatches({ ...row, email_verified: false }, input, now)).toBe(false));
  it("binds the company to registration number and country", () => { expect(verificationMatches(row, { ...input, rcNumber: "RC9999" }, now)).toBe(false); expect(verificationMatches(row, { ...input, country: "US" }, now)).toBe(false); expect(verificationMatches({ ...row, company_name: "" }, input, now)).toBe(false); });
  it("rejects reused or expired proof", () => { expect(verificationMatches({ ...row, consumed: true }, input, now)).toBe(false); expect(verificationMatches(row, input, Date.parse(row.expires_at))).toBe(false); });
  it("does not treat delivery or generic success as verified OTP", () => { expect(providerVerified({ success: true })).toBe(false); expect(providerVerified({ verified: false })).toBe(false); expect(providerVerified({ verified: true })).toBe(true); });
  it("normalizes Nigerian local phone numbers", () => { expect(phoneInternational("0803 000 0000", "+234")).toBe("+2348030000000"); expect(contactSchema.safeParse({ ...input }).success).toBe(true); });
});