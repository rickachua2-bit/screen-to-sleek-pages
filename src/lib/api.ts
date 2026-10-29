// Shared types and display helpers only. No demo accounts, no fabricated
// transactions, no offline fallbacks: every balance, payment and funding
// figure in the app comes from the live provider or the real ledger.
export type Role = "merchant" | "personal";
export interface User {
  id: string;
  name: string;
  email: string;
  title?: string;
  initials: string;
}
export interface Txn {
  id: string;
  date: string;
  ref: string;
  channel: "NIP" | "SoftPOS" | "Treasury Sweep" | "Card" | "Bills";
  customer: string;
  amount: number;
  direction: "credit" | "debit";
  status: "Successful" | "Pending" | "Failed";
  nipSessionId?: string;
  currency?: string;
  fee?: number;
  net?: number;
  note?: string;
}
export interface Account {
  balance: number;
  nuban: string;
  bank: string;
  inflow30d: number;
  inflowChange: number;
}

export function exportTransactionsCsv(txns: Txn[]) {
  const head = "Date,Reference,Channel,Customer,Amount,Status";
  const rows = txns.map((t) => [t.date, t.ref, t.channel, `"${t.customer}"`, (t.direction === "debit" ? -1 : 1) * t.amount, t.status].join(","));
  const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "slikpay-transactions.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export const money = (n: number, currency = "NGN") => {
  const crypto = /^(USDT|USDC|BTC|ETH)$/.test(currency);
  const sym: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "GH₵", KES: "KSh ", ZAR: "R", XOF: "CFA ", XAF: "FCFA ", RWF: "RF ", UGX: "USh ", TZS: "TSh " };
  const v = n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: crypto ? 8 : 2 });
  return crypto ? `${v} ${currency}` : `${sym[currency] ?? currency + " "}${v}`;
};
export const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
