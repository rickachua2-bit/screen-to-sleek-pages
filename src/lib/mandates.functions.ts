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

function bankDetailRefine(v: { currency: string; routingNumber?: string | undefined; accountNumber?: string | undefined; iban?: string | undefined; sortCode?: string | undefined }, ctx: z.RefinementCtx) {
  if (v.currency === "USD" && (!v.routingNumber || !v.accountNumber)) {
    ctx.addIssue({ code: "custom", message: "US debits need a 9-digit routing number and account number." });
  }
  if (v.currency === "EUR" && !v.iban) {
    ctx.addIssue({ code: "custom", message: "EU debits need the customer's IBAN." });
  }
  if (v.currency === "GBP" && (!v.sortCode || !v.accountNumber)) {
    ctx.addIssue({ code: "custom", message: "UK debits need a 6-digit sort code and account number." });
  }
}

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
  .superRefine(bankDetailRefine);

function accountHint(v: { currency: string; accountNumber?: string | undefined; iban?: string | undefined }): string {
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

type DebitInput = z.infer<typeof createSchema>;
type Db = Awaited<ReturnType<typeof import("./paddle.server").bankingUser>>["db"];

/** Shared direct-debit charge: idempotent by reference, stores the record durably. */
async function chargeDebit(db: Db, userId: string, mode: "sandbox" | "live", data: DebitInput): Promise<DirectDebitView> {
  const { callPaddle } = await import("./paddle.server");
  const op = `${DEBIT_OP} ${data.reference}`;
  const prior = await db.from("paddle_resources").select("resource_id").eq("user_id", userId).eq("mode", mode).eq("operation", op).maybeSingle();
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
    { user_id: userId, mode, resource_id: data.reference, operation: "POST /v1/gateway/bank-debit/charge" },
    { user_id: userId, mode, resource_id: JSON.stringify(view), operation: op },
  ], { onConflict: "mode,resource_id", ignoreDuplicates: true });
  if (row.error) throw new Error("The debit was sent but could not be saved. Check your records before charging again.");
  return view;
}

/**
 * Charges a customer's bank account by direct debit (US ACH, EU SEPA, UK Bacs).
 * Replaying the same reference returns the original record without charging twice.
 */
export const createDirectDebit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<DirectDebitView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before collecting live direct debits.");
    return chargeDebit(db, user.id, mode, data);
  });

export const listDirectDebits = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; debits: DirectDebitView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails, verifyStatus } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const debits = await listDetails(db, user.id, mode, DEBIT_OP, parseDebit, 50);
  await Promise.all(debits.map(async (d) => { d.status = await verifyStatus(mode, d.reference); }));
  return { mode, debits };
});

// ---- Billing schedules ----

export const SCHEDULE_OP = "BILLINGSCHEDULE";
export const SCHEDULE_FREQUENCIES = ["weekly", "monthly"] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export interface BillingScheduleView {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: DebitCurrency;
  description: string;
  accountHint: string;
  frequency: ScheduleFrequency;
  nextRun: string;
  active: boolean;
  runs: number;
  createdAt: string;
}

/** Stored record includes the bank details needed to execute; the public view never exposes them. */
interface StoredSchedule extends BillingScheduleView {
  routingNumber?: string | undefined;
  accountNumber?: string | undefined;
  iban?: string | undefined;
  sortCode?: string | undefined;
}

const scheduleSchema = createSchema.innerType().omit({ reference: true }).extend({
  frequency: z.enum(SCHEDULE_FREQUENCIES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
}).superRefine(bankDetailRefine);

const scheduleIdSchema = z.object({ id: z.string().regex(/^SLKSCH-[0-9a-fA-F-]{36}$/) });
const scheduleActiveSchema = scheduleIdSchema.extend({ active: z.boolean() });

export function nextRunDate(from: Date, frequency: ScheduleFrequency): string {
  const d = new Date(from);
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

function toView(s: StoredSchedule): BillingScheduleView {
  return {
    id: s.id, customerName: s.customerName, customerEmail: s.customerEmail, amount: s.amount, currency: s.currency,
    description: s.description, accountHint: s.accountHint, frequency: s.frequency, nextRun: s.nextRun,
    active: s.active, runs: s.runs, createdAt: s.createdAt,
  };
}

function parseSchedule(raw: string): StoredSchedule | null {
  try {
    const v = JSON.parse(raw) as Partial<StoredSchedule>;
    if (typeof v.id !== "string" || typeof v.customerEmail !== "string" || typeof v.amount !== "number" || typeof v.nextRun !== "string") return null;
    return {
      id: v.id,
      customerName: typeof v.customerName === "string" ? v.customerName : "",
      customerEmail: v.customerEmail,
      amount: v.amount,
      currency: (DEBIT_CURRENCIES as readonly string[]).includes(v.currency as string) ? (v.currency as DebitCurrency) : "USD",
      description: typeof v.description === "string" ? v.description : "",
      accountHint: typeof v.accountHint === "string" ? v.accountHint : "Bank account",
      frequency: v.frequency === "weekly" ? "weekly" : "monthly",
      nextRun: v.nextRun,
      active: v.active !== false,
      runs: typeof v.runs === "number" ? v.runs : 0,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
      routingNumber: typeof v.routingNumber === "string" ? v.routingNumber : undefined,
      accountNumber: typeof v.accountNumber === "string" ? v.accountNumber : undefined,
      iban: typeof v.iban === "string" ? v.iban : undefined,
      sortCode: typeof v.sortCode === "string" ? v.sortCode : undefined,
    };
  } catch { return null; }
}

async function readSchedule(db: Db, userId: string, mode: "sandbox" | "live", id: string): Promise<StoredSchedule> {
  const row = await db.from("paddle_resources").select("resource_id").eq("user_id", userId).eq("mode", mode).eq("operation", `${SCHEDULE_OP} ${id}`).maybeSingle();
  if (row.error || !row.data) throw new Error("That billing schedule was not found on this account.");
  const parsed = parseSchedule(row.data.resource_id);
  if (!parsed) throw new Error("That schedule record is damaged. Contact support.");
  return parsed;
}

async function writeSchedule(db: Db, userId: string, mode: "sandbox" | "live", s: StoredSchedule): Promise<void> {
  const row = await db.from("paddle_resources").update({ resource_id: JSON.stringify(s) }).eq("user_id", userId).eq("mode", mode).eq("operation", `${SCHEDULE_OP} ${s.id}`);
  if (row.error) throw new Error("The schedule could not be saved. Try again.");
}

export const createSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scheduleSchema.parse(d))
  .handler(async ({ data }): Promise<BillingScheduleView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before creating live billing schedules.");
    const start = new Date(`${data.startDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) throw new Error("Pick a valid start date.");
    const id = `SLKSCH-${crypto.randomUUID()}`;
    const stored: StoredSchedule = {
      id,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      amount: data.amount,
      currency: data.currency,
      description: data.description ?? "",
      accountHint: accountHint(data),
      frequency: data.frequency,
      nextRun: start.toISOString(),
      active: true,
      runs: 0,
      createdAt: new Date().toISOString(),
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      iban: data.iban,
      sortCode: data.sortCode,
    };
    const row = await db.from("paddle_resources").insert({
      user_id: user.id, mode, operation: `${SCHEDULE_OP} ${id}`, resource_id: JSON.stringify(stored),
    });
    if (row.error) throw new Error("The schedule could not be saved. Try again.");
    return toView(stored);
  });

export const listSchedules = createServerFn({ method: "POST" }).handler(async (): Promise<{ schedules: BillingScheduleView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const schedules = await listDetails(db, user.id, mode, SCHEDULE_OP, parseSchedule, 50);
  return { schedules: schedules.map(toView) };
});

export const setScheduleActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scheduleActiveSchema.parse(d))
  .handler(async ({ data }): Promise<BillingScheduleView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const s = await readSchedule(db, user.id, mode, data.id);
    s.active = data.active;
    await writeSchedule(db, user.id, mode, s);
    return toView(s);
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scheduleIdSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const row = await db.from("paddle_resources").delete().eq("user_id", user.id).eq("mode", mode).eq("operation", `${SCHEDULE_OP} ${data.id}`);
    if (row.error) throw new Error("The schedule could not be deleted. Try again.");
    return { id: data.id };
  });

/**
 * Executes one run of a schedule as a real direct debit, then advances the next run date.
 * Each run gets a fresh debit reference, so a failed run never blocks or duplicates the next one.
 */
export const runSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scheduleIdSchema.parse(d))
  .handler(async ({ data }): Promise<{ schedule: BillingScheduleView; debit: DirectDebitView }> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before running live billing schedules.");
    const s = await readSchedule(db, user.id, mode, data.id);
    if (!s.active) throw new Error("This schedule is paused. Resume it before running a debit.");
    const debit = await chargeDebit(db, user.id, mode, {
      customerName: s.customerName,
      customerEmail: s.customerEmail,
      amount: s.amount,
      currency: s.currency,
      description: s.description || undefined,
      routingNumber: s.routingNumber,
      accountNumber: s.accountNumber,
      iban: s.iban,
      sortCode: s.sortCode,
      reference: `SLKDD-${crypto.randomUUID()}`,
    });
    s.runs += 1;
    s.nextRun = nextRunDate(new Date(), s.frequency);
    await writeSchedule(db, user.id, mode, s);
    return { schedule: toView(s), debit };
  });
