import { ArrowLeftRight, BadgeCheck, Code2, CreditCard, FileText, Globe, LayoutDashboard, Link2, QrCode, Repeat, Scale, Settings, ShieldCheck, Smartphone, UserCheck, Users, Wallet } from "lucide-react";
import type { Txn } from "./api";

export const MERCHANT_GROUPS = [
  { title: "Core & Overview", items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }, { id: "transactions", label: "Transactions & Ledger", icon: ArrowLeftRight }] },
  { title: "Collections & Acceptance", items: [{ id: "softpos", label: "SoftPOS Terminals", icon: Smartphone }, { id: "smarttag", label: "SmartTag & QR Hardware", icon: QrCode }, { id: "links", label: "Payment Links & Invoices", icon: Link2 }, { id: "mandates", label: "Direct Mandates & Debits", icon: Repeat }] },
  { title: "Disbursements & Cards", items: [{ id: "banking", label: "Commercial Banking", icon: Wallet }, { id: "payroll", label: "Bulk Payroll & Payouts", icon: Users }, { id: "cards", label: "Virtual Corporate Cards", icon: CreditCard }] },
  { title: "Operations & Governance", items: [{ id: "shifts", label: "Shift & Loss Prevention", icon: ShieldCheck }, { id: "disputes", label: "Disputes & Chargebacks", icon: Scale }, { id: "approvals", label: "Maker-Checker Approvals", icon: UserCheck }] },
  { title: "Treasury & Compliance", items: [{ id: "treasury", label: "Forex & Treasury", icon: Globe }, { id: "compliance", label: "KYB & CAC Compliance", icon: BadgeCheck }, { id: "statements", label: "Audits & Account Statements", icon: FileText }] },
  { title: "Developer & Settings", items: [{ id: "developer", label: "Developer APIs & Webhooks", icon: Code2 }, { id: "settings", label: "Settings & Team Security", icon: Settings }] },
];
export const MERCHANT_NAV = MERCHANT_GROUPS.flatMap((g) => g.items);
export function merchantModule(value: unknown): string {
  return typeof value === "string" && MERCHANT_NAV.some((n) => n.id === value) ? value : "overview";
}
export function filterLedger(txns: Txn[], search: string, status: string, from: string, to: string): Txn[] {
  const q = search.trim().toLowerCase();
  return txns.filter((t) => (!q || `${t.ref} ${t.customer} ${t.channel}`.toLowerCase().includes(q)) &&
    (status === "All" || t.status === status) && (!from || t.date.slice(0, 10) >= from) && (!to || t.date.slice(0, 10) <= to));
}