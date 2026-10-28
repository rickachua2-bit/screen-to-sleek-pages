/** Live pricing and FX helpers. All figures come from the provider; nothing here is a hardcoded price. */

export interface FxRates { bid: Record<string, number>; ask: Record<string, number>; at: string }
export interface Rail { id: string; name: string; unit: string; price: string }

/** Provider sends X_NGN (naira you get selling 1 X) and NGN_X_PRICE (naira to buy 1 X). */
export function parseFxRates(raw: Record<string, unknown>, at = new Date().toISOString()): FxRates {
  const bid: Record<string, number> = { NGN: 1 }; const ask: Record<string, number> = { NGN: 1 };
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v); if (!(n > 0)) continue;
    let m = /^([A-Z]{3,4})_NGN$/.exec(k); if (m) { bid[m[1]!] = n; continue; }
    m = /^NGN_([A-Z]{3,4})_PRICE$/.exec(k); if (m) ask[m[1]!] = n;
  }
  for (const c of Object.keys(bid)) if (!ask[c]) ask[c] = bid[c]!;
  return { bid, ask, at };
}

/** Amount of `to` received for `amount` of `from`, at live rates (sell `from` at bid, buy `to` at ask). */
export function quoteSwap(from: string, to: string, amount: number, fx: FxRates) {
  const sell = fx.bid[from]; const buy = fx.ask[to];
  if (!(amount > 0) || !sell || !buy) return null;
  const out = (amount * sell) / buy;
  return { amount: out, rate: out / amount };
}

export function nairaValueLive(code: string, amount: number, fx: FxRates | null) {
  if (code === "NGN") return amount;
  const r = fx?.bid[code];
  return r ? Math.round(amount * r * 100) / 100 : null;
}

/** Which provider fee rail applies to each money movement. */
export function railFor(action: "send" | "withdraw" | "swap" | "receive", code: string, crypto: boolean) {
  if (action === "swap") return crypto ? "crypto_swap" : "fx_corridor_swap";
  if (action === "receive") return code === "NGN" ? "collections" : null;
  return ({ NGN: "payouts", GHS: "ghana_momo_b2c", KES: "kenya_mpesa_b2c", ZAR: "sa_rtc_payout", USD: "global_usd_ach", EUR: "global_eur_sepa", GBP: "global_gbp_fps" } as Record<string, string>)[code] ?? null;
}

/** The provider prices some rails flat per movement (e.g. ₦80 per NIP transfer); detect that from its own formula text. */
export function feeIsFlat(formula: string) { return /flat/i.test(formula); }

/** Pick the price text for the user's plan from a provider rail row. */
export function railPrice(row: Record<string, unknown>, plan: string): Rail {
  const p = plan.toLowerCase();
  const price = String(row[p] ?? row["starter"] ?? row["pricing"] ?? "");
  return { id: String(row["id"] ?? ""), name: String(row["name"] ?? ""), unit: String(row["unit"] ?? ""), price };
}
