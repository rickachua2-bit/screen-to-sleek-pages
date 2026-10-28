import { useState } from "react";
import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportTransactionsCsv, type Txn } from "@/lib/api";
import { filterLedger } from "@/lib/merchant";
import { TransactionTable } from "./TransactionTable";

export function MerchantLedger({ txns, globalSearch = "", recent = false, onViewAll }: { txns: Txn[]; globalSearch?: string; recent?: boolean; onViewAll?: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = filterLedger(txns, query || globalSearch, status, from, to);
  return <section className="merchant-ledger rounded-lg border border-border bg-card p-4 md:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-extrabold">{recent ? "Recent Transactions" : "Transactions & Ledger"}</h2><p className="mt-1 text-xs text-muted-foreground">{rows.length} transactions</p></div>
      <div className="flex gap-2"><Button variant="crisp" size="sm" onClick={() => exportTransactionsCsv(rows)}><Download />Export CSV</Button>{recent && <Button variant="ghost" size="sm" onClick={onViewAll}>View all →</Button>}</div>
    </div>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_155px_155px_auto]">
      <label className="relative self-end"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search ledger" className="field pl-9 text-sm" placeholder="Customer, reference or channel" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label className="text-xs text-muted-foreground">Status<select className="field mt-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>{["All", "Successful", "Pending", "Failed"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="text-xs text-muted-foreground">From<input aria-label="From date" className="field mt-1 text-sm" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs text-muted-foreground">To<input aria-label="To date" className="field mt-1 text-sm" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
      <Button variant="ghost" size="icon" className="self-end" aria-label="Clear ledger filters" title="Clear filters" onClick={() => { setQuery(""); setStatus("All"); setFrom(""); setTo(""); }}><X /></Button>
    </div>
    {rows.length ? <TransactionTable txns={rows} /> : <div className="py-12 text-center text-sm text-muted-foreground">No transactions match your filters.</div>}
  </section>;
}