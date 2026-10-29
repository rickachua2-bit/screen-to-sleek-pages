import type { Txn } from "./api";

const n = (v: unknown) => { const x = typeof v === "string" ? Number(v) : v; return typeof x === "number" && Number.isFinite(x) ? x : undefined; };

/** Fee the provider reported on a money movement, or undefined when it did not report one. Never guessed. */
export function providerFee(d: Record<string, unknown> | null | undefined): number | undefined {
  if (!d) return undefined;
  for (const k of ["fee", "fees", "charge", "charges", "totalFee", "transactionFee", "platformFee", "feeAmount"]) {
    const v = n(d[k]);
    if (v !== undefined && v >= 0) return Math.round(v * 1e8) / 1e8;
  }
  const meta = d["metadata"];
  return meta && typeof meta === "object" ? providerFee(meta as Record<string, unknown>) : undefined;
}

export interface TxRow { id: string; created_at: string; reference: string; channel: string; customer: string; amount: unknown; direction: "credit" | "debit"; status: Txn["status"]; metadata?: Record<string, unknown> | null }
export interface ReceiptRow { id: string; created_at: string; operation: string; status: string; amount: unknown; currency: string | null; provider_reference: string | null; session_id: string | null; summary?: Record<string, unknown> | null }

/** Credits recorded in transactions: fee comes from what the provider deducted (amount − net). */
export function fromTransaction(r: TxRow): Txn {
  const m = r.metadata ?? {};
  const amount = Number(r.amount);
  const fee = n(m["fee"]);
  const currency = typeof m["currency"] === "string" && m["currency"] ? (m["currency"] as string) : "NGN";
  return {
    id: r.id, date: r.created_at, ref: r.reference, channel: r.channel as Txn["channel"], customer: r.customer, amount, direction: r.direction, status: r.status, currency,
    ...(fee !== undefined ? { fee, net: r.direction === "credit" ? amount - fee : amount + fee } : {}),
    ...(typeof m["nipSessionId"] === "string" ? { nipSessionId: m["nipSessionId"] as string } : {}),
  };
}

const LABELS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^WITHDRAW /, () => "Withdrawal"],
  [/^SWAP (\w+)->(\w+)/, (m) => `Swap to ${m[2]}`],
  [/payouts\/transfer|transfers/, () => "Bank transfer"],
  [/payouts\/global/, () => "International payout"],
  [/bills|airtime|data|electricity|cable/, () => "Bills"],
  [/cards/, () => "Card"],
];
export function receiptChannel(op: string): string {
  for (const [re, f] of LABELS) { const m = op.match(re); if (m) return f(m); }
  return "Payment";
}

/** Outgoing movements recorded as receipts (transfers, withdrawals, swaps, bills). */
export function fromReceipt(r: ReceiptRow): Txn | null {
  const amount = n(r.summary?.["principal"]) ?? n(r.amount);
  if (amount === undefined || amount <= 0) return null;
  const s = r.summary ?? {};
  const currency = r.currency || "NGN";
  const swapTo = r.operation.match(/^SWAP \w+->(\w+)/)?.[1];
  // A swap fee is charged in the target currency, so it is not added to the source amount.
  const fee = swapTo ? undefined : n(s["fee"]);
  const to = [s["recipient"], s["to"], s["bank"]].filter((v) => typeof v === "string" && v).join(" · ");
  return {
    id: `r:${r.id}`, date: r.created_at, ref: r.provider_reference || r.id.slice(0, 12), channel: receiptChannel(r.operation) as Txn["channel"],
    customer: swapTo ? `${currency} → ${swapTo}` : to || receiptChannel(r.operation), amount, direction: "debit", currency,
    status: r.status === "succeeded" ? "Successful" : r.status === "failed" ? "Failed" : "Pending",
    ...(fee !== undefined ? { fee, net: amount + fee } : {}),
    ...(swapTo && n(s["fee"]) !== undefined ? { note: `Fee ${n(s["fee"])} ${swapTo} taken from the amount received` } : {}),
    ...(r.session_id ? { nipSessionId: r.session_id } : typeof s["nipSessionId"] === "string" ? { nipSessionId: s["nipSessionId"] } : {}),
  };
}

export function mergeHistory(txs: TxRow[], receipts: ReceiptRow[]): Txn[] {
  return [...txs.map(fromTransaction), ...receipts.map(fromReceipt).filter((x): x is Txn => !!x)].sort((a, b) => b.date.localeCompare(a.date));
}
