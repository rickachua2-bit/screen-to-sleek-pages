import type { Mode, Role } from "./paddle-policy";

export type ServiceStatus = "available" | "sandbox" | "verify" | "business";
export type CategoryId = "move" | "paid" | "cards" | "bills" | "gov" | "grow" | "travel" | "business" | "dev";

export const SERVICE_CATEGORIES: { id: CategoryId; label: string; blurb: string }[] = [
  { id: "move", label: "Move money", blurb: "Transfers, bulk payouts and international" },
  { id: "paid", label: "Get paid", blurb: "Links, invoices, QR, escrow and mandates" },
  { id: "cards", label: "Cards", blurb: "Virtual and physical cards with spend controls" },
  { id: "bills", label: "Pay bills", blurb: "Airtime, data, power, TV, betting and education" },
  { id: "gov", label: "Government & tax", blurb: "Federal tax and Remita payments" },
  { id: "grow", label: "Grow money", blurb: "Treasury, US and Nigerian stocks" },
  { id: "travel", label: "Travel", blurb: "Search and book flights" },
  { id: "business", label: "Business tools", blurb: "Team, approvals, statements and disputes" },
  { id: "dev", label: "Developers", blurb: "API keys, webhooks and the full console" },
];

export interface OptionItem { value: string; label: string; item: Record<string, unknown> }
export interface FlowField {
  name: string; label: string; kind: "text" | "phone" | "amount" | "select" | "email" | "date";
  placeholder?: string; pattern?: RegExp; patternHint?: string;
  /** For selects: catalog id of the list call, optional query builder and item mapper. */
  options?: { op: string; query?: (v: Record<string, string>) => Record<string, string> | null; pick?: (data: unknown) => unknown[]; map: (i: Record<string, unknown>) => OptionItem | null; dependsOn?: string };
  /** Fixed choices, no lookup needed. */
  choices?: { value: string; label: string }[];
  /** When a picked option carries a price, prefill the amount from it. */
  setsAmount?: (i: Record<string, unknown>) => number | null;
}
export interface Flow {
  fields: FlowField[];
  validate?: { op: string; body: (v: Record<string, string>, p: Record<string, Record<string, unknown>>) => Record<string, unknown>; show: string[] };
  pay: { op: string; body: (v: Record<string, string>, p: Record<string, Record<string, unknown>>) => Record<string, unknown>; verb: string };
  /** Result fields to surface on the receipt (e.g. electricity token). */
  receipt?: string[];
  fee?: (p: Record<string, Record<string, unknown>>) => number | null;
}
export interface ServiceDef {
  id: string; label: string; category: CategoryId; keywords: string; icon: string;
  businessOnly?: boolean; flow?: Flow; module?: string; note?: string;
}

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const list = (d: unknown): unknown[] => (Array.isArray(d) ? d : Array.isArray((d as { plans?: unknown })?.plans) ? (d as { plans: unknown[] }).plans : []);
const biller = (i: Record<string, unknown>): OptionItem | null => (str(i["code"]) ? { value: str(i["id"]) || str(i["code"]), label: str(i["shortName"]) || str(i["name"]), item: i } : null);
const phone: FlowField = { name: "phone", label: "Phone number", kind: "phone", placeholder: "080 0000 0000", pattern: /^0\d{10}$/, patternHint: "11-digit number starting with 0" };
const amount: FlowField = { name: "amount", label: "Amount (₦)", kind: "amount", placeholder: "0.00" };
const code = (p: Record<string, Record<string, unknown>>, k: string) => str(p[k]?.["code"]);
const item = (p: Record<string, Record<string, unknown>>, k: string) => str(p[k]?.["itemCode"]);
const n = (v: string) => Number(v);

export const SERVICES: ServiceDef[] = [
  // Move money
  { id: "send", label: "Bank transfer", category: "move", keywords: "send transfer pay nip bank naira", icon: "Send", module: "banking" },
  { id: "bulk", label: "Bulk payouts", category: "move", keywords: "bulk payroll salaries many", icon: "Users", module: "payroll", businessOnly: true },
  { id: "intl", label: "International transfer", category: "move", keywords: "international global abroad ghana kenya usd gbp eur send", icon: "Globe", module: "treasury" },
  { id: "swap", label: "Swap currencies", category: "move", keywords: "swap exchange fx convert usdt usdc", icon: "Repeat", module: "treasury" },
  // Get paid
  { id: "links", label: "Payment links & invoices", category: "paid", keywords: "link invoice request collect get paid", icon: "Link2", module: "links" },
  { id: "qr", label: "QR & SmartTag", category: "paid", keywords: "qr tag scan in-store", icon: "QrCode", module: "smarttag", businessOnly: true },
  { id: "softpos", label: "SoftPOS", category: "paid", keywords: "pos tap card terminal phone", icon: "Smartphone", module: "softpos", businessOnly: true },
  { id: "mandates", label: "Direct debits", category: "paid", keywords: "mandate debit recurring subscription", icon: "Repeat", module: "mandates", businessOnly: true },
  {
    id: "escrow", label: "Escrow", category: "paid", keywords: "escrow safe trade hold release milestone", icon: "ShieldCheck",
    flow: {
      fields: [{ name: "title", label: "What is this deal for?", kind: "text", placeholder: "Supply of 200 bags of rice" }, { name: "buyer", label: "Buyer email", kind: "email" }, { name: "seller", label: "Seller email", kind: "email" }, { ...amount, name: "totalAmount", label: "Deal amount (₦)" }],
      pay: { op: "post-escrow-create", verb: "Open escrow", body: (v) => ({ title: v["title"], totalAmount: n(v["totalAmount"] ?? ""), currency: "NGN", buyer: { email: v["buyer"] }, seller: { email: v["seller"] }, milestones: [{ title: "Full delivery", amount: n(v["totalAmount"] ?? "") }] }) },
      receipt: ["id", "escrowId", "status"],
    },
  },
  // Cards
  { id: "cards", label: "Virtual & physical cards", category: "cards", keywords: "card virtual physical usd dollar spend freeze", icon: "CreditCard", module: "cards" },
  // Bills
  {
    id: "airtime", label: "Airtime", category: "bills", keywords: "airtime recharge mtn glo airtel 9mobile vtu top up", icon: "Phone",
    flow: {
      fields: [phone, { name: "operator", label: "Network", kind: "select", options: { op: "get-bills-airtime-operators", map: (i) => (i["isAirtime"] ? biller(i) : null) } }, amount],
      pay: { op: "post-bills-airtime-topup", verb: "Buy airtime", body: (v, p) => ({ operatorId: Number(str(p["operator"]?.["id"])) || str(p["operator"]?.["id"]), amount: n(v["amount"] ?? ""), phone: v["phone"] }) },
    },
  },
  {
    id: "data", label: "Mobile data", category: "bills", keywords: "data bundle internet mtn glo airtel", icon: "Wifi",
    flow: { fields: [phone, amount], pay: { op: "post-bills-data-purchase", verb: "Buy data", body: (v) => ({ phone: v["phone"], amount: n(v["amount"] ?? "") }) } },
  },
  {
    id: "power", label: "Electricity", category: "bills", keywords: "electricity power light nepa disco prepaid postpaid meter token ikeja eko abuja", icon: "Zap",
    flow: {
      fields: [{ name: "disco", label: "Electricity company", kind: "select", options: { op: "get-bills-electricity-discos", map: biller } }, { name: "meterNumber", label: "Meter number", kind: "text", pattern: /^\d{10,13}$/, patternHint: "10 to 13 digits" }, amount],
      validate: { op: "post-bills-electricity-validate", show: ["customerName", "address", "meterType", "disco", "minimumAmount"], body: (v, p) => ({ meterNumber: v["meterNumber"], billerCode: code(p, "disco"), itemCode: item(p, "disco") }) },
      pay: { op: "post-bills-electricity-recharge", verb: "Buy electricity", body: (v, p) => ({ meterNumber: v["meterNumber"], billerCode: code(p, "disco"), itemCode: item(p, "disco"), amount: n(v["amount"] ?? "") }) },
      receipt: ["token", "units", "meterNumber"],
    },
  },
  {
    id: "tv", label: "Cable TV", category: "bills", keywords: "cable tv dstv gotv startimes showmax subscription", icon: "Tv",
    flow: {
      fields: [
        { name: "provider", label: "Provider", kind: "select", choices: [{ value: "dstv", label: "DStv" }, { value: "gotv", label: "GOtv" }, { value: "startimes", label: "StarTimes" }] },
        { name: "plan", label: "Package", kind: "select", options: { op: "get-bills-cable-plans", dependsOn: "provider", query: (v) => (v["provider"] ? { provider: v["provider"] } : null), pick: list, map: (i) => ({ value: str(i["itemCode"]) || str(i["id"]), label: `${str(i["name"])} · ₦${Number(i["amount"] ?? 0).toLocaleString()}`, item: i }) }, setsAmount: (i) => Number(i["amount"]) || null },
        { name: "smartCardNumber", label: "Smartcard / IUC number", kind: "text", pattern: /^\d{8,12}$/, patternHint: "8 to 12 digits" },
        amount,
      ],
      pay: { op: "post-bills-cable-renew", verb: "Renew subscription", body: (v, p) => ({ smartCardNumber: v["smartCardNumber"], amount: n(v["amount"] ?? ""), billerCode: str(p["plan"]?.["billerCode"]), itemCode: item(p, "plan") }) },
      fee: (p) => Number(p["plan"]?.["fee"]) || null,
    },
  },
  {
    id: "internet", label: "Home internet", category: "bills", keywords: "internet broadband smile spectranet hynet wifi", icon: "Router",
    flow: {
      fields: [{ name: "provider", label: "Provider", kind: "select", options: { op: "get-bills-internet-providers", map: biller } }, { name: "accountId", label: "Account or device ID", kind: "text" }, amount],
      pay: { op: "post-bills-internet-purchase", verb: "Pay internet", body: (v, p) => ({ accountId: v["accountId"], billerCode: code(p, "provider"), itemCode: item(p, "provider"), amount: n(v["amount"] ?? "") }) },
    },
  },
  {
    id: "betting", label: "Betting wallet", category: "bills", keywords: "betting bet9ja sportybet betking 1xbet fund", icon: "Trophy",
    flow: {
      fields: [{ name: "operator", label: "Platform", kind: "select", options: { op: "get-bills-betting-operators", map: biller } }, { name: "customerId", label: "Customer / user ID", kind: "text" }, amount],
      validate: { op: "post-bills-betting-validate", show: ["customerName", "billerName", "status"], body: (v, p) => ({ operator: code(p, "operator"), customerId: v["customerId"] }) },
      pay: { op: "post-bills-betting-fund", verb: "Fund wallet", body: (v, p) => ({ operator: code(p, "operator"), customerId: v["customerId"], amount: n(v["amount"] ?? "") }) },
    },
  },
  {
    id: "education", label: "Exam PINs", category: "bills", keywords: "education waec jamb neco exam pin result checker school", icon: "GraduationCap",
    flow: {
      fields: [{ name: "exam", label: "Exam", kind: "select", options: { op: "get-bills-education-pins", map: biller } }, phone, amount],
      pay: { op: "post-bills-education-purchase", verb: "Buy PIN", body: (v, p) => ({ billerCode: code(p, "exam"), phone: v["phone"], amount: n(v["amount"] ?? "") }) },
      receipt: ["pin", "serialNumber"],
    },
  },
  // Government
  {
    id: "firs", label: "Federal tax (FIRS)", category: "gov", keywords: "tax firs vat cit tin assessment government", icon: "Landmark", businessOnly: true,
    flow: {
      fields: [{ name: "tin", label: "TIN or assessment number", kind: "text" }, amount],
      validate: { op: "post-bills-firs-validate", show: ["taxpayerName", "customerName", "taxType", "amount"], body: (v) => ({ tin: v["tin"] }) },
      pay: { op: "post-bills-firs-pay", verb: "Pay tax", body: (v) => ({ tin: v["tin"], amount: n(v["amount"] ?? "") }) },
    },
  },
  {
    id: "remita", label: "Remita (RRR)", category: "gov", keywords: "remita rrr government fees state revenue customs", icon: "FileText",
    flow: {
      fields: [{ name: "rrr", label: "Remita Retrieval Reference (RRR)", kind: "text", pattern: /^\d{12}$/, patternHint: "12 digits" }, amount],
      validate: { op: "post-bills-remita-validate", show: ["payerName", "description", "amount"], body: (v) => ({ rrr: v["rrr"] }) },
      pay: { op: "post-bills-remita-pay", verb: "Pay RRR", body: (v) => ({ rrr: v["rrr"], amount: n(v["amount"] ?? "") }) },
    },
  },
  // Grow
  { id: "treasury", label: "Treasury & FX", category: "grow", keywords: "treasury savings yield fx", icon: "PiggyBank", module: "treasury" },
  { id: "stocks", label: "US & Nigerian stocks", category: "grow", keywords: "invest stocks shares apple tesla ngx equities", icon: "TrendingUp", module: "developer", note: "Opens in the advanced console while the guided screen is built." },
  // Travel
  { id: "flights", label: "Flights", category: "travel", keywords: "flight ticket travel airline book", icon: "Plane", module: "developer", note: "Opens in the advanced console while the guided screen is built." },
  // Business
  { id: "approvals", label: "Approvals", category: "business", keywords: "approve maker checker team", icon: "UserCheck", module: "approvals", businessOnly: true },
  { id: "statements", label: "Statements", category: "business", keywords: "statement audit export csv pdf", icon: "FileText", module: "statements" },
  { id: "disputes", label: "Disputes", category: "business", keywords: "dispute chargeback refund", icon: "Scale", module: "disputes", businessOnly: true },
  { id: "team", label: "Team & security", category: "business", keywords: "team roles users settings 2fa", icon: "Settings", module: "settings", businessOnly: true },
  // Developers
  { id: "dev", label: "API console", category: "dev", keywords: "api developer webhook keys console advanced", icon: "Code2", module: "developer", businessOnly: true },
];

export function serviceStatus(s: Pick<ServiceDef, "businessOnly">, ctx: { role: Role; mode: Mode; review: string }): ServiceStatus {
  if (s.businessOnly && ctx.role === "personal") return "business";
  if (ctx.mode === "sandbox") return "sandbox";
  if (ctx.review !== "approved") return "verify";
  return "available";
}

export const STATUS_LABEL: Record<ServiceStatus, string> = { available: "Available", sandbox: "Sandbox", verify: "Verify to unlock", business: "Business only" };

export function searchServices(q: string, items: ServiceDef[] = SERVICES) {
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t && !["pay", "my", "a", "to", "buy", "for"].includes(t));
  if (!terms.length) return items;
  return items.filter((s) => { const hay = `${s.label} ${s.keywords}`.toLowerCase(); return terms.every((t) => hay.includes(t)); });
}

export function reviewTotal(amount: number, fee: number | null) {
  const f = fee && fee > 0 ? fee : 0;
  return { amount, fee: f, total: Math.round((amount + f) * 100) / 100 };
}
