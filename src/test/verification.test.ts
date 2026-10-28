import { describe, expect, it } from "vitest";
import { contactDeliverySchema, contactsVerified, contactSchema, phoneInternational, proofSchema, providerVerified, verificationMatches } from "@/lib/verification";
const now = Date.parse("2026-10-28T08:00:00Z");
const input = { email: "owner@example.com", phone: "+2348030000000", country: "NG", rcNumber: "RC1234" };
const row = { ...input, rc_number: input.rcNumber, email_verified: true, phone_verified: true, consumed: false, expires_at: "2026-10-28T08:10:00Z", company_name: "Verified Business Ltd" };
describe("merchant verification", () => {
  it("allows phone verification before email is entered", () => expect(contactDeliverySchema.safeParse({ channel: "phone", phone: "+2348030000000" }).success).toBe(true));
  it("allows email verification before phone is entered", () => expect(contactDeliverySchema.safeParse({ channel: "email", email: "owner@example.com" }).success).toBe(true));
  it("accepts exactly six OTP digits", () => { const base = { challengeId: "d4b030e2-aac2-4e4b-8a61-3a22c89c5bf0", channel: "phone" }; expect(proofSchema.safeParse({ ...base, code: "123456" }).success).toBe(true); expect(proofSchema.safeParse({ ...base, code: "12345" }).success).toBe(false); });
  it("requires both current contacts verified before leaving step one", () => { const p = { id: "phone-proof", value: input.phone }; const e = { id: "email-proof", value: input.email }; expect(contactsVerified(p, e, input.phone, input.email)).toBe(true); expect(contactsVerified(p, null, input.phone, input.email)).toBe(false); expect(contactsVerified(p, e, "+2348030000001", input.email)).toBe(false); expect(contactsVerified(p, e, input.phone, "changed@example.com")).toBe(false); });
  it("requires verified phone", () => { expect(verificationMatches({ ...row, phone_verified: false }, input, now)).toBe(false); expect(verificationMatches(row, input, now)).toBe(true); });
  it("requires verified email", () => expect(verificationMatches({ ...row, email_verified: false }, input, now)).toBe(false));
  it("binds the company to registration number and country", () => { expect(verificationMatches(row, { ...input, rcNumber: "RC9999" }, now)).toBe(false); expect(verificationMatches(row, { ...input, country: "US" }, now)).toBe(false); expect(verificationMatches({ ...row, company_name: "" }, input, now)).toBe(false); });
  it("rejects reused or expired proof", () => { expect(verificationMatches({ ...row, consumed: true }, input, now)).toBe(false); expect(verificationMatches(row, input, Date.parse(row.expires_at))).toBe(false); });
  it("does not treat delivery or generic success as verified OTP", () => { expect(providerVerified({ success: true })).toBe(false); expect(providerVerified({ verified: false })).toBe(false); expect(providerVerified({ verified: true })).toBe(true); });
  it("normalizes Nigerian local phone numbers", () => { expect(phoneInternational("0803 000 0000", "+234")).toBe("+2348030000000"); expect(contactSchema.safeParse({ ...input }).success).toBe(true); });
});