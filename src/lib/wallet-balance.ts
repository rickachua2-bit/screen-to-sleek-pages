// Pure parser for the connected provider's GET /v1/wallet/balance payload.
// Accepts only explicit numeric balances keyed by currency code; anything
// unrecognised yields null so callers never display a guessed figure.
const CODE = /^[A-Z]{3,4}$/;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

const entryAmount = (e: Record<string, unknown>): number | null =>
  num(e["availableBalance"]) ?? num(e["available"]) ?? num(e["balance"]) ?? num(e["amount"]);

function collect(list: unknown[], out: Record<string, number>) {
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const code = e["currency"] ?? e["code"] ?? e["wallet"];
    const amount = entryAmount(e);
    if (typeof code === "string" && CODE.test(code) && amount !== null) out[code] = amount;
  }
}

export function parseWalletBalances(payload: unknown): Record<string, number> | null {
  const out: Record<string, number> = {};
  if (Array.isArray(payload)) collect(payload, out);
  else if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const inner = o["balances"] ?? o["wallets"] ?? o["data"];
    if (Array.isArray(inner)) collect(inner, out);
    else if (inner && typeof inner === "object") collect([inner], out);
    for (const [k, v] of Object.entries(o)) {
      if (!CODE.test(k)) continue;
      const amount = v && typeof v === "object" ? entryAmount(v as Record<string, unknown>) : num(v);
      if (amount !== null) out[k] = amount;
    }
  }
  return Object.keys(out).length ? out : null;
}
