import { useSyncExternalStore } from "react";
import type { Txn } from "./api";

const DAY = 864e5;
const ok = (t: Txn) => t.status === "Successful";

/** Sum of successful credits in [from, to). */
export function inflowBetween(txns: Txn[], from: number, to: number) {
  return txns.filter((t) => t.direction === "credit" && ok(t)).filter((t) => { const x = new Date(t.date).getTime(); return x >= from && x < to; }).reduce((a, t) => a + t.amount, 0);
}

/** Week-over-week inflow change in whole percent; null when last week had no inflow. */
export function weekOverWeek(txns: Txn[], now = Date.now()) {
  const thisWeek = inflowBetween(txns, now - 7 * DAY, now + 1);
  const lastWeek = inflowBetween(txns, now - 14 * DAY, now - 7 * DAY);
  return { thisWeek, lastWeek, pct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null };
}

export function insights(txns: Txn[], now = Date.now()) {
  const wow = weekOverWeek(txns, now);
  const weekTx = txns.filter((t) => new Date(t.date).getTime() >= now - 7 * DAY);
  const outflow = weekTx.filter((t) => t.direction === "debit" && ok(t)).reduce((a, t) => a + t.amount, 0);
  const pending = txns.filter((t) => t.status === "Pending").length;
  const top = Object.entries(weekTx.filter((t) => t.direction === "credit" && ok(t)).reduce<Record<string, number>>((m, t) => ({ ...m, [t.customer]: (m[t.customer] ?? 0) + t.amount }), {})).sort((a, b) => b[1] - a[1])[0];
  return { ...wow, outflow, pending, topCustomer: top ? { name: top[0], amount: top[1] } : null, count: weekTx.length };
}

/** Daily successful inflow for the last n days (oldest first). */
export function dailyInflow(txns: Txn[], n: number, now = Date.now()) {
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => { const start = end.getTime() - (n - i) * DAY; const d = new Date(start); return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: inflowBetween(txns, start, start + DAY) }; });
}

export const MASK = "••••••";
export function mask(text: string, hidden: boolean) { return hidden ? MASK : text; }

export function greetingFor(hour: number) { return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; }

export function relativeTime(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
}

/* Privacy toggle — shared across the whole screen, remembered in this browser. */
const KEY = "slikpay.hideAmounts";
const listeners = new Set<() => void>();
let hidden: boolean | null = null;
const read = () => { if (hidden === null) { try { hidden = localStorage.getItem(KEY) === "1"; } catch { hidden = false; } } return hidden; };
export function setHideAmounts(v: boolean) { hidden = v; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* storage unavailable */ } listeners.forEach((l) => l()); }
export function useHideAmounts() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => false);
}
