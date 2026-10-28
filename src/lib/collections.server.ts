import { namesMatch } from "./go-live";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callPaddle } from "./paddle.server";
import type { Mode } from "./paddle-policy";

/** Shape of a provider collection record (from /v1/transactions or a webhook body). */
export interface InboundTx { id?: unknown; reference?: unknown; amount?: unknown; netAmount?: unknown; currency?: unknown; status?: unknown; channel?: unknown; customer?: { name?: unknown } | null; metadata?: Record<string, unknown> | null; accountNumber?: unknown; virtualAccountNumber?: unknown; createdAt?: unknown }

const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** Pure: turn a provider record into a credit for one of the owned accounts, or null. */
export function inboundCredit(tx: InboundTx, owned: Set<string>) {
  const m = tx.metadata ?? {};
  const account = s(m["recipientAccountNumber"] ?? tx.accountNumber ?? tx.virtualAccountNumber);
  const status = s(tx.status ?? m["status"]).toLowerCase();
  const amount = Number(tx.amount ?? m["sourceAmount"]);
  const ref = s(tx.reference ?? m["reference"] ?? tx.id);
  if (!account || !owned.has(account) || !ref || !Number.isFinite(amount) || amount <= 0) return null;
  if (!/success|completed|paid/.test(status)) return null;
  const net = Number(tx.netAmount);
  return {
    account, reference: ref, amount,
    net: Number.isFinite(net) && net > 0 ? net : amount,
    currency: s(tx.currency ?? m["destinationCurrency"]) || "NGN",
    sender: s(m["senderAccountName"] ?? tx.customer?.name) || "Bank transfer",
    senderBank: s(m["senderBankName"]),
    at: s(tx.createdAt ?? m["createdAt"]) || new Date().toISOString(),
  };
}

/** Idempotently records a credit in the activity feed and the balance ledger. */
export async function postCredit(db: SupabaseClient, userId: string, mode: Mode, c: NonNullable<ReturnType<typeof inboundCredit>>) {
  const reference = `col:${c.reference}`;
  const tx = await db.from("transactions").upsert({ user_id: userId, reference, channel: "NIP", customer: c.sender, amount: c.amount, direction: "credit", status: "Successful", created_at: c.at, metadata: { mode, account: c.account, senderBank: c.senderBank, fee: Math.round((c.amount - c.net) * 100) / 100, currency: c.currency } }, { onConflict: "reference", ignoreDuplicates: true }).select("id");
  await db.from("ledger_entries").upsert({ user_id: userId, mode, currency: c.currency, amount: c.net, status: "posted", operation: "collection", reference }, { onConflict: "reference", ignoreDuplicates: true });
  return (tx.data?.length ?? 0) > 0;
}

/** Pure: an unrecorded receiving account belongs to this user when its verified name matches theirs. */
export function adoptableAccount(tx: InboundTx, holder: string | null, owned: Set<string>) {
  const m = tx.metadata ?? {};
  const account = s(m["recipientAccountNumber"] ?? tx.accountNumber ?? tx.virtualAccountNumber);
  const name = s(m["recipientAccountName"] ?? m["payeeName"]);
  if (!holder || !account || owned.has(account) || !/^\d{10}$/.test(account) || !name) return null;
  return namesMatch(name, holder) ? account : null;
}

/** Pulls recent collections for every account the user owns, auto-discovering accounts in their verified business name. */
export async function syncCollections(db: SupabaseClient, userId: string, holder: string | null = null) {
  const res = await db.from("paddle_resources").select("resource_id, mode, operation").eq("user_id", userId).like("operation", "%/v1/accounts/virtual%");
  let added = 0;
  for (const mode of ["live", "sandbox"] as const) {
    const owned = new Set((res.data ?? []).filter((r) => r.mode === mode).map((r) => r.resource_id as string));
    if (!owned.size && !holder) continue;
    let list: InboundTx[] = [];
    try { const r = await callPaddle(mode, "GET", "/v1/transactions", { limit: 100 }); list = Array.isArray(r.data) ? (r.data as InboundTx[]) : []; } catch { continue; }
    for (const t of list) {
      const acc = adoptableAccount(t, holder, owned);
      // unique (mode, resource_id) stops an account already claimed by someone else from being adopted.
      if (acc) { const ins = await db.from("paddle_resources").insert({ user_id: userId, mode, resource_id: acc, operation: "LINKED /v1/accounts/virtual" }); if (!ins.error) owned.add(acc); }
      const c = inboundCredit(t, owned);
      if (c && (await postCredit(db, userId, mode, c))) added++;
    }
  }
  return added;
}
