import { useState } from "react";
import { ArrowLeftRight, BadgeCheck, CheckCircle2, Copy, CreditCard, Eye, EyeOff, Fingerprint, Gift, Landmark, Lock, PiggyBank, QrCode, Search, Send, Share2, Smartphone, Snowflake, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { naira, PERSONAL_ACCOUNT, PERSONAL_SPEND, PERSONAL_TXNS, USD_CARD, usd, type Txn } from "@/lib/api";
import { AIRTIME_NETWORKS, CABLE_TV, ELECTRICITY_DISCOS, REWARD_TIERS, SAVINGS_POTS } from "@/lib/personal";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Panel, QuickAction } from "./Widgets";
import { DonutChart } from "./Charts";
import { ModalReceipt, StatusBadge } from "./TransactionTable";
import { CardGraphic } from "./CardGraphic";
import { BrandSelect } from "./BrandSelect";
import type { ActionKind } from "./ActionModal";

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
        {rows.length === 0 && <li className="py-8 text-center text-sm font-semibold text-muted-foreground">No transactions match “{q}”.</li>}
      </ul>
      {sel && <ModalReceipt txn={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function HomeModule({ open }: { open: (k: ActionKind) => void }) {
  const [show, setShow] = useState(true);
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
          <div className="text-3xl font-black tracking-tight text-foreground">{show ? naira(PERSONAL_ACCOUNT.balance) : "••••••••"}</div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Available balance · Interest accrued: <span className="font-bold text-success">+₦12,450</span> this month</p>
          <div className="mt-5 flex gap-3 border-t-[1.5px] border-border pt-4">
            <Button variant="brand" onClick={() => open("add")}><Send className="rotate-45" /> Add Money</Button>
            <Button variant="crisp" onClick={() => open("send")}><Send /> Send Money</Button>
          </div>
        </Panel>
        <Panel title="Monthly Spending">
          <DonutChart data={PERSONAL_SPEND} center={naira(184500).split(".")[0]!} sub="Total spent" />
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <QuickAction icon={Send} title="Send Money" sub="To bank or @SlikTag" tone="bg-cobalt" onClick={() => open("send")} />
        <QuickAction icon={Smartphone} title="Airtime & Data" sub="Instant 2% cashback" tone="bg-gradient-brand" onClick={() => open("airtime")} />
        <QuickAction icon={Zap} title="Pay Utilities" sub="Electricity & Cable TV" tone="bg-magenta/80" onClick={() => open("bills")} />
        <QuickAction icon={CreditCard} title="USD Virtual Card" sub="Top up in dollars" tone="bg-magenta" onClick={() => open("fund")} />
        <QuickAction icon={ArrowLeftRight} title="Fiat-to-Coin Swap" sub="Convert NGN to USD / USDT" tone="bg-gradient-tri" onClick={() => open("swap")} />
      </div>
      <Panel title="Recent Activity">
        <ActivityList txns={PERSONAL_TXNS} limit={5} />
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
        <p className="text-sm font-semibold text-body">Send to any Nigerian bank account with 0.8s settlement.</p>
        <Button variant="crisp" className="mt-4 w-full" onClick={() => open("send")}>Start NIP transfer</Button>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border p-3 text-xs font-semibold text-muted-foreground"><QrCode className="h-4 w-4 text-cyan" /> Or scan a Slikpay QR code to pay instantly.</div>
      </Panel>
      <Panel title="Recent Activity" className="lg:col-span-1"><ActivityList txns={PERSONAL_TXNS.filter((t) => t.channel === "NIP")} /></Panel>
    </div>
  );
}

function AirtimeModule({ open }: { open: (k: ActionKind) => void }) {
  const [net, setNet] = useState("mtn");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Buy Airtime or Data">
        <p className="text-sm font-semibold text-body">Instant VTU top-up with 2% cashback on every recharge.</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {AIRTIME_NETWORKS.map((n) => (
            <button key={n.id} onClick={() => setNet(n.id)} aria-pressed={net === n.id} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all ${net === n.id ? "border-cyan bg-cyan/10 text-foreground" : "border-border text-muted-foreground hover:border-cyan/50"}`}>
              <span className={`h-8 w-8 rounded-full ${n.color}`} />
              {n.name}
            </button>
          ))}
        </div>
        <label className="mt-4 block"><span className="mb-1.5 block text-sm font-bold text-foreground">Phone number</span><input className="field font-mono" inputMode="numeric" placeholder="0803 000 0000" /></label>
        <Button variant="brand" className="mt-4 w-full" onClick={() => open("airtime")}>Continue — {AIRTIME_NETWORKS.find((n) => n.id === net)?.name}</Button>
      </Panel>
      <Panel title="Recent Top-ups"><ActivityList txns={PERSONAL_TXNS.filter((t) => t.channel === "Bills")} /></Panel>
    </div>
  );
}

function BillsModule({ open }: { open: (k: ActionKind) => void }) {
  const [tab, setTab] = useState<"power" | "cable">("power");
  const [provider, setProvider] = useState("");
  const providers = tab === "power" ? ELECTRICITY_DISCOS : CABLE_TV;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Pay a Bill">
        <div className="flex gap-2">
          {(["power", "cable"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={`flex-1 rounded-full border-2 px-4 py-2 text-sm font-bold ${tab === t ? "border-cyan bg-cyan/10 text-foreground" : "border-border text-muted-foreground"}`}>{t === "power" ? "Electricity" : "Cable TV"}</button>
          ))}
        </div>
        <label className="mt-4 block"><span className="mb-1.5 block text-sm font-bold text-foreground">{tab === "power" ? "Disco" : "Provider"}</span>
          <BrandSelect label={tab === "power" ? "Disco" : "Provider"} value={providers.includes(provider) ? provider : (providers[0] ?? "")} onChange={setProvider} options={providers.map((d) => ({ value: d, label: d }))} />
        </label>
        <label className="mt-3 block"><span className="mb-1.5 block text-sm font-bold text-foreground">{tab === "power" ? "Meter number" : "Smartcard / IUC number"}</span><input className="field font-mono" inputMode="numeric" placeholder={tab === "power" ? "45012345678" : "7034567890"} /></label>
        <Button variant="brand" className="mt-4 w-full" onClick={() => open("bills")}><Zap /> Pay now</Button>
      </Panel>
      <Panel title="Bill History"><ActivityList txns={PERSONAL_TXNS.filter((t) => t.channel === "Bills")} /></Panel>
    </div>
  );
}

function CardsModule({ open }: { open: (k: ActionKind) => void }) {
  const [frozen, setFrozen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="USD Virtual Mastercard">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="text-3xl font-black text-foreground">{usd(USD_CARD.balance)}</div>
            <p className="text-sm font-semibold text-muted-foreground">Available balance</p>
            <button className="mt-3 flex items-center gap-2 font-mono text-sm font-bold text-foreground" onClick={() => setRevealed(!revealed)}>
              {revealed ? "5399 8204 9182 8492" : "•••• •••• •••• " + USD_CARD.last4}
              {revealed ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </button>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{USD_CARD.holder} · Expires {USD_CARD.expiry}</p>
            <p className="mt-2 max-w-[220px] text-xs font-semibold text-body">Accepted worldwide for Netflix, Apple, AWS, OpenAI, and Amazon.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="brand" onClick={() => open("fund")}>+ Fund in Dollars</Button>
              <button onClick={() => { setFrozen(!frozen); toast.success(frozen ? "Card unfrozen" : "Card frozen"); }} aria-pressed={frozen} className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold ${frozen ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-muted-foreground"}`}>
                <Snowflake className="h-4 w-4" /> {frozen ? "Frozen" : "Freeze Card"}
              </button>
            </div>
          </div>
          <CardGraphic label="PERSONAL" name="Slikpay Personal" last4={USD_CARD.last4} expiry={USD_CARD.expiry} />
        </div>
      </Panel>
      <Panel title="Dedicated Sterling NUBAN">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt"><Landmark className="h-5 w-5" /></span>
          <div><p className="text-sm font-extrabold text-foreground">Sterling Bank Plc / Slikpay</p><p className="text-xs font-semibold text-muted-foreground">Beneficiary: {USD_CARD.holder}</p></div>
        </div>
        <div className="mt-5 font-mono text-3xl font-bold tracking-wider text-foreground">8204 918 234</div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Receive instant interbank transfers with 0.8s settlement.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="crisp" className="rounded-full" onClick={async () => { try { await navigator.clipboard.writeText("8204918234"); } catch { /* clipboard unavailable */ } toast.success("Account number copied", { description: "8204 918 234" }); }}><Copy /> Copy Account</Button>
          <Button variant="ghost" className="rounded-full" onClick={async () => { try { await navigator.clipboard.writeText("PATRICK OTU · Sterling Bank · 8204918234"); } catch { /* clipboard unavailable */ } toast.success("Account details copied — share anywhere"); }}><Share2 /> Share details</Button>
        </div>
      </Panel>
    </div>
  );
}

function SavingsModule() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {SAVINGS_POTS.map((p) => {
        const pct = Math.round((p.saved / p.target) * 100);
        return (
          <Panel key={p.name} title={p.name}>
            <div className="flex items-baseline justify-between"><span className="text-2xl font-black text-foreground">{naira(p.saved)}</span><span className="text-xs font-bold text-cyan">{p.rate}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{pct}% of {naira(p.target)} target · interest accrues daily</p>
          </Panel>
        );
      })}
      <Panel className="flex flex-col items-center justify-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground"><PiggyBank className="h-6 w-6" /></span>
        <p className="mt-3 text-sm font-extrabold text-foreground">Start a new target or Ajo circle</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Lock funds, earn daily interest, or rotate savings with friends.</p>
        <Button variant="brand" className="mt-4" onClick={() => toast.success("Savings plan drafted", { description: "Connect the live service to activate locks and circles." })}>Create plan</Button>
      </Panel>
    </div>
  );
}

function RewardsModule() {
  const { user } = useAuth();
  const tag = "@" + (user?.name ?? "patrick").split(" ")[0]!.toLowerCase();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Invite & Earn">
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-magenta/15 text-magenta"><Gift className="h-6 w-6" /></span><div><p className="text-sm font-extrabold text-foreground">Earn ₦1,000 per invited friend</p><p className="text-xs font-semibold text-muted-foreground">Paid instantly when they complete KYC Tier 1.</p></div></div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border p-3">
          <code className="flex-1 truncate font-mono text-sm font-bold text-foreground">slikpay.ng/r/{tag.slice(1)}</code>
          <Button variant="crisp" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`https://slikpay.ng/r/${tag.slice(1)}`); } catch { /* clipboard unavailable */ } toast.success("Referral link copied"); }}><Copy /> Copy</Button>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground"><Users className="mr-1 inline h-3.5 w-3.5" /> 3 friends joined so far · ₦3,000 earned</p>
      </Panel>
      <Panel title="Milestone Tiers">
        <ul className="space-y-3">
          {REWARD_TIERS.map((t) => (
            <li key={t.name} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${t.active ? "border-cyan bg-cyan/5" : "border-border"}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${t.active ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Gift className="h-4 w-4" /></span>
              <div className="flex-1"><p className="text-sm font-extrabold text-foreground">{t.name} {t.active && <span className="ml-1 rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-bold text-cyan">Current</span>}</p><p className="text-xs font-semibold text-muted-foreground">{t.need}</p></div>
              <p className="text-right text-xs font-bold text-foreground">{t.perk}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function ProfileModule() {
  const { user } = useAuth();
  const [bio, setBio] = useState(true);
  const tag = "@" + (user?.name ?? "patrick").split(" ")[0]!.toLowerCase();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Profile">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-lg font-black text-primary-foreground">{user?.initials ?? "PO"}</span>
          <div>
            <p className="flex items-center gap-1.5 text-base font-extrabold text-foreground">{user?.name ?? "Patrick Otu"} <BadgeCheck className="h-4 w-4 text-success" /></p>
            <p className="text-sm font-semibold text-cyan">{tag}</p>
            <p className="text-xs font-semibold text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-foreground"><BadgeCheck className="h-4 w-4 text-success" /> KYC Tier 2 Verified</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Daily limit ₦5,000,000 · Upgrade to Tier 3 for unlimited transfers.</p>
          <Button variant="crisp" size="sm" className="mt-3" onClick={() => toast.success("Tier 3 upgrade drafted", { description: "Document upload activates with the live service." })}>Upgrade to Tier 3</Button>
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
          <li className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="flex items-center gap-3 text-sm font-bold text-foreground"><CheckCircle2 className="h-5 w-5 text-success" /> Devices & sessions</span>
            <Button variant="ghost" size="sm" onClick={() => toast.info("1 active session", { description: "This device · Lagos, Nigeria" })}>Review</Button>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

export function PersonalWorkspace({ module, open }: { module: string; open: (k: ActionKind) => void }) {
  switch (module) {
    case "send": return <SendModule open={open} />;
    case "airtime": return <AirtimeModule open={open} />;
    case "bills": return <BillsModule open={open} />;
    case "cards": return <CardsModule open={open} />;
    case "savings": return <SavingsModule />;
    case "rewards": return <RewardsModule />;
    case "profile": return <ProfileModule />;
    default: return <HomeModule open={open} />;
  }
}
