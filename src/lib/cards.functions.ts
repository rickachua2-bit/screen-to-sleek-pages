import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CARD_OP = "CARD";
export const CARD_BRANDS = ["MASTERCARD", "VISA"] as const;
export const CARD_CURRENCIES = ["USD", "NGN"] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];
export type CardCurrency = (typeof CARD_CURRENCIES)[number];

export interface CardControls {
  online: boolean;
  atm: boolean;
  international: boolean;
  spendingLimit: number;
}

export interface CardView {
  id: string;
  holderName: string;
  brand: CardBrand;
  currency: CardCurrency;
  balance: number;
  last4: string;
  status: "active" | "frozen" | "unknown";
  controls: CardControls;
  createdAt: string;
}

export interface CardTxn {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  at: string;
}

const issueSchema = z.object({
  holderName: z.string().trim().min(2).max(120),
  brand: z.enum(CARD_BRANDS),
  currency: z.enum(CARD_CURRENCIES),
  amount: z.number().min(0).max(1e9).optional(),
  spendingLimit: z.number().positive().max(1e9).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  reference: z.string().regex(/^SLKCARD-[0-9a-fA-F-]{36}$/),
});

const cardIdSchema = z.object({ cardId: z.string().trim().min(3).max(80) });
const fundSchema = cardIdSchema.extend({
  amount: z.number().positive().max(1e9),
  pin: z.string().regex(/^\d{4}$/).optional(),
  reference: z.string().regex(/^SLKCF-[0-9a-fA-F-]{36}$/),
});
const withdrawSchema = cardIdSchema.extend({
  amount: z.number().positive().max(1e9),
  pin: z.string().regex(/^\d{4}$/).optional(),
});
const freezeSchema = cardIdSchema.extend({ frozen: z.boolean() });
const controlsSchema = cardIdSchema.extend({
  online: z.boolean(),
  atm: z.boolean(),
  international: z.boolean(),
  spendingLimit: z.number().positive().max(1e9),
});
const revealSchema = cardIdSchema.extend({ pin: z.string().regex(/^\d{4}$/).optional() });

const DEFAULT_CONTROLS: CardControls = { online: true, atm: false, international: true, spendingLimit: 0 };

function parseCard(raw: string): CardView | null {
  try {
    const v = JSON.parse(raw) as Partial<CardView>;
    if (typeof v.id !== "string" || typeof v.holderName !== "string") return null;
    const c = v.controls as Partial<CardControls> | undefined;
    return {
      id: v.id,
      holderName: v.holderName,
      brand: (CARD_BRANDS as readonly string[]).includes(v.brand as string) ? (v.brand as CardBrand) : "MASTERCARD",
      currency: (CARD_CURRENCIES as readonly string[]).includes(v.currency as string) ? (v.currency as CardCurrency) : "USD",
      balance: typeof v.balance === "number" ? v.balance : 0,
      last4: typeof v.last4 === "string" ? v.last4 : "••••",
      status: v.status === "active" || v.status === "frozen" ? v.status : "unknown",
      controls: {
        online: c?.online !== false,
        atm: c?.atm === true,
        international: c?.international !== false,
        spendingLimit: typeof c?.spendingLimit === "number" ? c.spendingLimit : 0,
      },
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    };
  } catch {
    return null;
  }
}

type Ctx = Awaited<ReturnType<typeof import("./paddle.server").bankingUser>>;

async function readCard(ctx: Ctx, cardId: string): Promise<CardView> {
  const row = await ctx.db
    .from("paddle_resources")
    .select("resource_id")
    .eq("user_id", ctx.user.id)
    .eq("mode", ctx.mode)
    .eq("operation", `${CARD_OP} ${cardId}`)
    .maybeSingle();
  if (row.error || !row.data) throw new Error("That card was not found on this account.");
  const parsed = parseCard(row.data.resource_id);
  if (!parsed) throw new Error("That card record is damaged. Contact support.");
  return parsed;
}

async function writeCard(ctx: Ctx, card: CardView): Promise<void> {
  const row = await ctx.db
    .from("paddle_resources")
    .update({ resource_id: JSON.stringify(card) })
    .eq("user_id", ctx.user.id)
    .eq("mode", ctx.mode)
    .eq("operation", `${CARD_OP} ${card.id}`);
  if (row.error) throw new Error("The card update could not be saved. Check the card before retrying.");
}

const str = (d: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** Issues a virtual Mastercard or Visa. An optional initial amount is reserved from the wallet first, atomically. */
export const issueCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => issueSchema.parse(d))
  .handler(async ({ data }): Promise<CardView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { guardMoney, settleMoney } = await import("./wallets.server");
    const ctx = await bankingUser();
    if (ctx.mode === "live" && ctx.review !== "approved") throw new Error("Complete verification before issuing live cards.");

    const prior = await ctx.db
      .from("paddle_resources")
      .select("resource_id")
      .eq("user_id", ctx.user.id)
      .eq("mode", ctx.mode)
      .eq("operation", `CARDREF ${data.reference}`)
      .maybeSingle();
    if (prior.error) throw new Error("Could not check existing cards. Try again.");
    if (prior.data) {
      const existing = parseCard(prior.data.resource_id);
      if (existing) return existing;
    }

    const funding = data.amount && data.amount > 0 ? data.amount : 0;
    if (funding > 0) await guardMoney(ctx, data.currency, funding, data.pin, `CARD ISSUE ${data.reference}`, data.reference);

    let d: Record<string, unknown>;
    try {
      const r = await callPaddle(
        ctx.mode,
        "POST",
        "/v1/cards/create",
        {
          cardHolderName: data.holderName,
          customerEmail: ctx.user.email,
          brand: data.brand,
          currency: data.currency,
          ...(funding > 0 ? { amount: funding } : {}),
          ...(data.spendingLimit ? { spendingLimit: data.spendingLimit } : {}),
        },
        data.reference,
      );
      d = (r.data ?? {}) as Record<string, unknown>;
    } catch (e) {
      if (funding > 0) {
        try {
          await settleMoney(ctx, data.reference, "failed", null, { error: "Card issuance did not complete" });
        } catch {
          /* reconciliation will resolve */
        }
      }
      throw e;
    }

    const id = str(d, "cardId", "id", "reference");
    if (!id) {
      if (funding > 0) {
        try {
          await settleMoney(ctx, data.reference, "pending", null, { note: "Card issuance uncertain; awaiting confirmation" });
        } catch {
          /* reconciliation will resolve */
        }
      }
      throw new Error("The service did not confirm this card. Check your cards before issuing another.");
    }
    if (funding > 0) await settleMoney(ctx, data.reference, "succeeded", id, { cardId: id, brand: data.brand });

    const pan = str(d, "pan", "cardNumber", "maskedPan");
    const view: CardView = {
      id,
      holderName: data.holderName,
      brand: data.brand,
      currency: data.currency,
      balance: Number(d["balance"]) || funding,
      last4: pan ? pan.replace(/\s/g, "").slice(-4) : str(d, "last4", "lastFour") ?? "••••",
      status: "active",
      controls: { ...DEFAULT_CONTROLS, spendingLimit: data.spendingLimit ?? 0 },
      createdAt: new Date().toISOString(),
    };
    const rows = await ctx.db.from("paddle_resources").upsert(
      [
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: id, operation: "POST /v1/cards/create" },
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: JSON.stringify(view), operation: `${CARD_OP} ${id}` },
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: JSON.stringify(view), operation: `CARDREF ${data.reference}` },
      ],
      { onConflict: "mode,resource_id", ignoreDuplicates: true },
    );
    if (rows.error) throw new Error("The card was issued but could not be saved. Check your cards before issuing another.");
    return view;
  });

/** Lists this account's cards, newest first. */
export const listCards = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; cards: CardView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails } = await import("./checkout-links.server");
  const ctx = await bankingUser();
  const cards = await listDetails(ctx.db, ctx.user.id, ctx.mode, CARD_OP, parseCard, 50);
  return { mode: ctx.mode, cards };
});

/** Funds a card from the wallet: exact atomic reservation first, then the provider top-up. */
export const fundCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fundSchema.parse(d))
  .handler(async ({ data }): Promise<CardView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { guardMoney, settleMoney } = await import("./wallets.server");
    const { UNCERTAIN_PAYMENT } = await import("./wallet-safety");
    const ctx = await bankingUser();
    const card = await readCard(ctx, data.cardId);
    if (card.status === "frozen") throw new Error("Unfreeze this card before funding it.");

    const operation = `CARD FUND ${card.id}`;
    const readReceipt = async () => {
      const r = await ctx.db
        .from("payment_receipts")
        .select("operation,currency,amount,status")
        .eq("user_id", ctx.user.id)
        .eq("mode", ctx.mode)
        .eq("idempotency_key", data.reference)
        .maybeSingle();
      if (r.error) throw new Error("Could not check the original top-up. No new top-up was submitted.");
      if (r.data && (r.data.operation !== operation || r.data.currency !== card.currency || Number(r.data.amount) !== data.amount)) {
        throw new Error("This reference belongs to a different payment.");
      }
      return r.data;
    };
    let receipt = await readReceipt();
    if (receipt?.status === "succeeded") return card;
    if (receipt?.status === "failed") throw new Error("This top-up was declined earlier. Check your ledger.");
    if (!receipt) {
      try {
        await guardMoney(ctx, card.currency, data.amount, data.pin, operation, data.reference);
      } catch (error) {
        receipt = await readReceipt();
        if (!receipt) throw error;
      }
    }
    if (receipt?.status === "pending") throw new Error(UNCERTAIN_PAYMENT);

    let settled = false;
    try {
      await callPaddle(ctx.mode, "POST", `/v1/cards/${encodeURIComponent(card.id)}/fund`, { amount: data.amount }, data.reference);
      settled = true;
      await settleMoney(ctx, data.reference, "succeeded", card.id, { cardId: card.id, brand: card.brand });
      card.balance = Math.round((card.balance + data.amount) * 100) / 100;
      await writeCard(ctx, card);
      return card;
    } catch (e) {
      if (!settled) {
        try {
          await settleMoney(ctx, data.reference, "pending", card.id, { cardId: card.id, note: "Top-up dispatched; awaiting confirmation" });
        } catch {
          /* reconciliation will resolve */
        }
        throw new Error(UNCERTAIN_PAYMENT);
      }
      throw e;
    }
  });

/** Moves money from the card back to the wallet. Requires the transaction PIN on live accounts. */
export const withdrawCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withdrawSchema.parse(d))
  .handler(async ({ data }): Promise<CardView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { authorizeMoney } = await import("./wallets.server");
    const ctx = await bankingUser();
    const card = await readCard(ctx, data.cardId);
    if (data.amount > card.balance) throw new Error("That is more than this card holds.");
    await authorizeMoney(ctx, data.pin);
    await callPaddle(ctx.mode, "POST", `/v1/cards/${encodeURIComponent(card.id)}/withdraw`, { amount: data.amount }, `card-withdraw-${card.id}-${crypto.randomUUID()}`);
    card.balance = Math.round((card.balance - data.amount) * 100) / 100;
    await writeCard(ctx, card);
    return card;
  });

/** Freezes or unfreezes a card instantly. */
export const setCardFrozen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => freezeSchema.parse(d))
  .handler(async ({ data }): Promise<CardView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    const card = await readCard(ctx, data.cardId);
    if ((card.status === "frozen") === data.frozen) return card;
    await callPaddle(ctx.mode, "POST", `/v1/cards/${encodeURIComponent(card.id)}/freeze`, { frozen: data.frozen }, `card-freeze-${card.id}-${data.frozen ? "on" : "off"}`);
    card.status = data.frozen ? "frozen" : "active";
    await writeCard(ctx, card);
    return card;
  });

/** Updates spending controls: online payments, ATM, international and the spending limit. */
export const updateCardControls = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => controlsSchema.parse(d))
  .handler(async ({ data }): Promise<CardView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    const card = await readCard(ctx, data.cardId);
    await callPaddle(
      ctx.mode,
      "POST",
      `/v1/cards/${encodeURIComponent(card.id)}/controls`,
      { online: data.online, atm: data.atm, international: data.international, spendingLimit: data.spendingLimit },
      `card-controls-${card.id}-${Date.now()}`,
    );
    card.controls = { online: data.online, atm: data.atm, international: data.international, spendingLimit: data.spendingLimit };
    await writeCard(ctx, card);
    return card;
  });

/** Reveals the full card number, CVV and expiry once. PIN-required on live accounts; never stored or logged. */
export const revealCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => revealSchema.parse(d))
  .handler(async ({ data }): Promise<{ pan: string; cvv: string; expiry: string; billingAddress: string }> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { authorizeMoney } = await import("./wallets.server");
    const ctx = await bankingUser();
    await readCard(ctx, data.cardId);
    await authorizeMoney(ctx, data.pin);
    const r = await callPaddle(ctx.mode, "GET", `/v1/cards/${encodeURIComponent(data.cardId)}/secure-data`);
    const d = (r.data ?? {}) as Record<string, unknown>;
    const pan = str(d, "pan", "cardNumber", "number");
    const cvv = str(d, "cvv", "cvc", "securityCode");
    const expiry = str(d, "expiry", "expiryDate", "expiration");
    if (!pan || !cvv || !expiry) throw new Error("Card details are unavailable right now. Try again shortly.");
    return { pan, cvv, expiry, billingAddress: str(d, "billingAddress", "address") ?? "" };
  });

/** Lists a card's transactions, newest first. */
export const cardTransactions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardIdSchema.parse(d))
  .handler(async ({ data }): Promise<{ transactions: CardTxn[] }> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    await readCard(ctx, data.cardId);
    const r = await callPaddle(ctx.mode, "GET", `/v1/cards/${encodeURIComponent(data.cardId)}/transactions`);
    const d = (r.data ?? {}) as Record<string, unknown>;
    const list = (Array.isArray(d) ? d : Array.isArray(d["transactions"]) ? d["transactions"] : Array.isArray(d["data"]) ? d["data"] : []) as Record<string, unknown>[];
    const transactions: CardTxn[] = list.slice(0, 50).map((t, i) => ({
      id: str(t, "id", "reference") ?? `txn-${i}`,
      description: str(t, "description", "merchant", "narration") ?? "Card payment",
      amount: Number(t["amount"]) || 0,
      currency: str(t, "currency") ?? "",
      status: (str(t, "status") ?? "unknown").toUpperCase(),
      at: str(t, "createdAt", "date", "at") ?? "",
    }));
    return { transactions };
  });
