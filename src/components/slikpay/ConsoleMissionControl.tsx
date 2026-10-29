import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Code2, Copy, Loader2, Webhook } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getWebhookEvents } from "@/lib/developer.functions";
import { API_PATHS, DOCS_URL } from "@/lib/business-api";
import { whiteLabelConsoleText } from "@/lib/console-safety";
import { BrandSelect } from "./BrandSelect";
import { BusinessApiKeys } from "./BusinessApiKeys";
import type { BankingSnapshot } from "./PaddleConsole";

type History = Awaited<ReturnType<typeof getWebhookEvents>>;
export function ConsoleMissionControl({ profile, onWebhooks }: { profile: BankingSnapshot["profile"]; onWebhooks: () => void }) {
  const load = useServerFn(getWebhookEvents);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState("24");
  const [language, setLanguage] = useState("cURL");
  useEffect(() => {
    let active = true;
    setHistory(null); setError(false);
    load({ data: { status: "all" } }).then((result) => { if (active) setHistory(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [load, profile?.mode]);
  const hours = Number(period);
  const now = Date.now();
  const start = now - hours * 3600000;
  const receipts = profile?.receipts.filter((r) => new Date(r.created_at).getTime() >= start && r.mode === profile.mode) ?? [];
  const completed = receipts.filter((r) => r.status === "succeeded").length;
  const pending = receipts.filter((r) => r.status !== "succeeded" && r.status !== "failed").length;
  const events = history?.events.filter((e) => new Date(e.receivedAt).getTime() >= start) ?? [];
  const chart = Array.from({ length: 12 }, (_, index) => {
    const from = start + index * hours * 3600000 / 12;
    const to = from + hours * 3600000 / 12;
    const rows = receipts.filter((r) => { const time = new Date(r.created_at).getTime(); return time >= from && time < to; });
    return { time: new Date(from).toLocaleString(undefined, hours <= 24 ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric", hour: "2-digit" }), total: rows.length, completed: rows.filter((r) => r.status === "succeeded").length, failed: rows.filter((r) => r.status === "failed").length };
  });
  const code = language === "cURL" ? `curl "$SLIKPAY_APP_URL${API_PATHS[0].path}" \\\n  -H "Authorization: Bearer $SLIKPAY_SECRET_KEY"` : language === "Node.js" ? `const response = await fetch(\n  process.env.SLIKPAY_APP_URL + "${API_PATHS[0].path}",\n  { headers: { Authorization:\n      \`Bearer \${process.env.SLIKPAY_SECRET_KEY}\` } }\n);\nif (!response.ok) throw new Error("Request failed");\nconst balances = await response.json();` : `import os, requests\n\nresponse = requests.get(\n  os.environ["SLIKPAY_APP_URL"] +\n  "${API_PATHS[0].path}",\n  headers={"Authorization":\n    "Bearer " + os.environ["SLIKPAY_SECRET_KEY"]}\n)\nresponse.raise_for_status()\nbalances = response.json()`;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold text-primary">DEVELOPER WORKSPACE</p><h2 className="text-3xl font-extrabold">Mission Control</h2><p className="mt-2 text-sm text-muted-foreground">Your integration, at a glance.</p></div><div className="w-44"><BrandSelect label="Activity period" value={period} onChange={setPeriod} options={[{ value: "24", label: "Last 24 hours" }, { value: "168", label: "Last 7 days" }, { value: "720", label: "Last 30 days" }]} /></div></header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: "Payment attempts", value: profile ? receipts.length.toLocaleString() : "—", detail: "Recorded in this period", icon: Activity, tone: "primary" },
      { label: "Completed", value: profile && receipts.length ? `${(completed / receipts.length * 100).toFixed(1)}%` : "—", detail: profile ? `${completed} confirmed payments` : "Awaiting account data", icon: CheckCircle2, tone: "success" },
      { label: "Pending attempts", value: profile ? pending.toLocaleString() : "—", detail: "Not confirmed as paid", icon: Clock3, tone: "magenta" },
      { label: "Incoming webhooks", value: history ? events.length.toLocaleString() : "—", detail: error ? "History unavailable" : "Recorded in this period", icon: Webhook, tone: "primary" },
    ].map(({ label, value, detail, icon: Icon, tone }) => <article className="mission-metric" data-tone={tone} key={label}><span className="mission-metric-icon"><Icon className="size-5" /></span><p className="text-xs font-semibold text-muted-foreground">{label}</p><strong className="mt-3 block text-3xl font-extrabold tabular-nums">{value}</strong><p className="mt-2 text-[11px] text-muted-foreground">{detail}</p></article>)}</div>
    <div className="mission-activity-grid">
      <section className="mission-section"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Payment activity</h3><div className="flex flex-wrap gap-3 text-[10px] font-semibold"><span className="text-primary">● Total</span><span className="text-success">● Completed</span><span className="text-magenta">● Failed</span></div></div><p className="mt-2 text-xs text-muted-foreground">Latest recorded attempts · {profile?.mode ?? "Checking environment"}</p><div className="mt-5 h-64 min-w-0">{!profile || !receipts.length ? <div className="mission-empty"><Activity className="size-7 text-primary" /><p>{profile ? "No payment activity in this period" : "Payment activity unavailable"}</p></div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 8, left: -25, bottom: 5 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} minTickGap={45} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: 8 }} /><Area name="Total" dataKey="total" type="linear" stroke="var(--cobalt)" fill="var(--cobalt)" fillOpacity={0.1} strokeWidth={2} /><Area name="Completed" dataKey="completed" type="linear" stroke="var(--success)" fill="transparent" strokeWidth={2} /><Area name="Failed" dataKey="failed" type="linear" stroke="var(--magenta)" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer>}</div><p className="mt-2 text-[10px] text-muted-foreground">Based on loaded payment receipts, not all API requests. Request latency is not collected.</p></section>
      <section className="mission-section"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">Webhook events</h3><Webhook className="size-4 text-primary" /></div><p className="mt-2 text-xs text-muted-foreground">Incoming · {history?.configured ? "Signature check configured" : history ? "Signature check not configured" : "Checking configuration"}</p><div className="mt-4 min-h-60">{error ? <p role="alert" className="py-8 text-sm text-destructive">Webhook history is unavailable.</p> : !history ? <p className="flex items-center gap-2 py-8 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading events…</p> : !events.length ? <div className="mission-empty"><Webhook className="size-7 text-primary" /><p>No events in this period</p></div> : events.slice(0, 5).map((e) => <div key={e.id} className="flex items-start gap-3 border-b border-border py-3"><span className={`rounded-md p-1.5 ${e.processed ? "bg-success-soft text-success" : "bg-magenta/10 text-magenta"}`}>{e.processed ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}</span><div className="min-w-0 flex-1"><p className="break-words text-xs font-bold">{whiteLabelConsoleText(e.type)}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={e.id}>{e.id}</p><p className="mt-1 text-[10px] text-muted-foreground">{e.processed ? "Processed" : "Needs reconciliation"} · {new Date(e.receivedAt).toLocaleTimeString()}</p></div></div>)}</div><Button variant="link" className="px-0 text-xs" onClick={onWebhooks}>View all events<ArrowRight /></Button></section>
    </div>
    <div className="mission-bottom-grid"><section className="mission-section"><BusinessApiKeys compact /></section><section className="mission-section"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><Code2 className="size-4 text-primary" />Quick start</h3><div className="flex gap-1">{["cURL", "Node.js", "Python"].map((name) => <Button key={name} variant="ghost" size="sm" aria-pressed={language === name} onClick={() => setLanguage(name)} className={`h-8 px-2 text-[11px] ${language === name ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{name}</Button>)}</div></div><div className="mission-code mt-4"><Button variant="ghost" size="icon" className="absolute right-2 top-2" aria-label="Copy quick-start code" title="Copy code" onClick={() => void navigator.clipboard.writeText(code).then(() => toast.success("Code copied")).catch(() => toast.error("Could not copy code"))}><Copy /></Button><pre className="overflow-x-auto pr-7 text-[11px] leading-6"><code>{code}</code></pre></div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">SLIKPAY_APP_URL is your Slikpay app address. Set your claimed business secret as a server-only environment variable. This example reads balances; it does not move money.</p><Button asChild variant="link" className="mt-2 px-0 text-xs"><a href={DOCS_URL} target="_blank" rel="noreferrer noopener">Read documentation<ArrowUpRight /></a></Button></section></div>
  </div>;
}