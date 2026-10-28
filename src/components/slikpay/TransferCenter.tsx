import { useState } from "react";
import { CheckCircle2, Loader2, Lock, Send, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { baasService } from "@/lib/baas.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { parseBulkCsv, type BulkRow } from "@/lib/transfer-rules";
import { useBankingProfile } from "./PaddleConsole";
import { SendNip, type TransferPreview } from "./ActionModal";
import { TransferComposerLayout } from "./TransferComposerLayout";

type Row = BulkRow & { key: string; name?: string; state?: "checking" | "ready" | "sent" | "pending" | "failed"; msg?: string };

export function TransferCenter({ initial = "single" }: { initial?: "single" | "bulk" }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  const balance = profile?.balances?.["NGN"];
  const [tab, setTab] = useState(initial);
  const [k, setK] = useState(0);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  return <div className="transfer-center space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary">PAYMENTS</p><h1 className="mt-1 text-2xl font-bold text-foreground">Bank transfer</h1></div>
    <div role="tablist" aria-label="Transfer type" className="transfer-tabs">
      {([["single", "Single transfer", Send], ["bulk", "Bulk upload", Users]] as const).map(([id, label, Icon]) => <Button variant="ghost" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon className="h-4 w-4" />{label}</Button>)}
    </div>
    </div>
    {tab === "single"
      ? <TransferComposerLayout balance={balance} live={live} preview={preview}><SendNip key={k} live={live} balance={balance} onPreviewChange={setPreview} onClose={() => setK((x) => x + 1)} /></TransferComposerLayout>
      : <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-sm"><span className="text-muted-foreground">Available balance <strong className="ml-2 text-foreground">{balance !== undefined ? naira(balance) : "—"}</strong></span><span className="text-primary">{live ? "Live" : "Sandbox · test money"}</span></div><Bulk live={live} balance={balance} /></>}
  </div>;
}

function Bulk({ live, balance }: { live: boolean; balance?: number | undefined }) {
  const resolve = useServerFn(baasService); const run = useServerFn(runPaddleOperation);
  const [rows, setRows] = useState<Row[]>([]); const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const load = async (text: string) => {
    const parsed: Row[] = parseBulkCsv(text).map((r) => ({ ...r, key: crypto.randomUUID(), state: r.error ? "failed" : "checking" }));
    setRows(parsed);
    await Promise.all(parsed.map(async (r, i) => {
      if (r.error) return;
      try { const o = await resolve({ data: { operation: "resolve-account", bankCode: r.bankCode, accountNumber: r.account } }); patch(i, { name: o.accountName, state: "ready" }); }
      catch (e) { patch(i, { state: "failed", msg: e instanceof Error ? e.message : "Lookup failed" }); }
    }));
  };
  const ready = rows.filter((r) => r.state === "ready");
  const total = ready.reduce((s, r) => s + r.amount, 0);
  const short = balance !== undefined && total > balance;
  const sendAll = async () => {
    if (live && !/^\d{4}$/.test(pin)) { toast.error("Enter your 4-digit transaction PIN."); return; }
    setBusy(true);
    for (const [i, r] of rows.entries()) {
      if (r.state !== "ready") continue;
      const key = r.key;
      try { const result = await run({ data: { id: "post-payouts-transfer", params: {}, body: { amount: r.amount, destinationBankCode: r.bankCode, destinationAccountNumber: r.account, destinationAccountName: r.name, narration: r.note, reference: key }, idempotencyKey: key, currency: "NGN", ...(pin ? { pin } : {}) } }); patch(i, { state: result.receipt?.status === "succeeded" ? "sent" : result.receipt?.status === "failed" ? "failed" : "pending", msg: result.receipt?.status === "failed" ? "Bank declined payment" : "Awaiting bank confirmation" }); }
      catch (e) { patch(i, { state: "pending", msg: e instanceof Error ? e.message : "Check your ledger before retrying." }); }
    }
    setBusy(false); toast.success("Batch finished");
  };
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
    <div><h2 className="font-bold text-foreground">Upload a payment list</h2><p className="text-sm text-muted-foreground">CSV columns: bank code, account number, amount, note (optional). We check every name before anything is sent.</p></div>
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm font-bold text-foreground hover:border-primary">
      <Upload className="h-5 w-5 text-cyan" />Choose CSV file
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await load(await f.text()); }} />
    </label>
    {rows.length > 0 && <>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="p-2">Account</th><th className="p-2">Name</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border"><td className="p-2 font-mono">{r.bankCode} · {r.account}</td><td className="p-2 font-semibold">{r.name ?? "—"}</td><td className="p-2 text-right font-mono">{r.amount > 0 ? naira(r.amount) : "—"}</td>
          <td className="p-2 text-xs font-bold">{r.state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : r.state === "sent" ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />Sent</span> : r.state === "ready" ? <span className="text-cyan">Ready</span> : <span className="text-destructive">{r.error ?? r.msg}</span>}</td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-4 text-sm"><span>{ready.length} ready of {rows.length}</span><span className="font-black text-foreground">Total {naira(total)}</span></div>
      {short && <p role="alert" className="text-xs font-semibold text-destructive">The total is more than your available balance.</p>}
      <div className="flex gap-2">
        {live && <input className="field w-32 text-center font-mono tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} placeholder="PIN" aria-label="Transaction PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />}
        <Button variant="brand" className="flex-1" disabled={busy || !ready.length || short} onClick={sendAll}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Send {ready.length} payments</Button>
      </div>
    </>}
  </section>;
}
