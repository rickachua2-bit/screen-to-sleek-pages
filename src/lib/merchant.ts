import { ArrowLeftRight, Boxes, Rocket, BadgeCheck, Code2, CreditCard, FileText, Globe, GraduationCap, Landmark, LayoutDashboard, Link2, Lock, Phone, Plane, QrCode, Repeat, Router, Scale, Send, Settings, ShieldCheck, Smartphone, Trophy, Tv, UserCheck, Users, Wifi, Zap } from "lucide-react";
import type { Txn } from "./api";

/** Sidebar groups mirror the Services hub categories. `svc-<id>` modules open that guided service directly. */
export const MERCHANT_GROUPS = [
  { title: "Overview", items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }, { id: "transactions", label: "Transactions & Ledger", icon: ArrowLeftRight }, { id: "services", label: "All Banking Services", icon: Boxes }, { id: "golive", label: "Go Live (KYB)", icon: Rocket }] },
  { title: "Move money", items: [{ id: "banking", label: "Bank transfer", icon: Send }, { id: "payroll", label: "Bulk payouts", icon: Users }, { id: "treasury", label: "International & swap", icon: Globe }, { id: "flights", label: "Flight booking & travel", icon: Plane }] },
  { title: "Get paid", items: [{ id: "links", label: "Payment links & invoices", icon: Link2 }, { id: "smarttag", label: "QR & SmartTag", icon: QrCode }, { id: "softpos", label: "SoftPOS", icon: Smartphone }, { id: "mandates", label: "Direct debits", icon: Repeat }, { id: "svc-escrow", label: "Escrow", icon: Lock }] },
  { title: "Cards", items: [{ id: "cards", label: "Virtual cards", icon: CreditCard }] },
  { title: "Pay bills", items: [{ id: "svc-airtime", label: "Airtime", icon: Phone }, { id: "svc-data", label: "Mobile data", icon: Wifi }, { id: "svc-power", label: "Electricity", icon: Zap }, { id: "svc-tv", label: "Cable TV", icon: Tv }, { id: "svc-internet", label: "Home internet", icon: Router }, { id: "svc-betting", label: "Betting wallet", icon: Trophy }, { id: "svc-education", label: "Exam PINs", icon: GraduationCap }] },
  { title: "Government & tax", items: [{ id: "svc-firs", label: "Federal tax (FIRS)", icon: Landmark }, { id: "svc-remita", label: "Remita (RRR)", icon: FileText }] },
  { title: "Business tools", items: [{ id: "approvals", label: "Approvals", icon: UserCheck }, { id: "statements", label: "Statements", icon: FileText }, { id: "disputes", label: "Disputes", icon: Scale }, { id: "shifts", label: "Shift & loss prevention", icon: ShieldCheck }, { id: "compliance", label: "KYB & CAC compliance", icon: BadgeCheck }, { id: "settings", label: "Team & security", icon: Settings }] },
  { title: "Developers", items: [{ id: "developer", label: "API console & webhooks", icon: Code2 }] },
];
export const MERCHANT_NAV = MERCHANT_GROUPS.flatMap((g) => g.items);
export const serviceModuleId = (module: string) => (module.startsWith("svc-") ? module.slice(4) : null);
export function merchantModule(value: unknown): string {
  return typeof value === "string" && MERCHANT_NAV.some((n) => n.id === value) ? value : "overview";
}
export function filterLedger(txns: Txn[], search: string, status: string, from: string, to: string): Txn[] {
  const q = search.trim().toLowerCase();
  return txns.filter((t) => (!q || `${t.ref} ${t.customer} ${t.channel}`.toLowerCase().includes(q)) &&
    (status === "All" || t.status === status) && (!from || t.date.slice(0, 10) >= from) && (!to || t.date.slice(0, 10) <= to));
}
