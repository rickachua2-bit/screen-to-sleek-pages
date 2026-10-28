import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exactPayoutFee } from "./transfer-validation";
import { parseFxRates, railPrice, type FxRates, type Rail } from "./pricing";

/** Live FX rates and fee rails for the signed-in user's plan and mode. */
export const getLivePricing = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser, callPaddle } = await import("./paddle.server");
  const { mode } = await bankingUser();
  const [fx, pricing, current] = await Promise.allSettled([
    callPaddle(mode, "GET", "/v1/fx/rates"),
    callPaddle(mode, "GET", "/v1/pricing"),
    callPaddle(mode, "GET", "/v1/pricing/current"),
  ]);
  // fx/rates returns `rates` at the top level, not under data.
  let rates: FxRates | null = null;
  if (fx.status === "fulfilled") {
    const d = fx.value.data as Record<string, unknown> | null;
    const raw = (d && typeof d["rates"] === "object" ? d["rates"] : d) as Record<string, unknown> | null;
    if (raw) { const r = parseFxRates(raw); if (Object.keys(r.bid).length > 1) rates = r; }
  }
  const plan = current.status === "fulfilled" ? String((current.value.data as Record<string, unknown> | null)?.["currentPlan"] ?? "starter") : "starter";
  const rails: Record<string, Rail> = {};
  if (pricing.status === "fulfilled") for (const row of ((pricing.value.data as { rails?: Record<string, unknown>[] } | null)?.rails ?? [])) { const r = railPrice(row, plan); if (r.id) rails[r.id] = r; }
  return { rates, rails, plan };
});

/** Exact fee for one movement, from the provider's calculator. */
export const quoteFee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ rail: z.string().regex(/^[a-z_]{3,40}$/), amount: z.number().positive().max(1e12) }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { mode } = await bankingUser();
    const r = await callPaddle(mode, "POST", "/v1/pricing/calculate", { rail: data.rail, amount: data.amount });
    const d = (r.data ?? {}) as Record<string, unknown>;
    // The calculator falls back to a generic rate for unknown rails; only trust it when it echoes our rail.
    if (d["rail"] !== data.rail) return null;
    const fee = data.rail === "payouts" ? exactPayoutFee(d) : Number(d["fee"]);
    if (!Number.isFinite(fee) || fee < 0) throw new Error("Fees are unavailable. Try again.");
    return { fee, net: Number(d["netAmount"]) || 0, description: String(d["description"] ?? "").slice(0, 160), currency: String(d["currency"] ?? "") };
  });
