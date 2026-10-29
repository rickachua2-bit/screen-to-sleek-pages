import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GLOBAL_SOURCES, PAYMENT_PURPOSES } from "./international";

export type { GlobalQuote, GlobalPayoutResult } from "./global-payout.server";

const beneficiary = z.record(z.string().max(40), z.string().max(200));
const base = z.object({
  sourceCurrency: z.enum(GLOBAL_SOURCES),
  country: z.string().regex(/^[A-Z]{2}$/),
  accountName: z.string().trim().min(2).max(160),
  amount: z.number().positive().max(1e12),
  beneficiary,
});

/** Live quote for one cross-border payout: rate, fee and the exact total debit, before anything is reserved. */
export const quoteGlobalPayout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => base.parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { buildGlobalQuote } = await import("./global-payout.server");
    const ctx = await bankingUser();
    if (ctx.role !== "merchant") throw new Error("Cross-border payments are available on business accounts.");
    const { quote } = await buildGlobalQuote(ctx, data);
    return quote;
  });

/** Submits one global payout with an exact reservation and owner-confirmed timeout recovery. */
export const sendGlobalPayout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => base.extend({ pin: z.string().regex(/^\d{4}$/).optional(), idempotencyKey: z.string().uuid(), confirmedTotal: z.number().positive().max(1e13).optional(), purpose: z.enum(PAYMENT_PURPOSES).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { executeGlobalPayout } = await import("./global-payout.server");
    const ctx = await bankingUser();
    if (ctx.role !== "merchant") throw new Error("Cross-border payments are available on business accounts.");
    return executeGlobalPayout(ctx, data);
  });

/** Recovery: queries the original payment key and settles only confirmed outcomes. */
export const checkGlobalPayout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ idempotencyKey: z.string().uuid(), confirmedTotal: z.number().positive().max(1e13).optional(), purpose: z.enum(PAYMENT_PURPOSES).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { checkGlobalPayoutStatus } = await import("./global-payout.server");
    const ctx = await bankingUser();
    return checkGlobalPayoutStatus(ctx, data.idempotencyKey);
  });

/** Reconciles pending global payouts against the provider status endpoint. */
export const reconcileGlobalPayoutsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { reconcileGlobalPayouts } = await import("./global-payout.server");
  const ctx = await bankingUser();
  return reconcileGlobalPayouts(ctx);
});
