import { z } from "zod";

export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});
export const proofSchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), channel: z.enum(["phone", "email"]) });
export const businessLookupSchema = z.object({ challengeId: z.string().uuid(), country: z.string().length(2), rcNumber: z.string().trim().min(4).max(40) });
export const merchantSignupSchema = z.object({ challengeId: z.string().uuid(), email: z.string().trim().toLowerCase().email(), phone: z.string(), password: z.string().min(8).max(128), fullName: z.string().trim().min(2).max(120), category: z.string().trim().min(3).max(80), country: z.string().length(2), rcNumber: z.string().trim().min(4).max(40), pin: z.string().regex(/^\d{4}$/) });

export function verificationMatches(row: { email: string; phone: string; email_verified: boolean; phone_verified: boolean; expires_at: string; consumed: boolean; country?: string; rc_number?: string; company_name?: string }, input: { email: string; phone: string; country: string; rcNumber: string }, now = Date.now()) {
  return row.email === input.email && row.phone === input.phone && row.email_verified && row.phone_verified && !row.consumed && Date.parse(row.expires_at) > now && row.country === input.country && row.rc_number === input.rcNumber && Boolean(row.company_name?.trim());
}

export function phoneInternational(value: string, dial: string) {
  if (value.trim().startsWith("+")) return value.trim().replace(/[\s()-]/g, "");
  return dial + value.replace(/\D/g, "").replace(/^0+/, "");
}

export function providerVerified(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d["verified"] === true;
}