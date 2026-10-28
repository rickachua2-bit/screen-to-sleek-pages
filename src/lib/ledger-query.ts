import type { Txn } from "./api";

export interface LedgerQuery { text: string; status?: Txn["status"]; direction?: Txn["direction"]; min?: number; max?: number; month?: number; chips: string[] }

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const num = (s: string) => { const m = s.toLowerCase().replace(/[₦,\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/); if (!m) return undefined; return Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1); };

/** Turns plain phrases like "failed transfers over 50k from ada in march" into filters; leftover words stay as text search. */
export function parseLedgerQuery(input: string): LedgerQuery {
  let s = ` ${input.toLowerCase()} `;
  const q: LedgerQuery = { text: "", chips: [] };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => { const m = s.match(re); if (m && fn(m)) s = s.replace(m[0], " "); };
  take(/\b(failed|declined)\b/, () => { q.status = "Failed"; q.chips.push("Failed"); return true; });
  take(/\b(pending|processing)\b/, () => { q.status = "Pending"; q.chips.push("Pending"); return true; });
  take(/\b(successful|success|completed|paid)\b/, () => { q.status = "Successful"; q.chips.push("Successful"); return true; });
  take(/\b(received|incoming|money in|credits?|inflows?)\b/, () => { q.direction = "credit"; q.chips.push("Money in"); return true; });
  take(/\b(sent|outgoing|money out|debits?|outflows?|payouts?)\b/, () => { q.direction = "debit"; q.chips.push("Money out"); return true; });
  take(/\b(?:between|from)\s+(₦?[\d.,]+[km]?)\s+(?:and|to|-)\s+(₦?[\d.,]+[km]?)\b/, (m) => { const a = num(m[1]!), b = num(m[2]!); if (a === undefined || b === undefined) return false; q.min = Math.min(a, b); q.max = Math.max(a, b); q.chips.push(`₦${q.min.toLocaleString()}–₦${q.max.toLocaleString()}`); return true; });
  take(/(?:over|above|more than|>)\s*(₦?[\d.,]+[km]?)\b/, (m) => { const a = num(m[1]!); if (a === undefined) return false; q.min = a; q.chips.push(`Over ₦${a.toLocaleString()}`); return true; });
  take(/(?:under|below|less than|<)\s*(₦?[\d.,]+[km]?)\b/, (m) => { const a = num(m[1]!); if (a === undefined) return false; q.max = a; q.chips.push(`Under ₦${a.toLocaleString()}`); return true; });
  take(/\b(?:in\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/, (m) => { q.month = MONTHS.indexOf(m[1]!); q.chips.push(m[1]![0]!.toUpperCase() + m[1]!.slice(1)); return true; });
  s = s.replace(/\b(show|me|all|my|transactions?|transfers?|payments?|from|to|by|with|in|the)\b/g, " ");
  q.text = s.replace(/\s+/g, " ").trim();
  return q;
}

export function matchLedger(t: Txn, q: LedgerQuery): boolean {
  if (q.status && t.status !== q.status) return false;
  if (q.direction && t.direction !== q.direction) return false;
  if (q.min !== undefined && t.amount < q.min) return false;
  if (q.max !== undefined && t.amount > q.max) return false;
  if (q.month !== undefined && new Date(t.date).getMonth() !== q.month) return false;
  if (q.text && !q.text.split(" ").every((w) => `${t.ref} ${t.customer} ${t.channel}`.toLowerCase().includes(w))) return false;
  return true;
}

/** Balance after each transaction, newest first, walking back from the current balance. Only successful entries move it. */
export function runningBalances(txnsNewestFirst: Txn[], current: number): Map<string, number> {
  const out = new Map<string, number>();
  let bal = current;
  for (const t of txnsNewestFirst) {
    out.set(t.id, bal);
    if (t.status === "Successful") bal -= t.direction === "credit" ? t.amount : -t.amount;
  }
  return out;
}
