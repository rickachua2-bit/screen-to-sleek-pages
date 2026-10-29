import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LinkStatus } from "./checkout-links.server";

export const DEBIT_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type DebitCurrency = (typeof DEBIT_CURRENCIES)[number];
export const DEBIT_OP = "DIRECTDEBIT";

export interface DirectDebitView {
  reference: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: DebitCurrency;
  description: string;
  accountHint: string;
  createdAt: string;
  status: LinkStatus;
}

const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

const createSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().email().max(160),
    amount: z.number().positive().max(1e9),
    currency: z.enum(DEBIT_CURRENCIES),
    description: z.string().trim().max(140).optional(),
    routingNumber: z.string().trim().regex(/^\d{9}$/, "US routing numbers are 9 digits.").optional(),
    accountNumber: z.string().trim().regex(/^\d{4,17}$/, "Use 4-17 digits.").optional(),
    iban: z.string().trim().toUpperCase().regex(IBAN, "Enter a valid IBAN.").optional(),
    sortCode: z.string().trim().regex(/^\d{6}$/, "UK sort codes are 6 digits.").optional(),
    reference: z.string().regex(/^SLKDD-[0-9a-fA-F-]{36}$/),
  })
  .superRefine((v, ctx) => {
    if (v.currency === "USD" && (!v.routingNumber || !v.accountNumber)) {
      ctx.addIssue({ code: "custom", message: "US debits need a 9-digit routing number and account number." });
    }
    if (v.currency === "EUR" && !v.iban) {
      ctx.addIssue({ code: "custom", message: "EU debits need the customer's IBAN." });
    }
    if (v.currency === "GBP" && (!v.sortCode || !v.accountNumber)) {
      ctx.addIssue({ code: "custom", message: "UK debits need a 6-digit sort code and account number." });
    }
  });

function accountHint(v: z.infer<typeof createSchema>): string {
  if (v.currency === "EUR" && v.iban) return `IBAN ···${v.iban.slice(-4)}`;
  if (v.accountNumber) return `Acct ···${v.accountNumber.slice(-4)}`;
  return "Bank account";
}

function parseDebit(raw: string): DirectDebitView | null {
  try {
    const v = JSON.parse(raw) as Partial<DirectDebitView>;
    if (typeof v.reference !== "string" || typeof v.customerEmail !== "string" || typeof v.amount !== "number") return null;
    return {
      reference: v.reference,
      customerName: typeof v.customerName === "string" ? v.customerName : "",
      customerEmail: v.customerEmail,
      amount: v.amount,
      currency: (DEBIT_CURRENCIES as readonly string[]).includes(v.currency as string) ? (v.currency as DebitCurrency) : "USD",
      description: typeof v.description === "string" ? v.description : "",
      accountHint: typeof v.accountHint === "string" ? v.accountHint : "Bank account",
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
      status: "unknown",
    };
  } catch { return null; }
}

/**
 * Charges a customer's bank account by direct debit (US ACH, EU SEPA, UK Bacs).
 * Replaying the same reference returns the original record without charging twice.
 */
export const createDirectDebit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<DirectDebitView> => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before collecting live direct debits.");
    const op = `${DEBIT_OP} ${data.reference}`;
    const prior = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", op).maybeSingle();
    if (prior.error) throw new Error("Could not check existing debits. Try again.");
    if (prior.data) {
      const existing = parseDebit(prior.data.resource_id);
      if (existing) return existing;
    }
    const body: Record<string, unknown> = {
      amount: data.amount,
      currency: data.currency,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
    };
    if (data.currency === "USD") { body["routingNumber"] = data.routingNumber; body["accountNumber"] = data.accountNumber; }
    if (data.currency === "EUR") body["iban"] = data.iban;
    if (data.currency === "GBP") { body["sortCode"] = data.sortCode; body["accountNumber"] = data.accountNumber; }
    await callPaddle(mode, "POST", "/v1/gateway/bank-debit/charge", body, data.reference);
    const view: DirectDebitView = {
      reference: data.reference,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      amount: data.amount,
      currency: data.currency,
      description: data.description ?? "",
      accountHint: accountHint(data),
      createdAt: new Date().toISOString(),
      status: "awaiting",
    };
    const row = await db.from("paddle_resources").upsert([
      { user_id: user.id, mode, resource_id: data.reference, operation: "POST /v1/gateway/bank-debit/charge" },
      { user_id: user.id, mode, resource_id: JSON.stringify(view), operation: op },
    ], { onConflict: "mode,resource_id", ignoreDuplicates: true });
    if (row.error) throw new Error("The debit was sent but could not be saved. Check your records before charging again.");
    return view;
  });

export const listDirectDebits = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; debits: DirectDebitView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails, verifyStatus } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const debits = await listDetails(db, user.id, mode, DEBIT_OP, parseDebit, 50);
  await Promise.all(debits.map(async (d) => { d.status = await verifyStatus(mode, d.reference); }));
  return { mode, debits };
});
