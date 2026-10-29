import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LinkStatus = "paid" | "awaiting" | "failed" | "unknown";
export interface PaymentLinkView {
  reference: string;
  url: string;
  amount: number;
  currency: string;
  email: string;
  name: string | null;
  createdAt: string;
  status: LinkStatus;
}

const LINK_OP = "POST /v1/gateway/initialize";
const detailOp = (ref: string) => `${LINK_OP} ${ref}`;
const LINK_CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;

const createSchema = z.object({
  amount: z.number().positive().max(1e9),
  currency: z.enum(LINK_CURRENCIES),
  email: z.string().email().max(160),
  name: z.string().trim().max(120).optional(),
  reference: z.string().regex(/^SLKLINK-[0-9a-fA-F-]{36}$/),
});

/** Extracts the hosted checkout URL from whatever shape the service returns. */
function checkoutUrl(d: Record<string, unknown>): string | null {
  for (const k of ["authorization_url", "authorizationUrl", "checkout_url", "checkoutUrl", "payment_url", "paymentUrl", "url", "link"]) {
    const v = d[k];
    if (typeof v === "string" && v.startsWith("https://")) return v;
  }
  return null;
}

function parseDetail(raw: string): PaymentLinkView | null {
  try {
    const v = JSON.parse(raw) as Partial<PaymentLinkView>;
    if (typeof v.reference !== "string" || typeof v.url !== "string" || typeof v.amount !== "number" || typeof v.currency !== "string") return null;
    return {
      reference: v.reference,
      url: v.url,
      amount: v.amount,
      currency: v.currency,
      email: typeof v.email === "string" ? v.email : "",
      name: typeof v.name === "string" ? v.name : null,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
      status: "unknown",
    };
  } catch { return null; }
}

function settleStatus(d: Record<string, unknown>): LinkStatus {
  const raw = [d["status"], d["paymentStatus"], d["state"]].find((v) => typeof v === "string");
  const s = typeof raw === "string" ? raw.toUpperCase() : "";
  if (["SUCCESSFUL", "SUCCESS", "PAID", "COMPLETED", "SETTLED"].includes(s)) return "paid";
  if (["FAILED", "DECLINED", "REJECTED", "REVERSED", "EXPIRED", "ABANDONED"].includes(s)) return "failed";
  if (s) return "awaiting";
  return "unknown";
}

export const createPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<PaymentLinkView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before creating live payment links.");

    // Idempotent: replaying the same reference returns the original link.
    const prior = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", detailOp(data.reference)).maybeSingle();
    if (prior.error) throw new Error("Could not check existing links. Try again.");
    if (prior.data) {
      const existing = parseDetail(prior.data.resource_id);
      if (existing) return existing;
    }

    const result = await callPaddle(mode, "POST", "/v1/gateway/initialize", {
      amount: data.amount,
      currency: data.currency,
      email: data.email,
      ...(data.name ? { name: data.name } : {}),
      reference: data.reference,
    }, data.reference);
    const d = (result.data ?? {}) as Record<string, unknown>;
    const url = checkoutUrl(d);
    if (!url) throw new Error("The service did not return a checkout link. Try again.");

    const view: PaymentLinkView = {
      reference: data.reference,
      url,
      amount: data.amount,
      currency: data.currency,
      email: data.email,
      name: data.name ?? null,
      createdAt: new Date().toISOString(),
      status: "awaiting",
    };
    // Ownership row lets the user verify this reference; the detail row stores the link itself.
    const rows = await db.from("paddle_resources").upsert([
      { user_id: user.id, mode, resource_id: data.reference, operation: LINK_OP },
      { user_id: user.id, mode, resource_id: JSON.stringify(view), operation: detailOp(data.reference) },
    ], { onConflict: "mode,resource_id", ignoreDuplicates: true });
    if (rows.error) throw new Error("The link was created but could not be saved. Check your links before creating another.");
    return view;
  });

export const listPaymentLinks = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; links: PaymentLinkView[] }> => {
  const { bankingUser, callPaddle } = await import("./paddle.server");
  const { db, user, mode } = await bankingUser();
  const rows = await db.from("paddle_resources").select("resource_id, operation").eq("user_id", user.id).eq("mode", mode).like("operation", `${LINK_OP} %`).order("created_at", { ascending: false }).limit(25);
  if (rows.error) throw new Error("Your payment links could not be loaded. Try again.");
  const links = (rows.data ?? []).map((r) => parseDetail(r.resource_id)).filter((l): l is PaymentLinkView => l !== null);
  await Promise.all(links.map(async (l) => {
    try {
      const r = await callPaddle(mode, "GET", `/v1/gateway/verify/${encodeURIComponent(l.reference)}`);
      l.status = settleStatus((r.data ?? {}) as Record<string, unknown>);
    } catch { l.status = "unknown"; }
  }));
  return { mode, links };
});
