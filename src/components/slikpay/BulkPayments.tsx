import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Lock, RefreshCw, Upload } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";
import { bulkTotals } from "@/lib/transfer-rules";
import { slikpayTransferFee } from "@/lib/transfer-validation";
import { listPaymentBatches, preparePaymentBatch, readPaymentBatch, type BatchRow } from "@/lib/bulk-payments.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { refreshBankingProfile } from "./PaddleConsole";

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
  const fetchList = useCallback(async () => { try { setBatches(await list()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load saved batches."); } }, [list]);
  useEffect(() => { void fetchList(); }, [fetchList, live]);
  useEffect(() => { setRows([]); setId(null); setPin(""); }, [live]);
  const open = async (batchId: string) => { const b = await read({ data: { id: batchId } }); setId(b.id); setRows(b.rows); };
  const withBusy = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Could not complete this request."); }
    finally { working.current = false; setBusy(false); }
  };
  const upload = (file: File) => withBusy(async () => {
    if (file.size > 1_000_000) throw new Error("Upload a CSV smaller than 1 MB.");
    const result = await prepare({ data: { csv: await file.text() } }); await open(result.id); await fetchList();
    if (result.reused) toast.message("This file already has a saved batch. Original payment references restored.");
  });
  const ready = rows.filter((r) => r.state === "ready"); const totals = bulkTotals(ready);
  const pending = rows.filter((r) => r.state === "pending").length;
  const invalid = rows.filter((r) => r.error).length;
  const short = balance === undefined || totals.total > balance;
  const send = () => withBusy(async () => {
    if (!id || short || invalid || !ready.length || (live && !/^\d{4}$/.test(pin))) return;
    for (const row of ready) {
      // Never invent a fresh key on retry/reload. Stop on any uncertain or pre-dispatch error.
      try {
        const result = await run({ data: { id: "post-payouts-transfer", params: {}, body: { amount: row.amount, destinationBankCode: row.bankCode, destinationAccountNumber: row.account, narration: row.note }, idempotencyKey: row.key, currency: "NGN", ...(pin ? { pin } : {}) } });
        await open(id);
        if (result.receipt?.status !== "succeeded") { toast.message("Batch paused. Check the recorded payment status before continuing."); break; }
      } catch (e) { await open(id); throw e; }
    }
    setPin(""); await refreshBankingProfile();
  });
  const exportResults = () => download(`slikpay-batch-${id}.csv`, Papa.unparse({ fields: ["bank_code", "account_number", "account_name", "amount", "fee", "status", "reference", "detail"], data: rows.map((r) => [r.bankCode, r.account, r.name ?? "", r.amount, r.error ? "" : slikpayTransferFee(r.amount), r.state, r.key, r.error ?? r.msg ?? ""]) }, { escapeFormulae: true }));
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-foreground">Bulk payments</h2><p className="mt-1 text-sm text-muted-foreground">NGN bank payouts</p></div><Button variant="outline" size="sm" onClick={() => download("slikpay-payment-template.csv", "bank_code,account_number,amount,note\n")}><Download className="h-4 w-4" />Template</Button></div>
    {batches.length > 0 && <label className="block text-xs font-semibold text-muted-foreground">Saved batches<select aria-label="Saved batches" className="field mt-2" disabled={busy} value={id ?? ""} onChange={(e) => { const value = e.target.value; if (value) void withBusy(() => open(value)); }}><option value="">Choose a saved batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{new Date(b.created_at).toLocaleString()} · {b.id.slice(0, 8)}</option>)}</select></label>}
    <label className={`flex min-h-32 items-center justify-center gap-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:border-primary"}`}>
      {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileSpreadsheet className="h-8 w-8 text-primary" />}<span><span className="block font-bold text-foreground">{busy ? "Checking payment records…" : "Choose payment CSV"}</span><span className="mt-1 block text-xs text-muted-foreground">Up to 500 rows · 1 MB · NGN</span></span><Upload className="h-5 w-5 text-primary" />
      <input type="file" aria-label="Upload payment CSV" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
    </label>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {!!rows.length && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Payments", naira(totals.principal)], ["Transfer fees", naira(totals.fees)], ["Total debit", naira(totals.total)]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-bold tabular-nums text-foreground">{value}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{ready.length} ready · {rows.filter((r) => r.state === "sent").length} sent · {pending} pending · {rows.filter((r) => r.state === "failed").length} need attention</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={busy} onClick={() => { if (id) void withBusy(() => open(id)); }}><RefreshCw className="h-4 w-4" />Refresh status</Button><Button variant="ghost" size="sm" onClick={exportResults}><Download className="h-4 w-4" />Results</Button></div></div>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Recipient", "Account", "Amount", "Fee", "Status"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.key} className="border-t border-border"><td className="p-3 font-semibold text-foreground">{r.name ?? "—"}</td><td className="p-3 font-mono text-xs">{r.bankCode} · {r.account}</td><td className="p-3 tabular-nums">{r.amount > 0 ? naira(r.amount) : "—"}</td><td className="p-3 tabular-nums">{r.error ? "—" : naira(slikpayTransferFee(r.amount))}</td><td className={`max-w-64 p-3 text-xs ${r.state === "sent" ? "text-success" : r.state === "failed" ? "text-destructive" : "text-primary"}`}><span className="font-bold capitalize">{r.state === "sent" ? "Sent" : r.state}</span>{(r.error ?? r.msg) && <span className="mt-1 block break-words text-muted-foreground">{r.error ?? r.msg}</span>}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Fee per payment: 1% of the amount, capped at ₦80.</p>
      {invalid > 0 && <p role="alert" className="text-sm text-destructive">Correct invalid or duplicate rows before sending this batch.</p>}
      {short && ready.length > 0 && <p role="alert" className="text-sm text-destructive">{balance === undefined ? "Available balance must load before sending." : "Insufficient balance including all transfer fees."}</p>}
      <div className="flex flex-wrap gap-3">{live && <input aria-label="Batch transaction PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="field w-36 text-center" placeholder="4-digit PIN" disabled={busy} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />}<Button variant="brand" disabled={busy || short || !!invalid || !!pending || !ready.length || (live && !/^\d{4}$/.test(pin))} onClick={() => void send()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Send {ready.length} payments · {naira(totals.total)}</Button></div>
      {!!pending && <p role="status" className="text-sm text-muted-foreground">Batch paused until pending payments are confirmed. No automatic retries.</p>}
    </>}
  </section>;
}