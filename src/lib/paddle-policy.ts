import catalog from "./paddle-catalog";
import { CABLE_VALIDATE } from "./cable-tv";

export type PaddleField = { name: string; type: string; required?: boolean; enum?: string[]; example?: unknown; hint?: string };
export type PaddleEndpoint = { id: string; method: "GET" | "POST" | "DELETE"; path: string; tag: string; summary: string; fields: PaddleField[]; params: { name: string; in: string; required?: boolean }[] };
export type Scope = "reference" | "owned" | "create" | "platform" | "internal" | "sandbox";
export type Mode = "sandbox" | "live";
export type Role = "merchant" | "personal";

export const ENDPOINTS: PaddleEndpoint[] = [...catalog as PaddleEndpoint[], CABLE_VALIDATE];

export const CATEGORIES = [
  { id: "accounts", label: "Accounts & Banking", match: /^\/v1\/(accounts|open-banking)/ },
  { id: "collect", label: "Accept Payments", match: /^\/v1\/(gateway|disputes)/ },
  { id: "payouts", label: "Payouts & Transfers", match: /^\/v1\/(payouts|counterparties)/ },
  { id: "cards", label: "Cards", match: /^\/v1\/cards/ },
  { id: "bills", label: "Bills, Airtime & Tax", match: /^\/v1\/bills/ },
  { id: "flights", label: "Flights & Travel", match: /^\/v1\/flights/ },
  { id: "invest", label: "Investments", match: /^\/v1\/investments/ },
  { id: "crypto", label: "Crypto & FX", match: /^\/v1\/crypto/ },
  { id: "escrow", label: "Escrow", match: /^\/v1\/escrow/ },
  { id: "identity", label: "Identity & KYC", match: /^\/v1\/identity/ },
  { id: "treasury", label: "Treasury & Ledger", match: /^\/v1\/(treasury|wallet|ledger)/ },
  { id: "pricing", label: "Pricing", match: /^\/v1\/pricing/ },
  { id: "platform", label: "Platform & Team", match: /./ },
] as const;

export function categoryOf(path: string) {
  return CATEGORIES.find((c) => c.match.test(path))!.id;
}

// Public catalogue reads with no customer data: safe for any signed-in user.
const REFERENCE = /^\/v1\/(accounts\/banks|bills\/(airtime\/operators|betting\/operators|cable\/plans|data\/plans|electricity\/discos|giftcards|internet\/providers|tolls|education\/pins)|flights\/(airports|health)|investments\/(markets|assets|quotes\/\{symbol\}|yields)|pricing(\/plans|\/current)?|build-with-us\/services)$/;
// Platform-wide reads/settings that would expose every Slikpay customer's data or shared funds.
const PLATFORM = /^\/v1\/(audit|logs|overview|history|idempotency|ledger|wallet|treasury|security|team|integrations|support|messaging|pricing\/subscribe|test\/webhooks|build-with-us\/inquire)/;
const INTERNAL = /^\/v1\/otp\//;
const SANDBOX_ONLY = /^\/v1\/test\/simulate-inbound$/;
const MONEY = /\/(payouts|cards\/create|cards$|fund|withdraw|topup|recharge|renew|purchase|pay$|order$|orders$|swap|release|refunds?|book-transfer|charge|allocate)(\/|$)/;

export function scopeOf(e: Pick<PaddleEndpoint, "method" | "path">): Scope {
  // Authenticated customer inquiry; never register returned identifiers as owned resources.
  if (e.method === "POST" && (e.path === CABLE_VALIDATE.path || e.path === "/v1/bills/betting/validate")) return "reference";
  if (INTERNAL.test(e.path)) return "internal";
  if (SANDBOX_ONLY.test(e.path)) return "sandbox";
  if (e.method === "GET" && REFERENCE.test(e.path)) return "reference";
  if (PLATFORM.test(e.path)) return "platform";
  if (e.path.includes("{")) return "owned";
  if (e.method === "GET") return "platform"; // unscoped lists return all customers' records
  return "create";
}

export function movesMoney(e: Pick<PaddleEndpoint, "method" | "path">) {
  return e.method === "POST" && MONEY.test(e.path);
}

const PERSONAL_CATS = new Set(["accounts", "payouts", "cards", "bills", "flights", "invest", "crypto", "identity", "pricing"]);
const PERSONAL_BLOCK = /^\/v1\/(payouts\/bulk|payouts\/global|accounts\/domiciliary|identity\/(cac|credit-bureau|vehicle-plate|address\/physical|ip-intelligence|email-intelligence|sim-swap|phone-intelligence))/;

export type Access = { allowed: true } | { allowed: false; reason: string };

export function accessFor(e: Pick<PaddleEndpoint, "method" | "path">, role: Role, mode: Mode): Access {
  const scope = scopeOf(e);
  if (scope === "internal") return { allowed: false, reason: "Used internally by Slikpay sign-in." };
  if (scope === "platform") return { allowed: false, reason: "Slikpay operations team only — shows all customers' data." };
  if (scope === "sandbox" && mode !== "sandbox") return { allowed: false, reason: "Only available in sandbox." };
  if (role === "personal" && (!PERSONAL_CATS.has(categoryOf(e.path)) || PERSONAL_BLOCK.test(e.path))) return { allowed: false, reason: "Business accounts only." };
  return { allowed: true };
}

export function amountOf(body: Record<string, unknown>) {
  const a = body["amount"] ?? body["totalAmount"] ?? body["fromAmount"];
  const n = typeof a === "string" ? Number(a) : a;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function fillPath(path: string, params: Record<string, string>) {
  return path.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    if (!v || !/^[A-Za-z0-9_.:-]{1,80}$/.test(v)) throw new Error(`Enter a valid ${k}.`);
    return encodeURIComponent(v);
  });
}

const ID_KEYS = ["id", "cardId", "accountNumber", "reference", "escrowId", "orderId", "accountId", "searchId", "ticketId", "milestoneId", "symbol", "address"];
export function resourceIds(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (!value || typeof value !== "object" || depth > 4) return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (ID_KEYS.includes(k) && (typeof v === "string" || typeof v === "number")) out.add(String(v));
    else if (typeof v === "object") resourceIds(v, out, depth + 1);
  }
  return out;
}
