// Which actions each currency wallet offers, and naira-value maths. Client-safe.
import { currencyDef, type WalletStatus } from "./wallets";
import { namesMatch } from "./go-live";

export type WalletAction = "receive" | "send" | "withdraw" | "swap" | "request" | "more";
export interface ActionState { id: WalletAction; label: string; enabled: boolean; reason?: string }

export function walletActions(code: string, status: WalletStatus, balance: number): ActionState[] {
  const crypto = currencyDef(code)?.kind === "crypto";
  const active = status === "active" || code === "NGN";
  const lockedWhy = status === "not_active" ? "Account not active yet" : "Issue this account first";
  return [
    { id: "receive", label: "Receive", enabled: active, ...(active ? {} : { reason: lockedWhy }) },
    { id: "send", label: "Send", enabled: active && !crypto && balance > 0, ...(!active ? { reason: lockedWhy } : crypto ? { reason: "Crypto sends to outside addresses are not active yet" } : balance > 0 ? {} : { reason: "No balance to send" }) },
    { id: "withdraw", label: "Withdraw", enabled: !crypto && balance > 0, ...(crypto ? { reason: "Swap to a bank currency to withdraw" } : balance > 0 ? {} : { reason: "No balance to withdraw" }) },
    { id: "swap", label: "Swap", enabled: true },
    { id: "request", label: "Request", enabled: !crypto, ...(crypto ? { reason: "Payment links are for bank currencies" } : {}) },
    { id: "more", label: "More", enabled: true },
  ];
}

/** ngnPer: naira per one unit of each currency, learned from completed swaps. */
export type Rates = Record<string, number>;
export function learnRate(rates: Rates, from: string, to: string, rate: number): Rates {
  if (!(rate > 0)) return rates;
  const next = { ...rates, NGN: 1 };
  if (from === "NGN") next[to] = 1 / rate;
  else if (to === "NGN") next[from] = rate;
  else if (next[from]) next[to] = next[from]! / rate;
  else if (next[to]) next[from] = next[to]! * rate;
  return next;
}
export function nairaValue(code: string, amount: number, rates: Rates) {
  if (code === "NGN") return amount;
  const r = rates[code];
  return r ? Math.round(amount * r * 100) / 100 : null;
}

/** Withdrawals go only to the holder's own account: the payout name must match the verified holder name. */
export function isOwnPayoutAccount(holder: string, payoutName: string) { return namesMatch(holder, payoutName); }
