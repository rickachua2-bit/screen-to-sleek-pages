import { z } from "zod";
export const displayNameSchema = z.object({ name: z.string().trim().min(2).max(120) });
export const invitationSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(254), pin: z.string().regex(/^\d{4}$/) });
export const revokeInvitationSchema = z.object({ id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) });
export const changePinSchema = z.object({ currentPin: z.string().regex(/^\d{4}$/), newPin: z.string().regex(/^\d{4}$/) }).refine((v) => v.currentPin !== v.newPin, "Choose a different PIN.");
export function invitationState(status: string, expiresAt: string, now = Date.now()) {
  return status === "pending" && Date.parse(expiresAt) <= now ? "expired" : status;
}