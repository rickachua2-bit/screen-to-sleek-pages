import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Clock, Download, Scale, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportTransactionsCsv, naira, type Txn } from "@/lib/api";
import { filterLedger } from "@/lib/merchant";
import { matchLedger, parseLedgerQuery, runningBalances } from "@/lib/ledger-query";
import { FlowChart } from "./FlowChart";
import { TransactionTable } from "./TransactionTable";

const STATUSES = ["All", "Successful", "Pending", "Failed"] as const;
const FLOWS = [{ v: "all", l: "All" }, { v: "credit", l: "Money in" }, { v: "debit", l: "Money out" }] as const;
const PRESETS = [{ l: "Today", d: 0 }, { l: "7 days", d: 7 }, { l: "30 days", d: 30 }, { l: "90 days", d: 90 }];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const PAGE = 25;

export function MerchantLedger({ txns, globalSearch = "", recent = false, onViewAll, balance }: { balance?: number | undefined; txns: Txn[]; globalSearch?: string; recent?: boolean; onViewAll?: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [flow, setFlow] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preset, setPreset] = useState<string>("");
  const [limit, setLimit] = useState(PAGE);

  const smart = useMemo(() => parseLedgerQuery(query || globalSearch), [query, globalSearch]);
  const balances = useMemo(() => balance === undefined ? undefined : runningBalances([...txns].sort((a, b) => b.date.localeCompare(a.date)), balance), [txns, balance]);
  const base = useMemo(() => filterLedger(txns, "", "All", from, to).filter((t) => (flow === "all" || t.direction === flow) && matchLedger(t, smart)), [txns, smart, from, to, flow]);
  const rows = status === "All" ? base : base.filter((t) => t.status === status);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, s === "All" ? base.length : base.filter((t) => t.status === s).length]));
  const ok = base.filter((t) => t.status === "Successful");
  const moneyIn = ok.filter((t) => t.direction === "credit").reduce((a, t) => a + t.amount, 0);
  const moneyOut = ok.filter((t) => t.direction === "debit").reduce((a, t) => a + t.amount, 0);
  const pending = base.filter((t) => t.status === "Pending").reduce((a, t) => a + t.amount, 0);
  const shown = recent ? rows.slice(0, 8) : rows.slice(0, limit);
  const filtered = Boolean(query || from || to || flow !== "all" || status !== "All");

  const applyPreset = (l: string, d: number) => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - d); setFrom(iso(start)); setTo(iso(now)); setPreset(l); setLimit(PAGE); };
  const clear = () => { setQuery(""); setStatus("All"); setFlow("all"); setFrom(""); setTo(""); setPreset(""); setLimit(PAGE); };

  return <section className="ledger-shell rounded-2xl border border-border bg-card p-4 md:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{recent ? "Activity" : "Ledger"}</p>
        <h2 className="mt-1 text-xl font-black">{recent ? "Recent transactions" : "Transactions & ledger"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "entry" : "entries"}{filtered ? " match your filters" : ""}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="crisp" size="sm" className="rounded-full" onClick={() => exportTransactionsCsv(rows)} disabled={!rows.length}><Download />Export CSV</Button>
        {recent && <Button variant="brand" size="sm" className="rounded-full" onClick={onViewAll}>View all →</Button>}
      </div>
    </div>

    {!recent && <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={ArrowDownLeft} tone="in" label="Money in" value={naira(moneyIn)} note={`${ok.filter((t) => t.direction === "credit").length} successful`} />
      <Stat icon={ArrowUpRight} tone="out" label="Money out" value={naira(moneyOut)} note={`${ok.filter((t) => t.direction === "debit").length} successful`} />
      <Stat icon={Scale} tone="net" label="Net flow" value={`${moneyIn - moneyOut < 0 ? "−" : "+"}${naira(Math.abs(moneyIn - moneyOut))}`} note="In minus out" />
      <Stat icon={Clock} tone="pending" label="Pending" value={naira(pending)} note={`${counts["Pending"]} awaiting`} />
    </div>}

    {!recent && base.length > 0 && <FlowChart txns={base} />}

    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="ledger-search relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search ledger" className="h-10 w-full rounded-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground" placeholder={'Try "failed over 50k", "received from Ada in March"'} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} /></label>
        <div className="ledger-seg" role="radiogroup" aria-label="Direction">{FLOWS.map((f) => <button key={f.v} type="button" role="radio" aria-checked={flow === f.v} onClick={() => { setFlow(f.v); setLimit(PAGE); }}>{f.l}</button>)}</div>
      </div>
      {smart.chips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold text-muted-foreground">Understood:</span>{smart.chips.map((c) => <span key={c} className="ledger-chip">{c}</span>)}{smart.text && <span className="ledger-chip is-text">“{smart.text}”</span>}</div>}
      {!recent && <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">{STATUSES.map((s) => <button key={s} type="button" role="tab" aria-selected={status === s} className={`ledger-tab is-${s.toLowerCase()}`} onClick={() => { setStatus(s); setLimit(PAGE); }}>{s}<span>{counts[s]}</span></button>)}</div>
        <span className="mx-1 hidden h-5 w-px bg-border md:block" />
        <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.l} type="button" aria-pressed={preset === p.l} className="ledger-preset" onClick={() => applyPreset(p.l, p.d)}>{p.l}</button>)}</div>
        <div className="ledger-dates flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted-foreground" /><input aria-label="From date" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset(""); }} /><span className="text-xs text-muted-foreground">to</span><input aria-label="To date" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset(""); }} /></div>
        {filtered && <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={clear}><X className="h-3.5 w-3.5" />Clear</Button>}
      </div>}
    </div>

    {shown.length ? <TransactionTable txns={shown} balances={balances} /> : <div className="ledger-empty flex flex-col items-center gap-2 rounded-xl py-14 text-center"><Search className="h-6 w-6 text-muted-foreground" /><p className="text-sm font-bold">{txns.length ? "Nothing matches these filters" : "No transactions yet"}</p><p className="text-xs text-muted-foreground">{txns.length ? "Try a wider date range or clear filters." : "Money you send or receive will appear here instantly."}</p>{filtered && <Button variant="crisp" size="sm" className="mt-2 rounded-full" onClick={clear}>Clear filters</Button>}</div>}
    {!recent && rows.length > limit && <div className="mt-4 flex justify-center"><Button variant="crisp" size="sm" className="rounded-full" onClick={() => setLimit((l) => l + PAGE)}>Show more · {rows.length - limit} left</Button></div>}
  </section>;
}

function Stat({ icon: Icon, tone, label, value, note }: { icon: typeof Scale; tone: "in" | "out" | "net" | "pending"; label: string; value: string; note: string }) {
  return <div className={`ledger-stat tone-${tone} rounded-xl p-4`}>
    <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><span className="ledger-stat-icon grid h-8 w-8 place-items-center rounded-full"><Icon className="h-4 w-4" /></span></div>
    <div className="mt-2 truncate text-lg font-black tabular-nums">{value}</div>
    <div className="mt-0.5 text-[11px] text-muted-foreground">{note}</div>
  </div>;
}
