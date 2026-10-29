import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Loader2, RefreshCw, Webhook, Clock3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrandSelect } from "./BrandSelect";
import { getWebhookEvents, reconcileWebhook } from "@/lib/developer.functions";

type History = Awaited<ReturnType<typeof getWebhookEvents>>;
export function WebhookMonitor() {
  const load = useServerFn(getWebhookEvents);
  const reconcile = useServerFn(reconcileWebhook);
  const [history, setHistory] = useState<History | null>(null);
  const [filter, setFilter] = useState<"all" | "processed" | "pending">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true); setError("");
    load({ data: { status: filter } }).then((h) => { if (active) setHistory(h); }).catch(() => { if (active) setError("Delivery history could not be loaded. Refresh to check again."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [load, filter]);
  async function refresh() {
    if (busy) return;
    setBusy(true); setError("");
    try { setHistory(await load({ data: { status: filter } })); }
    catch { setError("Delivery history could not be loaded. Refresh to check again."); }
    finally { setBusy(false); }
  }
  async function retry(id: string) {
    if (retrying) return;
    setRetrying(id);
    try {
      const result = await reconcile({ data: { id } });
      if (result.processed) toast.success("Delivery reconciled");
      else toast.info("Delivery still needs reconciliation. No new payment was sent.");
      await refresh();
    } catch { toast.error("Delivery could not be reconciled. No new payment was sent."); }
    finally { setRetrying(null); }
  }
  const shown = (history?.events ?? []).filter((e) => `${e.id} ${e.type}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Incoming webhooks</h2><p className="mt-1 text-xs text-muted-foreground">{history ? `${history.mode} · ${history.configured ? "Signature verification configured" : "Signature verification not configured"}` : "Checking delivery configuration…"}</p></div><Button variant="outline" onClick={refresh} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />Refresh</Button></div>
    <div className="grid gap-3 sm:grid-cols-3">{[
      { icon: Webhook, label: "Loaded deliveries", value: history ? history.events.length : "—", tone: "text-primary bg-primary/10" },
      { icon: CheckCircle2, label: "Processed", value: history ? history.events.filter((e) => e.processed).length : "—", tone: "text-success bg-success/10" },
      { icon: Clock3, label: "Needs reconciliation", value: history ? history.events.filter((e) => !e.processed).length : "—", tone: "text-magenta bg-magenta/10" },
    ].map(({ icon: Icon, label, value, tone }) => <div key={label} className="flex items-center gap-3 border-b border-border py-3"><span className={`rounded-md p-2.5 ${tone}`}><Icon className="size-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div></div>)}</div>
    <div className="flex flex-wrap gap-3"><input className="field min-w-0 flex-1" aria-label="Search webhook deliveries" placeholder="Search event or delivery ID…" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="w-44"><BrandSelect label="Delivery status" value={filter} onChange={(v) => { if (v === "all" || v === "processed" || v === "pending") setFilter(v); }} options={[{ value: "all", label: "All statuses" }, { value: "processed", label: "Processed" }, { value: "pending", label: "Needs reconciliation" }]} /></div></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : busy ? <p role="status" className="flex gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading deliveries…</p> : !shown.length ? <div className="py-12 text-center"><Webhook className="mx-auto mb-3 size-8 text-primary" /><h3 className="font-bold">No matching deliveries</h3><p className="mt-2 text-xs text-muted-foreground">Only deliveries for your receiving accounts in this environment appear here.</p></div> : <div className="divide-y divide-border">{shown.map((e) => <article key={e.id} className="flex flex-wrap items-center gap-3 py-4"><span className={`rounded-md p-2 ${e.processed ? "bg-success/10 text-success" : "bg-magenta/10 text-magenta"}`}>{e.processed ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}</span><div className="min-w-0 flex-1 basis-44"><p className="break-words text-sm font-bold">{e.type.replace(/paddle(?:bus)?/gi, "Slikpay")}</p><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{e.id}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(e.receivedAt).toLocaleString()}</p></div><span className={`text-xs font-semibold ${e.processed ? "text-success" : "text-magenta"}`}>{e.processed ? "Processed" : "Needs reconciliation"}</span><Button variant="ghost" size="icon" title="Copy delivery ID" aria-label={`Copy delivery ${e.id}`} onClick={() => { void navigator.clipboard.writeText(e.id).then(() => toast.success("Delivery ID copied")).catch(() => toast.error("Could not copy delivery ID")); }}><Copy /></Button>{!e.processed && <Button variant="outline" size="sm" disabled={retrying !== null} onClick={() => void retry(e.id)}>{retrying === e.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}Reconcile</Button>}</article>)}</div>}
    <div className="flex gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" /><p>Reconciliation processes the original signed event. It does not resend a transfer. Outbound merchant webhook subscriptions are not connected.</p></div>
  </section>;
}