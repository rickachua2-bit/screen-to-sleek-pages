import { GoLive, PaddleConsole, useBankingProfile } from "./PaddleConsole";
import { ServicesHub } from "./ServicesHub";
import { personalTier } from "@/lib/go-live";
import { useState } from "react";
import { ArrowLeftRight, BadgeCheck, CheckCircle2, Copy, CreditCard, Eye, EyeOff, Fingerprint, Gift, Landmark, Lock, PiggyBank, Plane, QrCode, Search, Send, Share2, Smartphone, Snowflake, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { naira, type Txn } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NubanCard, Panel, QuickAction } from "./Widgets";
import { DonutChart } from "./Charts";
import { ModalReceipt, StatusBadge } from "./TransactionTable";
import { CardGraphic } from "./CardGraphic";
import { Cards } from "./Cards";
import { BrandSelect } from "./BrandSelect";
import type { ActionKind } from "./ActionModal";
import { PersonalSavings } from "./PersonalSavings";
import { PersonalRewards } from "./PersonalRewards";
import { FlightBooking } from "./FlightBooking";

const fmt = (d: string) => {
  const dt = new Date(d);
  const today = new Date().toDateString() === dt.toDateString();
  const time = dt.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return today ? `Today, ${time}` : `${dt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${time}`;
};

function txnIcon(t: Txn) {
  if (t.channel === "Card") return CreditCard;
  if (t.channel === "Bills") return t.customer.includes("Airtime") || t.customer.includes("Data") ? Smartphone : Zap;
  return Send;
}

export function ActivityList({ txns, limit }: { txns: Txn[]; limit?: number }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Txn | null>(null);
  const rows = txns.filter((t) => `${t.customer} ${t.ref}`.toLowerCase().includes(q.toLowerCase())).slice(0, limit ?? 50);
  return (
    <>
      <label className="relative mb-4 block max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input aria-label="Search activity" className="field h-10 pl-9 text-xs" placeholder="Search people, bills, references..." value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul className="divide-y divide-border">
        {rows.map((t) => {
          const Icon = txnIcon(t);
          return (
            <li key={t.id}>
              <button className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/40" onClick={() => setSel(t)}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.direction === "credit" ? "bg-success-soft text-success" : "bg-muted text-foreground"}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">{t.customer}</span>
                  <span className="block text-xs font-semibold text-muted-foreground">{fmt(t.date)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-sm font-extrabold ${t.direction === "credit" ? "text-success" : "text-foreground"}`}>{t.direction === "credit" ? "+" : "−"}{naira(t.amount)}</span>
                  <StatusBadge s={t.status} />
                </span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-8 text-center text-sm font-semibold text-muted-foreground">{q ? <>No transactions match “{q}”.</> : "No transactions yet. Your activity will appear here."}</li>}
      </ul>
      {sel && <ModalReceipt txn={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function LiveActivity({ filter }: { filter: (t: Txn) => boolean }) {
  const { txns } = useAuth();
  return <ActivityList txns={txns.filter(filter)} />;
}

function useLive() {
  const { profile, txns } = useAuth();
  return { balance: profile?.wallet_balance ?? 0, txns };
}

function spendBreakdown(txns: Txn[]) {
  const debits = txns.filter((t) => t.direction === "debit" && t.status === "Successful");
  const total = debits.reduce((a, t) => a + t.amount, 0);
  const groups = [
    { label: "Transfers & P2P", ch: ["NIP"], cls: "stroke-cobalt", dot: "bg-cobalt" },
    { label: "Bills & Airtime", ch: ["Bills"], cls: "stroke-navy", dot: "bg-navy" },
    { label: "Card spend", ch: ["Card"], cls: "stroke-magenta", dot: "bg-magenta" },
    { label: "Other", ch: ["SoftPOS", "Treasury Sweep", "SlikTag", "Flights"], cls: "stroke-cyan", dot: "bg-cyan" },
  ];
  return { total, data: groups.map((g) => ({ label: g.label, cls: g.cls, dot: g.dot, pct: total ? Math.round((debits.filter((t) => g.ch.includes(t.channel)).reduce((a, t) => a + t.amount, 0) / total) * 100) : 0 })) };
}

function HomeModule({ open }: { open: (k: ActionKind) => void }) {
  const [show, setShow] = useState(true);
  const { balance, txns } = useLive();
  const spend = spendBreakdown(txns);
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Personal Wallet Balance"
          action={
            <button aria-label={show ? "Hide balance" : "Show balance"} onClick={() => setShow(!show)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          }
        >
          <div className="text-3xl font-black tracking-tight text-foreground">{show ? naira(balance) : "••••••••"}</div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Available balance</p>
          <div className="mt-5 flex gap-3 border-t-[1.5px] border-border pt-4">
            <Button variant="brand" onClick={() => open("add")}><Send className="rotate-45" /> Add Money</Button>
            <Button variant="crisp" onClick={() => open("send")}><Send /> Send Money</Button>
          </div>
        </Panel>
        <Panel title="Monthly Spending">
          {spend.total ? <DonutChart data={spend.data} center={naira(spend.total).split(".")[0]!} sub="Total spent" /> : <p className="py-10 text-center text-sm font-semibold text-muted-foreground">No spending yet. Your breakdown appears after your first payment.</p>}
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-6 w-full">
        <QuickAction icon={Send} title="Send Money" sub="To bank or @SlikTag" tone="bg-cobalt" onClick={() => open("send")} />
        <QuickAction icon={Plane} title="Book Flights" sub="450+ airlines & instant PNR" tone="bg-cyan/90 text-slate-950" onClick={() => { window.location.href = "/personal?module=flights"; }} />
        <QuickAction icon={Smartphone} title="Airtime & Data" sub="MTN, Airtel, Glo, 9mobile" tone="bg-gradient-brand" onClick={() => open("airtime")} />
        <QuickAction icon={Zap} title="Pay Utilities" sub="Electricity & Cable TV" tone="bg-magenta/80" onClick={() => open("bills")} />
        <QuickAction icon={CreditCard} title="USD Virtual Card" sub="Top up in dollars" tone="bg-magenta" onClick={() => open("fund")} />
        <QuickAction icon={ArrowLeftRight} title="Fiat-to-Coin Swap" sub="Convert NGN to USD / USDT" tone="bg-gradient-tri" onClick={() => open("swap")} />
      </div>
      <Panel title="Recent Activity">
        <ActivityList txns={txns} limit={5} />
      </Panel>
    </>
  );
}

function SendModule({ open }: { open: (k: ActionKind) => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="Send to @SlikTag" className="lg:col-span-1">
        <p className="text-sm font-semibold text-body">Free, instant transfers to any Slikpay handle.</p>
        <label className="mt-4 block"><span className="mb-1.5 block text-sm font-bold text-foreground">SlikTag</span><input className="field" placeholder="@friend" /></label>
        <label className="mt-3 block"><span className="mb-1.5 block text-sm font-bold text-foreground">Amount (NGN)</span><input className="field" inputMode="decimal" placeholder="0.00" /></label>
        <Button variant="brand" className="mt-4 w-full" onClick={() => open("send")}><Send /> Send free</Button>
      </Panel>
      <Panel title="Bank Transfer (NIP)" className="lg:col-span-1">
        <p className="text-sm font-semibold text-body">Send to any Nigerian bank account, checked by name before you pay.</p>
        <Button variant="crisp" className="mt-4 w-full" onClick={() => open("send")}>Start NIP transfer</Button>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border p-3 text-xs font-semibold text-muted-foreground"><QrCode className="h-4 w-4 text-cyan" /> Or scan a Slikpay QR code to pay instantly.</div>
      </Panel>
      <Panel title="Recent Activity" className="lg:col-span-1"><LiveActivity filter={((t) => t.channel === "NIP")} /></Panel>
    </div>
  );
}

function AirtimeModule() {
  return <ServicesHub role="personal" only={["airtime", "data"]} title="Airtime & data" />;
}

function BillsModule() {
  return <ServicesHub role="personal" only={["power", "tv", "internet", "betting", "education"]} title="Pay a bill" />;
}

function CardsModule() {
  return <Cards />;
}

function ProfileModule() {
  const { user } = useAuth();
  const [bio, setBio] = useState(true);
  const tag = "@" + (user?.name ?? "patrick").split(" ")[0]!.toLowerCase();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Profile">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-lg font-black text-primary-foreground">{user?.initials ?? "—"}</span>
          <div>
            <p className="flex items-center gap-1.5 text-base font-extrabold text-foreground">{user?.name ?? ""} <BadgeCheck className="h-4 w-4 text-success" /></p>
            <p className="text-sm font-semibold text-cyan">{tag}</p>
            <p className="text-xs font-semibold text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-border p-4">
          <TierCard />
        </div>
      </Panel>
      <Panel title="Security">
        <ul className="space-y-3">
          <li className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="flex items-center gap-3 text-sm font-bold text-foreground"><Fingerprint className="h-5 w-5 text-cyan" /> Biometric login</span>
            <button onClick={() => setBio(!bio)} role="switch" aria-checked={bio} aria-label="Toggle biometric login" className={`h-6 w-11 rounded-full p-0.5 transition-colors ${bio ? "bg-cobalt" : "bg-muted"}`}><span className={`block h-5 w-5 rounded-full bg-primary-foreground transition-transform ${bio ? "translate-x-5" : ""}`} /></button>
          </li>
          <li className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="flex items-center gap-3 text-sm font-bold text-foreground"><Lock className="h-5 w-5 text-magenta" /> 4-digit transaction PIN</span>
            <Button variant="crisp" size="sm" onClick={() => toast.success("PIN reset link drafted", { description: "PIN changes activate with the live service." })}>Change PIN</Button>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

export function PersonalWorkspace({ module, open }: { module: string; open: (k: ActionKind) => void }) {
  switch (module) {
    case "send": return <SendModule open={open} />;
    case "airtime": return <AirtimeModule />;
    case "bills": return <BillsModule />;
    case "cards": return <CardsModule />;
    case "flights": return <FlightBooking role="personal" />;
    case "savings": return <PersonalSavings />;
    case "rewards": return <PersonalRewards />;
    case "profile": return <ProfileModule />;
    case "services": return <ServicesHub role="personal" />;
    case "golive": return <GoLive role="personal" />;
    default: return <HomeModule open={open} />;
  }
}

function TierCard() {
  const { profile } = useBankingProfile();
  const tier = personalTier(profile?.kyc ?? []);
  return <>
    <p className="flex items-center gap-2 text-sm font-extrabold text-foreground"><BadgeCheck className={`h-4 w-4 ${tier ? "text-success" : "text-muted-foreground"}`} /> {tier ? `KYC Tier ${tier} Verified` : "KYC not verified yet"}</p>
    <p className="mt-1 text-xs font-semibold text-muted-foreground">{tier < 3 ? `Complete Tier ${tier + 1} in Go Live to raise your limits.` : "Highest tier reached."}</p>
  </>;
}
