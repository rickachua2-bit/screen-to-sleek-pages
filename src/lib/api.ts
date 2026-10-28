// Legacy read-only demos may fall back offline. Identity and money movement
// must never manufacture successful service responses.
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
}
export interface Account {
  balance: number;
  nuban: string;
  bank: string;
  inflow30d: number;
  inflowChange: number;
}
export interface Bank {
  code: string;
  name: string;
}

const BASE: string = import.meta.env["VITE_API_BASE"] || "https://business.slikpay.online/api";

function readLS(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

export async function request<T>(path: string, init: RequestInit = {}, fallback?: () => T): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = readLS("slikpay_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (fallback) return fallback();
    throw err;
  }
}

const initials = (n: string) =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const mockUser = (name = "Patrick Otu", email = "patrick@slikpay.online"): User => ({
  id: "usr_01",
  name,
  email,
  title: "Executive Director",
  initials: initials(name),
});

export const MOCK_ACCOUNT: Account = {
  balance: 60048.4,
  nuban: "7946436244",
  bank: "Sterling Bank",
  inflow30d: 12430550.2,
  inflowChange: 18.4,
};

export const MOCK_TXNS: Txn[] = [
  { id: "1", date: "2026-10-27T09:14:00", ref: "SLK-NIP-88213904", channel: "NIP", customer: "Chukwuemeka Aliyu", amount: 250000, direction: "credit", status: "Successful" },
  { id: "2", date: "2026-10-27T08:02:00", ref: "SLK-POS-55120877", channel: "SoftPOS", customer: "Adaora Nwosu", amount: 18500, direction: "credit", status: "Successful" },
  { id: "3", date: "2026-10-26T17:45:00", ref: "SLK-TRS-10293844", channel: "Treasury Sweep", customer: "Prime Tech Ltd", amount: 1200000, direction: "credit", status: "Pending" },
  { id: "4", date: "2026-10-26T13:20:00", ref: "SLK-NIP-77349012", channel: "NIP", customer: "Bola Adeyemi", amount: 45000, direction: "debit", status: "Successful" },
  { id: "5", date: "2026-10-25T11:05:00", ref: "SLK-BIL-66012455", channel: "Bills", customer: "Ikeja Electric", amount: 15000, direction: "debit", status: "Successful" },
  { id: "6", date: "2026-10-25T09:30:00", ref: "SLK-CRD-30118722", channel: "Card", customer: "AWS EMEA", amount: 32400, direction: "debit", status: "Failed" },
];

export const PERSONAL_ACCOUNT: Account = {
  balance: 1420500,
  nuban: "8204918234",
  bank: "Sterling Bank",
  inflow30d: 612400,
  inflowChange: 9.2,
};

export const PERSONAL_TXNS: Txn[] = [
  { id: "p1", date: "2026-10-27T14:14:00", ref: "SLK-P2P-90124471", channel: "NIP", customer: "Babatunde Adeleke (@babatunde)", amount: 12500, direction: "debit", status: "Successful" },
  { id: "p2", date: "2026-10-27T11:02:00", ref: "SLK-NIP-88213977", channel: "NIP", customer: "Salary — Travsify Global", amount: 450000, direction: "credit", status: "Successful" },
  { id: "p3", date: "2026-10-26T20:41:00", ref: "SLK-CRD-55612098", channel: "Card", customer: "Netflix", amount: 4400, direction: "debit", status: "Successful" },
  { id: "p4", date: "2026-10-26T09:15:00", ref: "SLK-BIL-66098112", channel: "Bills", customer: "EKEDC Prepaid", amount: 20000, direction: "debit", status: "Successful" },
  { id: "p5", date: "2026-10-25T16:30:00", ref: "SLK-BIL-66098820", channel: "Bills", customer: "MTN Airtime", amount: 2000, direction: "debit", status: "Successful" },
  { id: "p6", date: "2026-10-25T08:12:00", ref: "SLK-P2P-90110023", channel: "NIP", customer: "From Chiamaka Eze (@chiamaka)", amount: 50000, direction: "credit", status: "Successful" },
  { id: "p7", date: "2026-10-24T19:55:00", ref: "SLK-CRD-55607734", channel: "Card", customer: "Amazon Prime", amount: 6900, direction: "debit", status: "Pending" },
];

export const PERSONAL_SPEND = [
  { label: "Transfers & P2P", pct: 42, cls: "stroke-cobalt", dot: "bg-cobalt" },
  { label: "Utility Bills & Power", pct: 24, cls: "stroke-navy", dot: "bg-navy" },
  { label: "Online Shopping & Card", pct: 21, cls: "stroke-magenta", dot: "bg-magenta" },
  { label: "Subscriptions & Airtime", pct: 13, cls: "stroke-cyan", dot: "bg-cyan" },
];

export const USD_CARD = { balance: 450, last4: "8492", holder: "PATRICK OTU", expiry: "08/28" };

export const NG_BANKS: Bank[] = [
  { code: "232", name: "Sterling Bank" },
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
  { code: "011", name: "First Bank" },
  { code: "033", name: "UBA" },
  { code: "057", name: "Zenith Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "214", name: "FCMB" },
  { code: "035", name: "Wema Bank" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "999992", name: "OPay" },
];

const json = (b: unknown) => ({ method: "POST", body: JSON.stringify(b) });
const ok = (msg: string) => () => ({ success: true, message: msg, ref: `SLK-${Date.now().toString().slice(-8)}` });

export const api = {
  login: (email: string, password: string, portal?: Role) =>
    request<{ token: string; user: User; role: Role; requires2fa?: boolean }>("/auth/login", json({ email, password, portal }), () => ({
      token: `mock_${Date.now()}`,
      user: mockUser(undefined, email),
      role: portal ?? (email.toLowerCase().includes("personal") ? "personal" : "merchant"),
      requires2fa: true,
    })),
  register: (b: { name: string; email: string; password: string; phone: string; accountType: "BUSINESS" | "PERSONAL"; category?: string }) =>
    request<{ token: string; user: User; role: Role }>("/auth/register", json(b), () => ({
      token: `mock_${Date.now()}`,
      user: mockUser(b.name, b.email),
      role: b.accountType === "BUSINESS" ? "merchant" : "personal",
    })),
  me: () => request<{ user: User; role: Role }>("/auth/me"),
  verify2fa: (code: string) =>
    request<{ success: boolean }>("/auth/2fa/verify", json({ code })),
  forgotPassword: (email: string) => request("/auth/forgot-password", json({ email }), ok("Reset link sent")),
  accounts: () => request<Account>("/accounts", {}, () => MOCK_ACCOUNT),
  transactions: (limit = 20, page = 1) =>
    request<Txn[]>(`/transactions?limit=${limit}&page=${page}`, {}, () => MOCK_TXNS.slice(0, limit)),
  banks: () => request<Bank[]>("/transfers/banks", {}, () => NG_BANKS),
  nameEnquiry: (bankCode: string, nuban: string) =>
    request<{ accountName: string }>("/transfers/name-enquiry", json({ bankCode, nuban })),
  transfer: (b: { recipientBank: string; accountNumber: string; amount: number; narration: string }) =>
    Promise.reject<{ success: boolean; message: string; ref: string }>(new Error("Live transfers are locked until secure funding-account ownership and withdrawal PIN validation are configured.")),
  cards: () => request<{ id: string; balance: number; last4: string }[]>("/cards", {}, () => [{ id: "crd_1", balance: 0, last4: "1234" }]),
  createCard: () => request("/cards/create", json({}), ok("Card created")),
  fundCard: (id: string, amount: number) =>
    request<{ success: boolean; message: string; ref: string }>(`/cards/${id}/fund`, json({ amount }), ok("Card funded")),
  payBill: (b: { service: "power" | "airtime" | "cable"; amount: number; meterOrPhone: string }) =>
    request<{ success: boolean; message: string; ref: string }>("/bills/pay", json(b), ok("Payment successful")),
  swap: (b: { fromCurrency: string; toCurrency: string; amount: number }) =>
    request<{ success: boolean; message: string; ref: string }>("/swap/execute", json(b), ok("Swap executed")),
};

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

export const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
