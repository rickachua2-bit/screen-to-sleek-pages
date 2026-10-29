import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Download, FileSpreadsheet, History, Loader2, Lock, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";
import { bulkTotals, insufficientBulkBalance } from "@/lib/transfer-rules";
import { slikpayTransferFee } from "@/lib/transfer-validation";
import { listPaymentBatches, preparePaymentBatch, readPaymentBatch, type BatchRow } from "@/lib/bulk-payments.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { refreshBankingProfile } from "./PaddleConsole";
import { BulkImport } from "./BulkImport";
import { paymentFeedback } from "@/lib/payment-feedback";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function BulkPayments({ live, balance }: { live: boolean; balance?: number | undefined }) {
  const prepare = useServerFn(preparePaymentBatch); const read = useServerFn(readPaymentBatch); const list = useServerFn(listPaymentBatches); const run = useServerFn(runPaddleOperation);
  const [rows, setRows] = useState<BatchRow[]>([]); const [id, setId] = useState<string | null>(null);
  const [batches, setBatches] = useState<{ id: string; created_at: string }[]>([]);
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const working = useRef(false);
  const [view, setView] = useState<"new" | "history">("new");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fetchList = useCallback(async () => { try { setBatches(await list()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load saved batches."); } }, [list]);
  useEffect(() => { setLoadingHistory(true); void fetchList().finally(() => setLoadingHistory(false)); }, [fetchList, live]);
  useEffect(() => { setRows([]); setId(null); setPin(""); }, [live]);
  const open = async (batchId: string) => { const b = await read({ data: { id: batchId } }); setId(b.id); setRows(b.rows); };
  const withBusy = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Could not complete this request."); }
    finally { working.current = false; setBusy(false); }
  };
  const upload = (csv: string) => withBusy(async () => {
    const result = await prepare({ data: { csv } }); await open(result.id); await fetchList();
    if (result.reused) toast.message("This file already has a saved batch. Original payment references restored.");
  });
  const ready = rows.filter((r) => r.state === "ready"); const totals = bulkTotals(ready);
  const pending = rows.filter((r) => r.state === "pending").length;
  const invalid = rows.filter((r) => r.error).length;
  const short = insufficientBulkBalance(live, totals.total, balance);
  const send = () => withBusy(async () => {
    if (!id || short || invalid || !ready.length || (live && !/^\d{4}$/.test(pin))) return;
    for (const row of ready) {
      // Never invent a fresh key on retry/reload. Stop on any uncertain or pre-dispatch error.
      try {
        const result = await run({ data: { id: "post-payouts-transfer", params: {}, body: { amount: row.amount, destinationBankCode: row.bankCode, destinationAccountNumber: row.account, narration: row.note }, idempotencyKey: row.key, currency: "NGN", ...(pin ? { pin } : {}) } });
        await open(id);
        if (result.receipt?.status !== "succeeded") { toast.message("Batch paused. Check the recorded payment status before continuing."); break; }
      } catch (e) { await open(id); throw new Error(paymentFeedback(e, "transfer")); }
    }
    setPin(""); setReviewing(false); await refreshBankingProfile();
  });
  const exportResults = () => download(`slikpay-batch-${id}.csv`, Papa.unparse({ fields: ["bank_code", "account_number", "account_name", "amount", "fee", "status", "reference", "detail"], data: rows.map((r) => [r.bankCode, r.account, r.name ?? "", r.amount, r.error ? "" : slikpayTransferFee(r.amount), r.state, r.key, r.error ?? r.msg ?? ""]) }, { escapeFormulae: true }));
  const visible = rows.filter((r) => (filter === "all" || r.state === filter) && `${r.name ?? ""} ${r.account} ${r.bankCode} ${r.key}`.toLowerCase().includes(query.toLowerCase()));
  const sent = rows.filter((r) => r.state === "sent").length;
  return <section className="space-y-5" aria-label="Bulk payout workspace">
    <div className="grid gap-3 sm:grid-cols-3">{[
      { label: "Available NGN", value: balance !== undefined ? naira(balance) : "—", detail: live ? "Live account" : "Sandbox · test money", icon: Wallet, tint: "bg-primary/10 text-primary" },
      { label: "Current batch", value: rows.length ? `${sent} / ${rows.length}` : "—", detail: rows.length ? "Payments confirmed" : "No batch selected", icon: CheckCircle2, tint: "bg-success/10 text-success" },
      { label: "Needs attention", value: rows.length ? String(pending + rows.filter((r) => r.state === "failed").length) : "—", detail: rows.length ? `${pending} awaiting confirmation` : "Select a batch to review", icon: Clock3, tint: "bg-magenta/10 text-magenta" },
    ].map((item) => <div key={item.label} className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.tint}`}><item.icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 break-words text-lg font-bold tabular-nums text-foreground">{item.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p></div></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div className="flex gap-1" role="tablist" aria-label="Bulk payout views"><Button variant={view === "new" ? "secondary" : "ghost"} role="tab" aria-selected={view === "new"} onClick={() => setView("new")}><FileSpreadsheet />{id ? "Selected batch" : "New batch"}</Button><Button variant={view === "history" ? "secondary" : "ghost"} role="tab" aria-selected={view === "history"} onClick={() => setView("history")}><History />Batch history</Button></div><Button variant="outline" size="sm" onClick={() => download("slikpay-payment-template.csv", "bank_code,account_number,amount,note\n")}><Download />Template</Button></div>
    {view === "history" ? <div className="space-y-3"><div className="flex items-center gap-3"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input className="h-10 w-full bg-transparent text-sm outline-none" aria-label="Search batch history" placeholder="Search batch reference or date" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} /></label><Button variant="outline" size="icon" aria-label="Refresh batch history" title="Refresh batch history" disabled={busy} onClick={() => void withBusy(fetchList)}><RefreshCw /></Button></div>{loadingHistory ? <p role="status" className="py-8 text-center text-muted-foreground">Loading saved batches…</p> : batches.length === 0 ? <div className="py-10 text-center"><History className="mx-auto mb-3 h-8 w-8 text-primary" /><p className="font-semibold text-foreground">No saved batches available</p></div> : <ul className="divide-y divide-border">{batches.filter((b) => `${b.id} ${new Date(b.created_at).toLocaleString()}`.toLowerCase().includes(historyQuery.toLowerCase())).map((b) => <li key={b.id} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="font-semibold text-foreground">Batch {b.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p></div><Button variant="outline" disabled={busy} onClick={() => void withBusy(async () => { await open(b.id); setView("new"); })}>Open<ArrowRight /></Button></li>)}</ul>}</div> : !id ? <BulkImport busy={busy} onPrepare={upload} /> : <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-foreground">Batch <span className="font-mono">{id.slice(0, 8)}</span></p><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setRows([]); setId(null); setPin(""); setError(""); setQuery(""); setFilter("all"); }}><ArrowLeft />New batch</Button></div>}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {view === "new" && !!rows.length && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Payments", naira(totals.principal)], ["Transfer fees", naira(totals.fees)], ["Total debit", naira(totals.total)]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-bold tabular-nums text-foreground">{value}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{ready.length} ready · {rows.filter((r) => r.state === "sent").length} sent · {pending} pending · {rows.filter((r) => r.state === "failed").length} need attention</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={busy} onClick={() => { if (id) void withBusy(() => open(id)); }}><RefreshCw className="h-4 w-4" />Refresh status</Button><Button variant="ghost" size="sm" onClick={exportResults}><Download className="h-4 w-4" />Results</Button></div></div>
      <div className="flex flex-wrap gap-2"><input aria-label="Search batch recipients" className="field min-w-0 flex-1" placeholder="Search recipient, account or reference" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter payment status" className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>{["all", "ready", "sent", "pending", "failed"].map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value === "failed" ? "Needs attention" : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></div>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Recipient", "Account", "Amount", "Fee", "Status"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{visible.map((r) => <tr key={r.key} className="border-t border-border"><td className="p-3 font-semibold text-foreground">{r.name ?? "—"}</td><td className="p-3 font-mono text-xs">{r.bankCode} · {r.account}</td><td className="p-3 tabular-nums">{r.amount > 0 ? naira(r.amount) : "—"}</td><td className="p-3 tabular-nums">{r.error ? "—" : naira(slikpayTransferFee(r.amount))}</td><td className={`max-w-64 p-3 text-xs ${r.state === "sent" ? "text-success" : r.state === "failed" ? "text-destructive" : "text-primary"}`}><span className="font-bold capitalize">{r.state === "sent" ? "Sent" : r.state}</span>{(r.error ?? r.msg) && <span className="mt-1 block break-words text-muted-foreground">{r.error ?? r.msg}</span>}</td></tr>)}</tbody></table>{!visible.length && <p className="p-6 text-center text-sm text-muted-foreground">No matching payments</p>}</div>
      <p className="text-xs text-muted-foreground">Fee per payment: 1% of the amount, capped at ₦80.</p>
      {invalid > 0 && <p role="alert" className="text-sm text-destructive">Correct invalid or duplicate rows before sending this batch.</p>}
      {short && ready.length > 0 && <p role="alert" className="text-sm text-destructive">{balance === undefined ? "Available balance must load before sending." : "Insufficient balance including all transfer fees."}</p>}
      <Button variant="brand" disabled={busy || short || !!invalid || !!pending || !ready.length} onClick={() => { setPin(""); setReviewing(true); }}><ShieldCheck />Review {ready.length} payments<ArrowRight /></Button>
      {!!pending && <p role="status" className="text-sm text-muted-foreground">Batch paused until pending payments are confirmed. No automatic retries.</p>}
    </>}
    <Dialog open={reviewing} onOpenChange={(open) => { if (!busy) { setReviewing(open); setPin(""); } }}><DialogContent className="theme-flame max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Confirm bulk payout</DialogTitle><DialogDescription>{ready.length} verified recipients · {live ? "Live" : "Sandbox · test money"}</DialogDescription></DialogHeader><dl className="space-y-3 text-sm">{[["Payments", naira(totals.principal)], ["Transfer fees", naira(totals.fees)], ["Total debit", naira(totals.total)], ["Available NGN", balance === undefined ? "—" : naira(balance)]].map(([label, value]) => <div className="flex justify-between gap-3 border-b border-border pb-2" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums text-foreground">{value}</dd></div>)}</dl><p className="text-xs text-muted-foreground">1% per payment, capped at ₦80. Keep this page open until the batch finishes or pauses.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{live && <label className="text-sm font-semibold">Transaction PIN<input aria-label="Batch transaction PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="field mt-2" placeholder="4-digit PIN" disabled={busy} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>}<Button variant="brand" disabled={busy || short || !!invalid || !!pending || !ready.length || (live && !/^\d{4}$/.test(pin))} onClick={() => void send()}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Confirm {naira(totals.total)}</Button></DialogContent></Dialog>
  </section>;
}