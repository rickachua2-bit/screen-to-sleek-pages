import type { FxRates } from "./pricing";
import { payoutStatus } from "./transfer-validation";

/** Generic catalog dispatch stays blocked for these provider routes; money moves only through the dedicated global payout flow. */
export function isUnverifiedInternationalPayout(path: string) {
  return path === "/v1/payouts/global" || path === "/v1/payouts/tuition";
}

export function isInternationalReceipt(operation: string) {
  return ["POST /v1/payouts/global", "POST /v1/payouts/tuition"].includes(operation) || /^WITHDRAW (GHS|KES|ZAR|USD|EUR|GBP)$/.test(operation);
}

export const INTERNATIONAL_NOT_ACTIVE = "International payments are not active yet. Supported destinations, recipient requirements, fees and payment tracking must be confirmed before money can be sent.";

/* ---------- Owner-confirmed corridors, fees and recovery rules (29 Oct 2026) ---------- */

export interface BeneficiaryField { name: string; label: string; pattern?: RegExp | undefined; hint?: string | undefined }
export interface Corridor { id: string; label: string; target: string; fields: BeneficiaryField[]; method?: string }

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

/** How each corridor's money arrives, shown in the market directory. */
const METHODS: Record<string, string> = { USD: "US bank transfer (ACH / wire)", GBP: "UK Faster Payments", EUR: "SEPA bank transfer", GHS: "Ghana bank transfer", KES: "Kenya bank transfer", ZAR: "South Africa EFT" };
export function corridorMethod(c: Corridor) { return c.method ?? METHODS[c.target] ?? "Bank transfer"; }

/** Reason for the payment, recorded on the receipt. */
export const PAYMENT_PURPOSES = ["Family support", "Education / tuition", "Business services", "Supplier / invoice payment", "Salary / payroll", "Personal savings", "Other"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/** Quotes are live estimates: re-priced after this window and re-confirmed at send time. */
export const QUOTE_TTL_MS = 60_000;
export function quoteSecondsLeft(quotedAt: number, now: number) { return Math.max(0, Math.ceil((quotedAt + QUOTE_TTL_MS - now) / 1000)); }

/** The send must debit exactly the total the user confirmed; any rate move needs a fresh confirmation. */
export function quoteStillMatches(confirmedTotal: number, freshTotal: number) {
  return Number.isFinite(confirmedTotal) && Number.isFinite(freshTotal) && Math.abs(confirmedTotal - freshTotal) <= 0.01;
}
export const QUOTE_CHANGED = "The exchange rate moved since you confirmed. Review the new total and confirm again — nothing was sent.";

export interface SavedRecipient { key: string; country: string; accountName: string; fields: Record<string, string>; lastUsed: string }
interface ReceiptLike { operation: string; status: string; created_at: string; summary?: Record<string, unknown> | null }
/** Recipients reused from the owner's own completed or pending international receipts (newest first, unique). */
export function savedRecipientsFrom(receipts: ReceiptLike[]): SavedRecipient[] {
  const out = new Map<string, SavedRecipient>();
  for (const r of receipts) {
    if (!isInternationalReceipt(r.operation) || r.status === "failed") continue;
    const b = r.summary?.["beneficiary"];
    if (!b || typeof b !== "object") continue;
    const bene = b as Record<string, unknown>;
    const country = typeof bene["country"] === "string" ? bene["country"] : "";
    const accountName = typeof bene["accountName"] === "string" ? bene["accountName"] : "";
    const corridor = corridorFor(country);
    if (!corridor || !accountName) continue;
    const fields: Record<string, string> = {};
    for (const fl of corridor.fields) { const v = bene[fl.name]; if (typeof v === "string") fields[fl.name] = v; }
    const key = `${country}|${accountName.toLowerCase()}|${corridor.fields.map((fl) => fields[fl.name] ?? "").join("|")}`;
    if (!out.has(key)) out.set(key, { key, country, accountName, fields, lastUsed: r.created_at });
  }
  return [...out.values()].slice(0, 8);
}

export type TrackStep = { label: string; state: "done" | "current" | "failed" | "todo" };
/** Timeline for one international payment, from its ledger receipt status. */
export function trackSteps(status: string): TrackStep[] {
  const failed = status === "failed", done = status === "succeeded";
  return [
    { label: "Created", state: "done" },
    { label: "Funds reserved", state: "done" },
    { label: "Sent to network", state: done || failed ? "done" : "current" },
    { label: failed ? "Declined — funds returned" : "Paid out", state: failed ? "failed" : done ? "done" : "todo" },
  ];
}

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
  if (target === "USD") return 10;
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
