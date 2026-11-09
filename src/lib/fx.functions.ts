import { createServerFn } from "@tanstack/react-start";

/**
 * Live FX proxies for the public marketing site.
 * These forward to the Slikcash business API and return only what the
 * backend actually returns — no fallback or fabricated rates, ever.
 */

const FX_API_BASE = "https://business.slikcash.com";

async function fxFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${FX_API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(12_000),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`FX API ${path} failed [${res.status}]: ${body.slice(0, 500)}`);
    throw new Error(`Live FX service returned ${res.status}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    console.error(`FX API ${path} returned non-JSON: ${body.slice(0, 200)}`);
    throw new Error("Live FX service returned an unreadable response");
  }
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/* --------------------------------- rates --------------------------------- */

export type LiveFxRates = Record<string, number>;

export const getLiveFxRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rates: LiveFxRates; fetchedAt: string }> => {
    const data = (await fxFetch("/api/fx/rates")) as Record<string, unknown>;
    const source = (data?.["rates"] ?? data) as Record<string, unknown>;
    const rates: LiveFxRates = {};
    for (const [key, value] of Object.entries(source ?? {})) {
      const n = asNumber(value);
      if (n !== null) rates[key] = n;
    }
    if (Object.keys(rates).length === 0) throw new Error("Live FX service returned no rates");
    return { rates, fetchedAt: new Date().toISOString() };
  },
);

/* --------------------------------- quote --------------------------------- */

export interface LiveFxQuote {
  rate: number | null;
  sourceAmount: number | null;
  destinationAmount: number | null;
  platformFee: number | null;
  expiresAt: string | null;
}

export const getLiveFxQuote = createServerFn({ method: "POST" })
  .inputValidator((input: { fromCurrency: string; toCurrency: string; amount: number }) => input)
  .handler(async ({ data }): Promise<LiveFxQuote> => {
    const fromCurrency = String(data?.fromCurrency ?? "").toUpperCase().slice(0, 8);
    const toCurrency = String(data?.toCurrency ?? "").toUpperCase().slice(0, 8);
    const amount = Number(data?.amount);
    if (!fromCurrency || !toCurrency || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("A valid amount and currency pair are required.");
    }
    const raw = (await fxFetch("/api/fx/quote", {
      method: "POST",
      body: JSON.stringify({ fromCurrency, toCurrency, amount }),
    })) as Record<string, unknown>;
    const quote = (raw?.["quote"] ?? raw) as Record<string, unknown>;
    const destinationAmount = asNumber(quote?.["destinationAmount"]);
    if (destinationAmount === null) throw new Error("This corridor has no live quote right now.");
    return {
      rate: asNumber(quote?.["rate"] ?? quote?.["effectiveRate"]),
      sourceAmount: asNumber(quote?.["sourceAmount"]) ?? amount,
      destinationAmount,
      platformFee: asNumber(quote?.["platformFee"]),
      expiresAt: typeof quote?.["expiresAt"] === "string" ? quote["expiresAt"] : null,
    };
  });

/* -------------------------------- pricing -------------------------------- */

export type LiveFxPricingValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: string | number | boolean | null };
export type LiveFxPricing = Record<string, LiveFxPricingValue>;

export const getLiveFxPricing = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ pricing: LiveFxPricing; fetchedAt: string }> => {
    const data = (await fxFetch("/api/fx/pricing")) as Record<string, unknown>;
    const pricing = ((data?.["pricing"] ?? data?.["fees"] ?? data) ?? {}) as LiveFxPricing;
    if (typeof pricing !== "object" || Object.keys(pricing).length === 0) {
      throw new Error("Live FX service returned no pricing");
    }
    return { pricing, fetchedAt: new Date().toISOString() };
  },
);
