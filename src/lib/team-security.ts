import { z } from "zod";
export const displayNameSchema = z.object({ name: z.string().trim().min(2).max(120) });
export const invitationRoles = [
  { value: "administrator", label: "Administrator", description: "Workspace administration and team management" },
  { value: "finance_manager", label: "Finance manager", description: "Treasury oversight and payment approvals" },
  { value: "accountant", label: "Accountant", description: "Reconciliation, statements and financial reporting" },
  { value: "payment_operator", label: "Payment operator", description: "Prepare payments and manage beneficiaries" },
  { value: "developer", label: "Developer", description: "Integration configuration and technical operations" },
  { value: "support", label: "Customer support", description: "Customer enquiries and payment tracking" },
  { value: "viewer", label: "Viewer", description: "Read-only business reporting" },
] as const;
export const invitationRoleSchema = z.enum(["administrator", "finance_manager", "accountant", "payment_operator", "developer", "support", "viewer"]);
export const invitationSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(254), role: invitationRoleSchema.default("viewer"), pin: z.string().regex(/^\d{4}$/) });
export function invitationRoleLabel(role: string) { return invitationRoles.find((r) => r.value === role)?.label ?? "Unassigned"; }
export const revokeInvitationSchema = z.object({ id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) });
export const changePinSchema = z.object({ currentPin: z.string().regex(/^\d{4}$/), newPin: z.string().regex(/^\d{4}$/) }).refine((v) => v.currentPin !== v.newPin, "Choose a different PIN.");
export function invitationState(status: string, expiresAt: string, now = Date.now()) {
  return status === "pending" && Date.parse(expiresAt) <= now ? "expired" : status;
}