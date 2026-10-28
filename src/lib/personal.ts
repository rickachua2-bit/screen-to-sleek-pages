import { Boxes, CreditCard, Rocket, Gift, Home, PiggyBank, Receipt, Send, Settings, Smartphone, Zap, type LucideIcon } from "lucide-react";

export interface PersonalNavItem { id: string; label: string; icon: LucideIcon; blurb: string }

export const PERSONAL_NAV: PersonalNavItem[] = [
  { id: "home", label: "Home & Wallet", icon: Home, blurb: "Overview, balance, quick send, recent activity" },
  { id: "send", label: "Send Money", icon: Send, blurb: "Free @SlikTag P2P, NIP interbank, QR pay" },
  { id: "airtime", label: "Airtime & Data", icon: Smartphone, blurb: "MTN, Airtel, Glo, 9mobile instant VTU" },
  { id: "bills", label: "Electricity & Cable", icon: Zap, blurb: "AEDC, EKEDC, IBEDC, DStv, GOtv, StarTimes" },
  { id: "cards", label: "Virtual Cards", icon: CreditCard, blurb: "USD Mastercard & Naira virtual cards" },
  { id: "savings", label: "Savings & Ajo", icon: PiggyBank, blurb: "Target locks, daily interest, thrift circles" },
  { id: "rewards", label: "Rewards & Referrals", icon: Gift, blurb: "Earn ₦1,000 per invited friend" },
  { id: "profile", label: "Profile & Security", icon: Settings, blurb: "KYC tier, PIN, biometric login" },
  { id: "services", label: "All Services", icon: Boxes, blurb: "Flights, investments, crypto, cards and more" },
  { id: "golive", label: "Go Live (KYC)", icon: Rocket, blurb: "Verify your identity to move from sandbox to live" },
];

export const PERSONAL_GROUPS: { title: string; items: PersonalNavItem[] }[] = [
  { title: "Everyday", items: PERSONAL_NAV.slice(0, 2) },
  { title: "Bills & Top-up", items: PERSONAL_NAV.slice(2, 4) },
  { title: "Grow", items: PERSONAL_NAV.slice(4, 7) },
  { title: "Account", items: PERSONAL_NAV.slice(7) },
];

// Mobile bottom bar: Home, Transfers, Bills, Cards, Profile
export const PERSONAL_TABS: PersonalNavItem[] = [
  PERSONAL_NAV[0]!,
  { id: "send", label: "Transfers", icon: Send, blurb: "" },
  { id: "bills", label: "Bills", icon: Receipt, blurb: "" },
  { id: "cards", label: "Cards", icon: CreditCard, blurb: "" },
  { id: "profile", label: "Profile", icon: Settings, blurb: "" },
];

export function personalModule(value: unknown): string {
  return typeof value === "string" && PERSONAL_NAV.some((n) => n.id === value) ? value : "home";
}

export const AIRTIME_NETWORKS = [
  { id: "mtn", name: "MTN", color: "bg-yellow-400" },
  { id: "airtel", name: "Airtel", color: "bg-red-500" },
  { id: "glo", name: "Glo", color: "bg-green-500" },
  { id: "9mobile", name: "9mobile", color: "bg-emerald-700" },
];

export const ELECTRICITY_DISCOS = ["AEDC — Abuja", "EKEDC — Eko", "IBEDC — Ibadan", "IKEDC — Ikeja", "PHED — Port Harcourt"];
export const CABLE_TV = ["DStv", "GOtv", "StarTimes"];

export const SAVINGS_POTS = [
  { name: "December Detty Fund", saved: 320000, target: 500000, rate: "12.5% p.a." },
  { name: "New Laptop", saved: 145000, target: 400000, rate: "10% p.a." },
  { name: "Ajo Circle — Week 6 of 10", saved: 180000, target: 300000, rate: "Thrift" },
];

export const REWARD_TIERS = [
  { name: "Starter", need: "0–4 friends", perk: "₦1,000 per friend", active: true },
  { name: "Connector", need: "5–14 friends", perk: "₦1,500 per friend + free transfers", active: false },
  { name: "Ambassador", need: "15+ friends", perk: "₦2,000 per friend + priority support", active: false },
];
