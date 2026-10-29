import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LINK_CURRENCIES, type LinkStatus } from "./checkout-links.server";

export interface InvoiceItem { description: string; quantity: number; unitPrice: number }
export interface InvoiceView {
  number: string;
  reference: string;
  url: string;
  customer: string;
  email: string;
  currency: string;
  items: InvoiceItem[];
  total: number;
  dueDate: string;
  note: string | null;
  createdAt: string;
  status: LinkStatus;
  overdue: boolean;
}

const INV_OP = "SLIKPAY invoice";
const invOp = (ref: string) => `${INV_OP} ${ref}`;

const itemSchema = z.object({
  description: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(1e6),
  unitPrice: z.number().positive().max(1e9),
});
const invoiceSchema = z.object({
  customer: z.string().trim().min(2).max(120),
  email: z.string().email().max(160),
  currency: z.enum(LINK_CURRENCIES),
  items: z.array(itemSchema).min(1).max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional(),
  reference: z.string().regex(/^SLKINV-[0-9a-fA-F-]{36}$/),
});

export function invoiceTotal(items: InvoiceItem[]) {
  return Math.round(items.reduce((a, i) => a + i.quantity * i.unitPrice, 0) * 100) / 100;
}

function parseInvoice(raw: string): InvoiceView | null {
  try {
    const v = JSON.parse(raw) as Partial<InvoiceView>;
    if (typeof v.reference !== "string" || typeof v.url !== "string" || typeof v.total !== "number" || !Array.isArray(v.items)) return null;
    return {
      number: typeof v.number === "string" ? v.number : v.reference,
      reference: v.reference,
      url: v.url,
      customer: typeof v.customer === "string" ? v.customer : "",
      email: typeof v.email === "string" ? v.email : "",
      currency: typeof v.currency === "string" ? v.currency : "NGN",
      items: v.items as InvoiceItem[],
      total: v.total,
      dueDate: typeof v.dueDate === "string" ? v.dueDate : "",
      note: typeof v.note === "string" ? v.note : null,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
      status: "unknown",
      overdue: false,
    };
  } catch { return null; }
}

export const createInvoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => invoiceSchema.parse(d))
  .handler(async ({ data }): Promise<InvoiceView> => {
    const { bankingUser } = await import("./paddle.server");
    const { hostedCheckout } = await import("./checkout-links.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before sending live invoices.");
    const total = invoiceTotal(data.items);
    if (total <= 0) throw new Error("Add at least one priced item.");
    const number = `INV-${data.reference.slice(7, 15).toUpperCase()}`;
    const { url } = await hostedCheckout(db, user, mode, {
      amount: total, currency: data.currency, email: data.email, name: data.customer,
      reference: data.reference, operation: invOp(data.reference),
    }, (u) => ({
      number, reference: data.reference, url: u, customer: data.customer, email: data.email,
      currency: data.currency, items: data.items, total, dueDate: data.dueDate,
      note: data.note ?? null, createdAt: new Date().toISOString(),
    }));
    return { number, reference: data.reference, url, customer: data.customer, email: data.email, currency: data.currency, items: data.items, total, dueDate: data.dueDate, note: data.note ?? null, createdAt: new Date().toISOString(), status: "awaiting", overdue: false };
  });

export const listInvoices = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; invoices: InvoiceView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails, verifyStatus } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const invoices = await listDetails(db, user.id, mode, INV_OP, parseInvoice, 50);
  const today = new Date().toISOString().slice(0, 10);
  await Promise.all(invoices.map(async (inv) => {
    inv.status = await verifyStatus(mode, inv.reference);
    inv.overdue = inv.status === "awaiting" && inv.dueDate < today;
  }));
  return { mode, invoices };
});
