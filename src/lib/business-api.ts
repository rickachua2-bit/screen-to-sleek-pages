import { z } from "zod";
export const keyAction = z.object({ id: z.string().uuid(), action: z.enum(["claim", "rotate", "revoke"]), challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
export function liveKeyEligible(approved: string, approvedAt: string | null) { return approved === "approved" && Boolean(approvedAt); }
export function validBusinessKey(value: string) { return /^slk_(test|live)_[a-f0-9]{64}$/.test(value); }
export const API_PATHS = [
  { path: "/api/public/business/v1/balances", scope: "balances:read", description: "Your wallet balances in the key’s environment" },
  { path: "/api/public/business/v1/receipts", scope: "receipts:read", description: "Your most recent payment receipts" },
  { path: "/api/public/business/v1/banks", scope: "banks:read", description: "Supported bank codes and names" },
] as const;

// Canonical Slikpay developer documentation site. Keep this as the single source
// so every "Documentation" surface in the app points at the same address.
export const DOCS_URL = "https://docs.slikpay.online";

// Gateway base URL published in the official documentation (sandbox and live share it;
// the key prefix selects the environment).
export const API_BASE_URL = "https://api.slikpay.online/v1";


// Anchors verified against the live documentation site.
export const DOCS_SECTIONS = [
  { id: "section-quickstart", name: "Quickstart & architecture" },
  { id: "section-authentication", name: "Authentication & secret keys" },
  { id: "section-environments", name: "Base URLs & environments" },
  { id: "section-webhooks", name: "Webhooks & signature verification" },
  { id: "section-errors", name: "Error codes & HTTP handling" },
  { id: "api-gateway-initialize", name: "Checkout initialization" },
  { id: "api-virtual-accounts", name: "Virtual NUBAN accounts" },
  { id: "api-payouts-single", name: "Single payouts & status" },
  { id: "api-bulk-payouts", name: "Bulk payouts" },
  { id: "api-cards-create", name: "Virtual cards" },
  { id: "api-crypto-vaults", name: "Stablecoin vaults & FX" },
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

export function docsLink(section?: string) {
  return section ? `${DOCS_URL}/#${section}` : DOCS_URL;
}
