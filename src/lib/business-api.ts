import { z } from "zod";
export const keyAction = z.object({ id: z.string().uuid(), action: z.enum(["claim", "rotate", "revoke"]), pin: z.string().regex(/^\d{4}$/) });
export function liveKeyEligible(approved: string, approvedAt: string | null) { return approved === "approved" && Boolean(approvedAt); }
export function validBusinessKey(value: string) { return /^slk_(test|live)_[a-f0-9]{64}$/.test(value); }
export const API_PATHS = [
  { path: "/api/public/business/v1/balances", scope: "balances:read", description: "Your wallet balances in the key’s environment" },
  { path: "/api/public/business/v1/receipts", scope: "receipts:read", description: "Your most recent payment receipts" },
  { path: "/api/public/business/v1/banks", scope: "banks:read", description: "Supported bank codes and names" },
] as const;