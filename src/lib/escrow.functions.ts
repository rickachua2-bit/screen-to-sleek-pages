import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ESCROW_OP = "ESCROW";
export const ESCROW_CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;
export type EscrowCurrency = (typeof ESCROW_CURRENCIES)[number];

export type EscrowStatus = "created" | "funded" | "released" | "disputed" | "refunded" | "unknown";
export type MilestoneStatus = "pending" | "released";

export interface EscrowMilestone {
  id: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
}

export interface EscrowView {
  id: string;
  reference: string;
  title: string;
  amount: number;
  currency: EscrowCurrency;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  milestones: EscrowMilestone[];
  status: EscrowStatus;
  createdAt: string;
}

const party = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(160),
});

const milestoneInput = z.object({
  title: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1e12),
});

const createSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    amount: z.number().positive().max(1e12),
    currency: z.enum(ESCROW_CURRENCIES),
    buyer: party,
    seller: party,
    milestones: z.array(milestoneInput).min(1).max(12),
    reference: z.string().regex(/^SLKESC-[0-9a-fA-F-]{36}$/),
  })
  .superRefine((v, ctx) => {
    const sum = v.milestones.reduce((s, m) => s + m.amount, 0);
    if (Math.abs(sum - v.amount) > 0.01) {
      ctx.addIssue({ code: "custom", message: "Milestone amounts must add up to the deal amount." });
    }
  });

const idSchema = z.object({ escrowId: z.string().trim().min(3).max(80) });
const fundSchema = idSchema.extend({ pin: z.string().regex(/^\d{4}$/).optional() });
const releaseSchema = fundSchema.extend({ milestoneId: z.string().trim().min(1).max(80) });
const disputeSchema = idSchema.extend({ reason: z.string().trim().min(4).max(280) });

/** Maps whatever status string the service returns onto our lifecycle. */
export function escrowStatus(value: unknown): EscrowStatus {
  const s = typeof value === "string" ? value.toUpperCase() : "";
  if (["FUNDED", "LOCKED", "ACTIVE", "IN_ESCROW"].includes(s)) return "funded";
  if (["RELEASED", "COMPLETED", "SETTLED", "PAID_OUT"].includes(s)) return "released";
  if (["DISPUTED", "DISPUTE", "UNDER_REVIEW"].includes(s)) return "disputed";
  if (["REFUNDED", "REVERSED", "CANCELLED", "CANCELED"].includes(s)) return "refunded";
  if (["CREATED", "OPEN", "PENDING", "AWAITING_FUNDING"].includes(s)) return "created";
  return "unknown";
}

function parseEscrow(raw: string): EscrowView | null {
  try {
    const v = JSON.parse(raw) as Partial<EscrowView>;
    if (typeof v.id !== "string" || typeof v.title !== "string" || typeof v.amount !== "number") return null;
    const milestones = Array.isArray(v.milestones)
      ? v.milestones
          .map((m) => {
            const x = m as Partial<EscrowMilestone>;
            if (typeof x.id !== "string" || typeof x.title !== "string" || typeof x.amount !== "number") return null;
            return { id: x.id, title: x.title, amount: x.amount, status: x.status === "released" ? ("released" as const) : ("pending" as const) };
          })
          .filter((m): m is EscrowMilestone => m !== null)
      : [];
    return {
      id: v.id,
      reference: typeof v.reference === "string" ? v.reference : "",
      title: v.title,
      amount: v.amount,
      currency: (ESCROW_CURRENCIES as readonly string[]).includes(v.currency as string) ? (v.currency as EscrowCurrency) : "NGN",
      buyerName: typeof v.buyerName === "string" ? v.buyerName : "",
      buyerEmail: typeof v.buyerEmail === "string" ? v.buyerEmail : "",
      sellerName: typeof v.sellerName === "string" ? v.sellerName : "",
      sellerEmail: typeof v.sellerEmail === "string" ? v.sellerEmail : "",
      milestones,
      status: (["created", "funded", "released", "disputed", "refunded"] as const).includes(v.status as never) ? (v.status as EscrowStatus) : "unknown",
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    };
  } catch {
    return null;
  }
}

type Ctx = Awaited<ReturnType<typeof import("./paddle.server").bankingUser>>;

async function readEscrow(ctx: Ctx, escrowId: string): Promise<EscrowView> {
  const row = await ctx.db
    .from("paddle_resources")
    .select("resource_id")
    .eq("user_id", ctx.user.id)
    .eq("mode", ctx.mode)
    .eq("operation", `${ESCROW_OP} ${escrowId}`)
    .maybeSingle();
  if (row.error || !row.data) throw new Error("That escrow deal was not found on this account.");
  const parsed = parseEscrow(row.data.resource_id);
  if (!parsed) throw new Error("That escrow record is damaged. Contact support.");
  return parsed;
}

async function writeEscrow(ctx: Ctx, e: EscrowView): Promise<void> {
  const row = await ctx.db
    .from("paddle_resources")
    .update({ resource_id: JSON.stringify(e) })
    .eq("user_id", ctx.user.id)
    .eq("mode", ctx.mode)
    .eq("operation", `${ESCROW_OP} ${e.id}`);
  if (row.error) throw new Error("The escrow update could not be saved. Check the deal before retrying.");
}

/** Opens a multi-milestone escrow contract. Replaying the same reference returns the original deal. */
export const createEscrow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<EscrowView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    if (ctx.role !== "merchant") throw new Error("Escrow is available on business accounts.");
    if (ctx.mode === "live" && ctx.review !== "approved") throw new Error("Complete verification before opening live escrow deals.");

    const prior = await ctx.db
      .from("paddle_resources")
      .select("resource_id")
      .eq("user_id", ctx.user.id)
      .eq("mode", ctx.mode)
      .eq("operation", `ESCROWREF ${data.reference}`)
      .maybeSingle();
    if (prior.error) throw new Error("Could not check existing deals. Try again.");
    if (prior.data) {
      const existing = parseEscrow(prior.data.resource_id);
      if (existing) return existing;
    }

    const r = await callPaddle(
      ctx.mode,
      "POST",
      "/v1/escrow/create",
      {
        title: data.title,
        totalAmount: data.amount,
        currency: data.currency,
        buyer: data.buyer,
        seller: data.seller,
        milestones: data.milestones,
      },
      data.reference,
    );
    const d = (r.data ?? {}) as Record<string, unknown>;
    const rawId = d["escrowId"] ?? d["id"] ?? d["reference"];
    if (typeof rawId !== "string" || !rawId.trim()) throw new Error("The service did not confirm this escrow. Check your deals before creating another.");
    const id = rawId.trim();

    const rawMilestones = Array.isArray(d["milestones"]) ? (d["milestones"] as Record<string, unknown>[]) : [];
    const milestones: EscrowMilestone[] = data.milestones.map((m, i) => {
      const rm = rawMilestones[i];
      const rid = rm && (typeof rm["id"] === "string" ? rm["id"] : typeof rm["milestoneId"] === "string" ? rm["milestoneId"] : null);
      return { id: rid ?? `ms-${i + 1}`, title: m.title, amount: m.amount, status: "pending" };
    });

    const view: EscrowView = {
      id,
      reference: data.reference,
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      buyerName: data.buyer.name,
      buyerEmail: data.buyer.email,
      sellerName: data.seller.name,
      sellerEmail: data.seller.email,
      milestones,
      status: escrowStatus(d["status"]) === "unknown" ? "created" : escrowStatus(d["status"]),
      createdAt: new Date().toISOString(),
    };
    const rows = await ctx.db.from("paddle_resources").upsert(
      [
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: id, operation: "POST /v1/escrow/create" },
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: JSON.stringify(view), operation: `${ESCROW_OP} ${id}` },
        { user_id: ctx.user.id, mode: ctx.mode, resource_id: JSON.stringify(view), operation: `ESCROWREF ${data.reference}` },
      ],
      { onConflict: "mode,resource_id", ignoreDuplicates: true },
    );
    if (rows.error) throw new Error("The escrow was created but could not be saved. Check your deals before creating another.");
    return view;
  });

/** Lists this account's escrow deals, merging live status from the service when reachable. */
export const listEscrows = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; escrows: EscrowView[] }> => {
  const { bankingUser, callPaddle } = await import("./paddle.server");
  const { listDetails } = await import("./checkout-links.server");
  const ctx = await bankingUser();
  const escrows = await listDetails(ctx.db, ctx.user.id, ctx.mode, ESCROW_OP, parseEscrow, 50);
  try {
    const r = await callPaddle(ctx.mode, "GET", "/v1/escrow");
    const d = (r.data ?? {}) as Record<string, unknown>;
    const list = (Array.isArray(d) ? d : Array.isArray(d["escrows"]) ? d["escrows"] : Array.isArray(d["data"]) ? d["data"] : []) as Record<string, unknown>[];
    const live = new Map<string, EscrowStatus>();
    for (const item of list) {
      const id = item["escrowId"] ?? item["id"];
      if (typeof id === "string") live.set(id, escrowStatus(item["status"]));
    }
    for (const e of escrows) {
      const s = live.get(e.id);
      if (s && s !== "unknown") e.status = s;
    }
  } catch {
    // Live status unreachable: stored lifecycle state is shown as-is.
  }
  return { mode: ctx.mode, escrows };
});

/**
 * Locks the deal amount into the escrow trust vault.
 * The amount is reserved atomically first; an uncertain outcome keeps the reservation pending — never a double debit.
 */
export const fundEscrow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fundSchema.parse(d))
  .handler(async ({ data }): Promise<EscrowView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { guardMoney, settleMoney } = await import("./wallets.server");
    const { UNCERTAIN_PAYMENT } = await import("./wallet-safety");
    const ctx = await bankingUser();
    const escrow = await readEscrow(ctx, data.escrowId);
    if (escrow.status === "funded" || escrow.status === "released") return escrow;
    if (escrow.status === "disputed" || escrow.status === "refunded") throw new Error("This deal is closed and cannot be funded.");

    const reference = `escrow-fund-${escrow.id}`;
    const operation = `ESCROW FUND ${escrow.id}`;
    const readReceipt = async () => {
      const r = await ctx.db
        .from("payment_receipts")
        .select("operation,currency,amount,status")
        .eq("user_id", ctx.user.id)
        .eq("mode", ctx.mode)
        .eq("idempotency_key", reference)
        .maybeSingle();
      if (r.error) throw new Error("Could not check the original funding. No new funding was submitted.");
      if (r.data && (r.data.operation !== operation || r.data.currency !== escrow.currency || Number(r.data.amount) !== escrow.amount)) {
        throw new Error("This reference belongs to a different payment.");
      }
      return r.data;
    };
    let receipt = await readReceipt();
    if (receipt?.status === "succeeded") {
      escrow.status = "funded";
      await writeEscrow(ctx, escrow);
      return escrow;
    }
    if (receipt?.status === "failed") throw new Error("This funding was declined earlier. Check your ledger.");
    if (!receipt) {
      try {
        await guardMoney(ctx, escrow.currency, escrow.amount, data.pin, operation, reference);
      } catch (error) {
        receipt = await readReceipt();
        if (!receipt) throw error;
      }
    }
    if (receipt?.status === "pending") throw new Error(UNCERTAIN_PAYMENT);

    let settled = false;
    try {
      await callPaddle(ctx.mode, "POST", `/v1/escrow/${encodeURIComponent(escrow.id)}/fund`, { amount: escrow.amount, currency: escrow.currency }, reference);
      settled = true;
      await settleMoney(ctx, reference, "succeeded", escrow.id, { escrowId: escrow.id, title: escrow.title });
      escrow.status = "funded";
      await writeEscrow(ctx, escrow);
      return escrow;
    } catch (e) {
      if (!settled) {
        try {
          await settleMoney(ctx, reference, "pending", escrow.id, { escrowId: escrow.id, note: "Funding dispatched; awaiting confirmation" });
        } catch {
          /* reconciliation will resolve */
        }
        throw new Error(UNCERTAIN_PAYMENT);
      }
      throw e;
    }
  });

/** Releases one milestone payout to the seller. Requires the transaction PIN on live accounts. */
export const releaseMilestone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => releaseSchema.parse(d))
  .handler(async ({ data }): Promise<EscrowView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { authorizeMoney } = await import("./wallets.server");
    const ctx = await bankingUser();
    const escrow = await readEscrow(ctx, data.escrowId);
    if (escrow.status !== "funded") throw new Error("Only a funded deal can release milestones.");
    const milestone = escrow.milestones.find((m) => m.id === data.milestoneId);
    if (!milestone) throw new Error("That milestone was not found on this deal.");
    if (milestone.status === "released") return escrow;
    await authorizeMoney(ctx, data.pin);
    await callPaddle(
      ctx.mode,
      "POST",
      `/v1/escrow/${encodeURIComponent(escrow.id)}/milestones/${encodeURIComponent(milestone.id)}/release`,
      {},
      `escrow-release-${escrow.id}-${milestone.id}`,
    );
    milestone.status = "released";
    if (escrow.milestones.every((m) => m.status === "released")) escrow.status = "released";
    await writeEscrow(ctx, escrow);
    return escrow;
  });

/** Opens a dispute on a funded deal. Funds stay locked while the dispute is reviewed. */
export const disputeEscrow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => disputeSchema.parse(d))
  .handler(async ({ data }): Promise<EscrowView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    const escrow = await readEscrow(ctx, data.escrowId);
    if (escrow.status !== "funded") throw new Error("Only a funded deal can be disputed.");
    await callPaddle(ctx.mode, "POST", `/v1/escrow/${encodeURIComponent(escrow.id)}/dispute`, { reason: data.reason }, `escrow-dispute-${escrow.id}`);
    escrow.status = "disputed";
    await writeEscrow(ctx, escrow);
    return escrow;
  });

/** Refunds a funded deal back to the buyer. Requires the transaction PIN on live accounts. */
export const refundEscrow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fundSchema.parse(d))
  .handler(async ({ data }): Promise<EscrowView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { authorizeMoney } = await import("./wallets.server");
    const ctx = await bankingUser();
    const escrow = await readEscrow(ctx, data.escrowId);
    if (escrow.status !== "funded" && escrow.status !== "disputed") throw new Error("Only a funded or disputed deal can be refunded.");
    await authorizeMoney(ctx, data.pin);
    await callPaddle(ctx.mode, "POST", `/v1/escrow/${encodeURIComponent(escrow.id)}/refund`, {}, `escrow-refund-${escrow.id}`);
    escrow.status = "refunded";
    await writeEscrow(ctx, escrow);
    return escrow;
  });
