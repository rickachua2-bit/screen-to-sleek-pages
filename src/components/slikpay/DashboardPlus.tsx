import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy, CreditCard, Eye, EyeOff, Landmark, Link2, Plus, RefreshCw, Search, Send, Settings2, Sparkles, TrendingDown, TrendingUp, UserPlus, Wallet, X, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";
import { naira, type Txn } from "@/lib/api";
import { dailyInflow, greetingFor, insights, mask, relativeTime, setHideAmounts, useHideAmounts } from "@/lib/insights";
import { MERCHANT_NAV } from "@/lib/merchant";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ActionKind } from "./ActionModal";

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(); const a = from.current; let raf = 0;
    const step = (t: number) => { const p = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - p, 3); setV(a + (target - a) * e); if (p < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values); const w = 160, h = 44;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 6) - 3}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-40" aria-hidden><defs><linearGradient id="spk" x1="0" x2="1"><stop offset="0" stopColor="var(--cyan)" /><stop offset="1" stopColor="var(--magenta)" /></linearGradient></defs><polyline points={pts} fill="none" stroke="url(#spk)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PrivacyToggle({ className = "" }: { className?: string }) {
  const hidden = useHideAmounts();
  return <Button variant="ghost" size="icon" className={className} aria-label={hidden ? "Show amounts" : "Hide amounts"} aria-pressed={hidden} onClick={() => setHideAmounts(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button>;
}

export function DashboardHero({ name, business, balance, mode, txns, onOpenCommand, onGoLive }: { name: string; business?: string | null | undefined; balance: number; mode?: string | undefined; txns: Txn[]; onOpenCommand: () => void; onGoLive: () => void }) {
  const hidden = useHideAmounts();
  const shown = useCountUp(balance);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  const spark = useMemo(() => dailyInflow(txns, 7).map((d) => d.value), [txns]);
  const live = mode === "live";
  return <section className="hero-surface p-6 md:p-8">
    <div className="relative flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground/80">{hour === null ? "Welcome back" : greetingFor(hour)}, {name.split(" ")[0]} 👋</p>
        <h2 className="mt-1 truncate text-sm font-bold text-foreground/90">{business ?? "Your business"}</h2>
        <div className="mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/70">Settlement balance<PrivacyToggle className="h-7 w-7" /></div>
        <div className="font-mono text-4xl font-bold tracking-tight text-foreground md:text-5xl" aria-live="polite">{mask(naira(shown), hidden)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={live ? undefined : onGoLive} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${live ? "bg-success-soft text-success" : "bg-chart-4/20 text-chart-4"}`}><span className={`h-1.5 w-1.5 rounded-full motion-safe:animate-pulse ${live ? "bg-success" : "bg-chart-4"}`} />{live ? "Live mode" : "Sandbox · tap to go live"}</button>
          <button onClick={onOpenCommand} className="flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] font-semibold text-foreground/80 hover:text-foreground"><Search className="h-3 w-3" />Quick search<kbd className="rounded bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd></button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1"><span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Inflow · 7 days</span><Sparkline values={spark} /><span className="font-mono text-sm font-bold text-foreground">{mask(naira(spark.reduce((a, b) => a + b, 0)), hidden)}</span></div>
    </div>
  </section>;
}

export function InsightsStrip({ txns }: { txns: Txn[] }) {
  const hidden = useHideAmounts();
  const i = useMemo(() => insights(txns), [txns]);
  const items: { icon: typeof TrendingUp; tone: string; label: string; value: string }[] = [
    { icon: i.pct !== null && i.pct < 0 ? TrendingDown : TrendingUp, tone: i.pct !== null && i.pct < 0 ? "text-magenta" : "text-success", label: "Inflow this week", value: i.pct === null ? mask(naira(i.thisWeek), hidden) : `${i.pct > 0 ? "+" : ""}${i.pct}% vs last week` },
    { icon: ArrowUpRight, tone: "text-cyan", label: "Paid out this week", value: mask(naira(i.outflow), hidden) },
    { icon: Clock, tone: "text-chart-4", label: "Pending", value: `${i.pending} transaction${i.pending === 1 ? "" : "s"}` },
    { icon: Sparkles, tone: "text-magenta", label: "Top customer", value: i.topCustomer ? `${i.topCustomer.name}` : "No payments yet" },
  ];
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(({ icon: Icon, tone, label, value }) => <div key={label} className="panel hover-lift flex items-center gap-3 p-4"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted ${tone}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="truncate text-sm font-extrabold">{value}</p></div></div>)}</div>;
}

export function FlipNubanCard({ nuban, accountName, bankName, status, sandbox }: { nuban: string; accountName?: string | null | undefined; bankName?: string | null | undefined; status?: string | null | undefined; sandbox?: boolean | undefined }) {
  const [flipped, setFlipped] = useState(false);
  const pretty = `${nuban.slice(0, 4)} ${nuban.slice(4, 8)} ${nuban.slice(8)}`;
  const share = [accountName, bankName, nuban].filter(Boolean).join(" · ");
  const copy = async (e: React.MouseEvent) => { e.stopPropagation(); try { await navigator.clipboard.writeText(share); } catch { /* clipboard unavailable */ } toast.success("Account details copied", { description: share }); };
  const face = "flip-face shine flex h-full min-h-[210px] flex-col justify-between rounded-2xl border border-border bg-gradient-tri p-6 text-primary-foreground shadow-cobalt";
  return <div className="flip-scene"><div role="button" tabIndex={0} aria-label="Flip account card" onClick={() => setFlipped(!flipped)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped(!flipped); } }} className={`flip-inner cursor-pointer ${flipped ? "is-flipped" : ""}`}>
    <div className={face}>
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Landmark className="h-4 w-4" />{sandbox ? "Sandbox account" : "Business account"}</span>{status && <span className="rounded-full bg-background/25 px-2.5 py-1 text-[10px] font-bold">{status === "ACTIVE" ? "● Active" : status}</span>}</div>
      <div><div className="font-mono text-3xl font-bold tracking-widest">{pretty}</div><p className="mt-2 text-[11px] font-semibold opacity-80">Tap card to see account name & bank</p></div>
    </div>
    <div className={`${face} flip-back`}>
      <dl className="space-y-3 text-sm"><div><dt className="text-[10px] font-bold uppercase opacity-75">Account name</dt><dd className="font-bold">{accountName ?? "—"}</dd></div><div><dt className="text-[10px] font-bold uppercase opacity-75">Bank</dt><dd className="font-bold">{bankName ?? "—"}</dd></div><div><dt className="text-[10px] font-bold uppercase opacity-75">Account number</dt><dd className="font-mono font-bold">{nuban}</dd></div></dl>
      <Button variant="crisp" size="sm" className="self-start rounded-full" onClick={copy}><Copy />Copy details</Button>
    </div>
  </div></div>;
}

const FILTERS = ["All", "In", "Out", "Pending"] as const;
export function ActivityFeed({ txns, onViewAll }: { txns: Txn[]; onViewAll: () => void }) {
  const hidden = useHideAmounts();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const list = txns.filter((t) => f === "All" || (f === "In" && t.direction === "credit") || (f === "Out" && t.direction === "debit") || (f === "Pending" && t.status === "Pending")).slice(0, 6);
  return <section className="panel p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">Live activity</h3><div className="flex gap-1">{FILTERS.map((x) => <button key={x} onClick={() => setF(x)} aria-pressed={f === x} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${f === x ? "bg-gradient-tri text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{x}</button>)}</div></div>
    {list.length === 0 ? <EmptyState icon={Inbox} title="Nothing here yet" text="New payments will appear here the moment they land." /> : <ul className="space-y-1">{list.map((t, idx) => { const credit = t.direction === "credit"; return <li key={t.id} className="feed-in flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50" style={{ animationDelay: `${idx * 60}ms` }}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${credit ? "bg-success-soft text-success" : "bg-magenta/15 text-magenta"}`}>{credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.customer}</p><p className="text-[11px] text-muted-foreground">{t.channel} · {relativeTime(t.date)}</p></div>
      <div className="text-right"><p className={`font-mono text-sm font-bold ${credit ? "text-success" : "text-foreground"}`}>{hidden ? "••••" : `${credit ? "+" : "−"}${naira(t.amount)}`}</p><p className={`text-[10px] font-bold ${t.status === "Successful" ? "text-muted-foreground" : t.status === "Pending" ? "text-chart-4" : "text-destructive"}`}>{t.status}</p></div>
    </li>; })}</ul>}
    <Button variant="ghost" size="sm" className="mt-3 w-full text-cyan" onClick={onViewAll}>View full ledger →</Button>
  </section>;
}

export function EmptyState({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) {
  return <div className="flex flex-col items-center py-8 text-center"><span className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-tri text-primary-foreground shadow-cobalt"><Icon className="h-6 w-6" /></span><p className="text-sm font-extrabold">{title}</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">{text}</p></div>;
}

export interface QuickItem { label: string; icon: typeof Send; run: () => void }
export function merchantQuickActions(open: (k: ActionKind) => void, go: (m: string) => void, refresh: () => void): QuickItem[] {
  return [
    { label: "Send money", icon: Send, run: () => open("send") },
    { label: "Payment link", icon: Link2, run: () => go("links") },
    { label: "Fund card", icon: CreditCard, run: () => open("fund") },
    { label: "Add beneficiary", icon: UserPlus, run: () => go("banking") },
    { label: "Request payment", icon: Wallet, run: () => go("links") },
    { label: "Refresh", icon: RefreshCw, run: refresh },
  ];
}

export function QuickActionFab({ items, raised }: { items: QuickItem[]; raised?: boolean | undefined }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open]);
  const r = 112;
  return <>
    {open && <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}
    <div className={`fixed right-5 z-50 md:right-8 ${raised ? "bottom-24 lg:bottom-8" : "bottom-8"}`}>
      {open && items.map(({ label, icon: Icon, run }, i) => { const a = (Math.PI / 2) * (i / Math.max(1, items.length - 1)); const tx = `${-Math.cos(a) * r}px`, ty = `${-Math.sin(a) * r}px`; return <button key={label} onClick={() => { setOpen(false); run(); }} className="fab-item group absolute bottom-1 right-1 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-cyan shadow-cobalt hover:text-magenta" style={{ "--tx": tx, "--ty": ty, animationDelay: `${i * 30}ms` } as React.CSSProperties} aria-label={label} title={label}><Icon className="h-5 w-5" /><span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md bg-background px-2 py-1 text-[10px] font-bold text-foreground opacity-0 shadow-cobalt transition-opacity group-hover:opacity-100">{label}</span></button>; })}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close quick actions" : "Open quick actions"} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground shadow-cobalt transition-transform hover:scale-105"><span className="absolute inset-0 rounded-full bg-gradient-tri opacity-60 blur-md" /><span className={`relative transition-transform duration-300 ${open ? "rotate-45" : ""}`}>{open ? <X /> : <Plus />}</span></button>
    </div>
  </>;
}

export function CommandPalette({ open, onOpenChange, actions, go, txns }: { open: boolean; onOpenChange: (v: boolean) => void; actions: QuickItem[]; go: (m: string) => void; txns: Txn[] }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); } }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open, onOpenChange]);
  const run = (fn: () => void) => { onOpenChange(false); fn(); };
  return <CommandDialog open={open} onOpenChange={onOpenChange}>
    <CommandInput placeholder="Type an action, page or customer…" />
    <CommandList>
      <CommandEmpty>No matches.</CommandEmpty>
      <CommandGroup heading="Quick actions">{actions.map(({ label, icon: Icon, run: r }) => <CommandItem key={label} onSelect={() => run(r)}><Icon className="text-cyan" />{label}</CommandItem>)}</CommandGroup>
      <CommandGroup heading="Go to">{MERCHANT_NAV.map(({ label, icon: Icon, id }) => id && <CommandItem key={id} onSelect={() => run(() => go(id))}><Icon />{label}</CommandItem>)}</CommandGroup>
      {txns.length > 0 && <CommandGroup heading="Recent transactions">{txns.slice(0, 8).map((t) => <CommandItem key={t.id} value={`${t.customer} ${t.ref}`} onSelect={() => run(() => go("transactions"))}>{t.direction === "credit" ? <ArrowDownLeft className="text-success" /> : <ArrowUpRight className="text-magenta" />}<span className="flex-1 truncate">{t.customer}</span><span className="font-mono text-xs text-muted-foreground">{naira(t.amount)}</span></CommandItem>)}</CommandGroup>}
    </CommandList>
  </CommandDialog>;
}

export const TILES = [{ id: "insights", label: "Insights" }, { id: "charts", label: "Charts" }, { id: "accounts", label: "Account & card" }, { id: "activity", label: "Live activity" }, { id: "ledger", label: "Recent ledger" }] as const;
export type TileId = (typeof TILES)[number]["id"];
export function useTiles(userId?: string) {
  const key = `slikpay.tiles.${userId ?? "anon"}`;
  const [hiddenTiles, setHidden] = useState<TileId[]>([]);
  useEffect(() => { try { setHidden(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { setHidden([]); } }, [key]);
  const toggle = (id: TileId) => setHidden((h) => { const n = h.includes(id) ? h.filter((x) => x !== id) : [...h, id]; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* storage unavailable */ } return n; });
  return { show: (id: TileId) => !hiddenTiles.includes(id), toggle, hiddenTiles };
}

export function CustomiseButton({ tiles }: { tiles: ReturnType<typeof useTiles> }) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><Button variant="crisp" size="sm" className="rounded-full" onClick={() => setOpen(!open)} aria-expanded={open}><Settings2 />Customise</Button>
    {open && <div className="merchant-popover absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-background p-2 shadow-cobalt"><p className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Show on home</p>{TILES.map((t) => { const on = tiles.show(t.id); return <button key={t.id} onClick={() => tiles.toggle(t.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold hover:bg-muted"><span>{t.label}</span><span className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-gradient-tri" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all ${on ? "left-3.5" : "left-0.5"}`} /></span></button>; })}</div>}
  </div>;
}

