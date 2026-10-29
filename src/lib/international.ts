import type { FxRates } from "./pricing";
import { payoutStatus } from "./transfer-validation";

/** Generic catalog dispatch stays blocked for these provider routes; money moves only through the dedicated global payout flow. */
export function isUnverifiedInternationalPayout(path: string) {
  return path === "/v1/payouts/global" || path === "/v1/payouts/tuition";
}

export function isInternationalReceipt(operation: string) {
  return ["POST /v1/payouts/global", "POST /v1/payouts/tuition"].includes(operation) || /^WITHDRAW (GHS|KES|ZAR|USD|EUR|GBP)$/.test(operation);
}

/* ---------- Owner-confirmed corridors, fees and recovery rules (29 Oct 2026) ---------- */

export interface BeneficiaryField { name: string; label: string; pattern?: RegExp; hint?: string }
export interface Corridor { id: string; label: string; target: string; fields: BeneficiaryField[] }

const f = (name: string, label: string, pattern?: RegExp, hint?: string): BeneficiaryField => ({ name, label, pattern, hint });
const eurFields = [
  f("iban", "IBAN", /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i, "starts with a two-letter country code"),
  f("bic", "BIC / SWIFT code", /^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/i, "8 or 11 characters"),
];

/** Confirmed payout destinations. Listed corridors still require a live-activated account with the provider. */
export const CORRIDORS: Corridor[] = [
  { id: "US", label: "United States", target: "USD", fields: [
    f("bankName", "Bank name"),
    f("routingNumber", "Routing number", /^\d{9}$/, "9-digit routing number"),
    f("accountNumber", "Account number", /^\d{4,17}$/, "4 to 17 digits"),
  ] },
  { id: "GB", label: "United Kingdom", target: "GBP", fields: [
    f("sortCode", "Sort code", /^\d{6}$/, "6-digit sort code"),
    f("accountNumber", "Account number", /^\d{8}$/, "8-digit account number"),
  ] },
  ...([["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["IE", "Ireland"], ["ES", "Spain"], ["IT", "Italy"]] as const)
    .map(([id, label]) => ({ id, label, target: "EUR", fields: eurFields })),
  { id: "GH", label: "Ghana", target: "GHS", fields: [
    f("bankCode", "Bank code", /^\d{3,8}$/, "3 to 8 digits"),
    f("accountNumber", "Account number", /^\d{6,17}$/, "6 to 17 digits"),
  ] },
  { id: "KE", label: "Kenya", target: "KES", fields: [
    f("bankCode", "Bank code", /^\d{3,8}$/, "3 to 8 digits"),
    f("accountNumber", "Account number", /^\d{6,20}$/, "6 to 20 digits"),
  ] },
  { id: "ZA", label: "South Africa", target: "ZAR", fields: [
    f("branchCode", "Branch code", /^\d{6}$/, "6-digit branch code"),
    f("accountNumber", "Account number", /^\d{6,17}$/, "6 to 17 digits"),
    f("bankName", "Bank name"),
  ] },
];

/** Wallets that can fund a payout: the naira wallet (converting) or a foreign-currency wallet paying out in kind. */
export const GLOBAL_SOURCES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;
export type GlobalSource = (typeof GLOBAL_SOURCES)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fee for a payout funded from a foreign-currency wallet: 0.5% with a 5-unit floor and a 25-unit cap, in the wallet currency. */
export function globalWalletFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  return round2(Math.min(Math.max(amount * 0.005, 5), 25));
}

/** Fee for a naira-funded cross-border payout: 0.5% of the naira principal, minimum ₦5,000. */
export function nairaCrossBorderFee(principal: number): number {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error("Enter a valid amount.");
  return round2(Math.max(principal * 0.005, 5000));
}

/** Minimum payout amount: the target-currency equivalent of USD 10 at live rates. */
export function minimumTargetAmount(source: string, target: string, fx: FxRates): number | null {
  const usd = fx.bid["USD"];
  if (!usd) return null;
  const perUsd = source === target
    ? (fx.bid[target] ? usd / fx.bid[target] : null)
    : (fx.ask[target] ? usd / fx.ask[target] : null);
  return perUsd ? round2(10 * perUsd) : null;
}

export interface Beneficiary { accountName: string; country: string; [field: string]: string }

/** Validates the recipient details for one corridor and returns the provider beneficiary payload. */
export function beneficiaryFor(corridor: Corridor, accountName: string, input: Record<string, string>): Beneficiary {
  const name = accountName.trim();
  if (name.length < 2 || name.length > 160) throw new Error("Enter the recipient's full account name.");
  const out: Beneficiary = { accountName: name, country: corridor.id };
  for (const field of corridor.fields) {
    const value = (input[field.name] ?? "").trim();
    if (!value) throw new Error(`Enter the ${field.label.toLowerCase()}.`);
    if (field.pattern && !field.pattern.test(value)) throw new Error(field.hint ? `${field.label}: ${field.hint}.` : `${field.label} is not valid.`);
    out[field.name] = value;
  }
  return out;
}

export function corridorFor(country: string): Corridor | null {
  return CORRIDORS.find((c) => c.id === country) ?? null;
}

/** White-labelled decline reason taken from the clearing network's failureReason. */
export function safeDeclineReason(value: unknown): string {
  const raw = typeof value === "string" && value.trim() ? value : "Declined by the clearing network";
  return raw.replace(/paddle|sterling|baas/gi, "").replace(/\s+/g, " ").trim().slice(0, 160) || "Declined by the clearing network";
}

export { payoutStatus };
