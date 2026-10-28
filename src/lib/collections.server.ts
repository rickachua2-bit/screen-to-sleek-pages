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

/** Pulls recent collections from the provider for every account the user owns. Returns new credits. */
export async function syncCollections(db: SupabaseClient, userId: string) {
  const res = await db.from("paddle_resources").select("resource_id, mode").eq("user_id", userId).eq("operation", "POST /v1/accounts/virtual");
  let added = 0;
  for (const mode of ["live", "sandbox"] as const) {
    const owned = new Set((res.data ?? []).filter((r) => r.mode === mode).map((r) => r.resource_id as string));
    if (!owned.size) continue;
    let list: InboundTx[] = [];
    try { const r = await callPaddle(mode, "GET", "/v1/transactions", { limit: 100 }); list = Array.isArray(r.data) ? (r.data as InboundTx[]) : []; } catch { continue; }
    for (const t of list) { const c = inboundCredit(t, owned); if (c && (await postCredit(db, userId, mode, c))) added++; }
  }
  return added;
}
