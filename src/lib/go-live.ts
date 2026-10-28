export type StepStatus = "not_started" | "submitted" | "verified" | "rejected";
export type GoLiveStep = { key: string; title: string; detail: string; auto?: boolean; tier?: number };
export type KycRow = { step: string; status: string; summary?: string | null };

export const MERCHANT_STEPS: GoLiveStep[] = [
  { key: "contacts", title: "Phone & email verified", detail: "Confirmed with one-time codes at sign-up.", auto: true },
  { key: "business_identity", title: "Business identity", detail: "Registry match plus certificate of incorporation and memorandum/articles." },
  { key: "tax_id", title: "Tax ID (TIN)", detail: "Your tax identification number, checked instantly.", auto: true },
  { key: "director_bvn", title: "Directors", detail: "BVN/NIN match, live selfie and ID for every director.", auto: true },
  { key: "beneficial_owners", title: "Beneficial owners", detail: "Everyone owning 25% or more, verified like directors." },
  { key: "operations", title: "Address & operations", detail: "Proof of address, website or socials, what you sell and expected volume." },
  { key: "settlement_account", title: "Settlement account", detail: "A corporate account whose name matches your registered business.", auto: true },
  { key: "compliance_review", title: "Compliance review", detail: "Sanctions/PEP screening, risk rating and approval by Slikpay compliance." },
];

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
