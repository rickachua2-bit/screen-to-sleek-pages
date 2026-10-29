import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LINK_CURRENCIES, LINK_OP, type LinkStatus } from "./checkout-links.server";

export type { LinkStatus } from "./checkout-links.server";
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

const detailOp = (ref: string) => `${LINK_OP} ${ref}`;

const createSchema = z.object({
  amount: z.number().positive().max(1e9),
  currency: z.enum(LINK_CURRENCIES),
  email: z.string().email().max(160),
  name: z.string().trim().max(120).optional(),
  reference: z.string().regex(/^SLKLINK-[0-9a-fA-F-]{36}$/),
});

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

export const createPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<PaymentLinkView> => {
    const { bankingUser } = await import("./paddle.server");
    const { hostedCheckout } = await import("./checkout-links.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before creating live payment links.");
    const { url } = await hostedCheckout(db, user, mode, {
      amount: data.amount, currency: data.currency, email: data.email, name: data.name,
      reference: data.reference, operation: detailOp(data.reference),
    }, (u) => ({
      reference: data.reference, url: u, amount: data.amount, currency: data.currency,
      email: data.email, name: data.name ?? null, createdAt: new Date().toISOString(),
    }));
    return { reference: data.reference, url, amount: data.amount, currency: data.currency, email: data.email, name: data.name ?? null, createdAt: new Date().toISOString(), status: "awaiting" };
  });

export const listPaymentLinks = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; links: PaymentLinkView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails, verifyStatus } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const links = await listDetails(db, user.id, mode, LINK_OP, parseDetail, 25);
  await Promise.all(links.map(async (l) => { l.status = await verifyStatus(mode, l.reference); }));
  return { mode, links };
});
