export type StepStatus = "not_started" | "submitted" | "verified" | "rejected";
export type GoLiveStep = { key: string; title: string; detail: string; auto?: boolean; tier?: number };
export type KycRow = { step: string; status: string; summary?: string | null };

export const MERCHANT_STEPS: GoLiveStep[] = [
  { key: "contacts", title: "Phone & email", detail: "Confirmed with one-time codes at sign-up.", auto: true },
  { key: "business_identity", title: "Business identity", detail: "Captured from your registry verification at sign-up.", auto: true },
  { key: "director_bvn", title: "Directors", detail: "Verify at least one director with their BVN.", auto: true },
  { key: "beneficial_owners", title: "Beneficial owners", detail: "Everyone owning 25% or more, verified by BVN.", auto: true },
  { key: "operations", title: "Address & web presence", detail: "Business address plus your website or social pages." },
  { key: "settlement_account", title: "Settlement account", detail: "A bank account in your registered business name.", auto: true },
  { key: "two_factor", title: "Two-factor authentication", detail: "Secure sign-in with Google Authenticator." },
];

const SUFFIX: [RegExp, string][] = [[/\blimited\b/g, "ltd"], [/\bnigeria\b/g, "nig"], [/\bcompany\b/g, "co"], [/\bpublic limited company\b/g, "plc"], [/\benterprises?\b/g, "ent"], [/\band\b/g, "&"]];
export function normaliseName(n: string) {
  let s = n.toLowerCase().replace(/[.,'"()\-_/]/g, " ");
  for (const [re, to] of SUFFIX) s = s.replace(re, to);
  return s.replace(/&/g, " & ").replace(/\s+/g, " ").trim();
}
// Banks and collection providers often tag sub-accounts with a short prefix, e.g. "FIN-ACME LTD" or "FLW/ACME LTD".
const TAG = /^\s*[a-z0-9]{2,12}\s*[-/:|]\s*/i;
export function namesMatch(account: string, business: string) {
  const b = normaliseName(business);
  if (!b) return false;
  return normaliseName(account) === b || normaliseName(account.replace(TAG, "")) === b;
}

export const PERSONAL_STEPS: GoLiveStep[] = [
  { key: "contacts", title: "Phone & email verified", detail: "Confirmed with one-time codes.", auto: true, tier: 1 },
  { key: "personal_bvn", title: "BVN or NIN match", detail: "Legal name and date of birth matched to your BVN/NIN.", auto: true, tier: 1 },
  { key: "liveness", title: "Live selfie", detail: "Liveness check matched to your BVN/NIN photo, plus home address.", tier: 2 },
  { key: "government_id", title: "Government ID & proof of address", detail: "Passport, driver's licence or voter's card, and a utility bill under 3 months old.", tier: 3 },
  { key: "compliance_review", title: "Slikpay review", detail: "Sanctions and PEP screening before live mode." },
];

export const stepsFor = (role: "merchant" | "personal") => (role === "merchant" ? MERCHANT_STEPS : PERSONAL_STEPS);

export function statusOf(step: GoLiveStep, kyc: KycRow[], review?: string | null): StepStatus {
  if (step.key === "contacts") return "verified";
  if (step.key === "compliance_review") return review === "approved" ? "verified" : review === "rejected" ? "rejected" : review === "pending" ? "submitted" : "not_started";
  const row = kyc.find((k) => k.step === step.key);
  if (!row) return "not_started";
  if (row.status === "verified") return "verified";
  if (row.status === "failed" || row.status === "rejected") return "rejected";
  return "submitted";
}

export function progress(role: "merchant" | "personal", kyc: KycRow[], review?: string | null) {
  const steps = stepsFor(role);
  const done = steps.filter((s) => statusOf(s, kyc, review) === "verified").length;
  return { done, total: steps.length, canGoLive: done === steps.length };
}

/** Highest personal tier whose steps (and all lower tiers) are verified. 0 = not verified yet. */
export function personalTier(kyc: KycRow[]) {
  let tier = 0;
  for (const t of [1, 2, 3]) { const steps = PERSONAL_STEPS.filter((s) => s.tier === t); if (steps.length && steps.every((s) => statusOf(s, kyc) === "verified")) tier = t; else break; }
  return tier;
}
/** Daily limits known from the brief; other tiers are set at approval. */

