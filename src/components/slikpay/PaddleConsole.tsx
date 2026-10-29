import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CheckCircle2, ChevronRight, FlaskConical, Loader2, Lock, Radio, Search, ShieldCheck, Sparkles, X, Code2, Webhook, Receipt, RefreshCw, Copy, ArrowRight, KeyRound, BookOpen, ArrowUpRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrandSelect } from "./BrandSelect";
import { CATEGORIES, ENDPOINTS, accessFor, categoryOf, movesMoney, type PaddleEndpoint, type Role } from "@/lib/paddle-policy";
import { progress, stepsFor, statusOf, type StepStatus } from "@/lib/go-live";
import { getBankingProfile, runPaddleOperation, submitIdentityCheck } from "@/lib/paddle.functions";
import { consoleReceiptMessage, whiteLabelConsoleText } from "@/lib/console-safety";
import { paymentFeedback } from "@/lib/payment-feedback";
import { WebhookMonitor } from "./WebhookMonitor";

type Profile = Awaited<ReturnType<typeof getBankingProfile>>;

function label(e: PaddleEndpoint) {
  const s = e.summary.replace(/^(GET|POST|DELETE)\s+\/v1\//, "");
  if (s !== e.summary) return whiteLabelConsoleText(s.split("/").map((p) => p.replace(/[{}]/g, "").replace(/-/g, " ")).join(" › ").replace(/^\w/, (c) => c.toUpperCase()));
  return whiteLabelConsoleText(s);
}

export interface BankingSnapshot { profile: Profile | null; error: string; updatedAt: Date | null }
type BankingListener = (snapshot: BankingSnapshot) => void;
const bankingListeners = new Set<BankingListener>();
const bankingSnapshot: BankingSnapshot = { profile: null, error: "", updatedAt: null };
let bankingInFlight: Promise<void> | null = null;
let bankingLoader: (() => Promise<Profile>) | null = null;
function emitBanking() { const s = { ...bankingSnapshot }; for (const l of [...bankingListeners]) l(s); }

// One fetch per refresh, shared by every part of the shell (banner, balances, mode indicator).
export function refreshBankingProfile(load?: () => Promise<Profile>): Promise<void> {
  if (load) bankingLoader = load;
  if (bankingInFlight) return bankingInFlight;
  const loader = bankingLoader;
  if (!loader) return Promise.resolve();
  bankingInFlight = loader()
    .then((p) => { bankingSnapshot.profile = p; bankingSnapshot.error = ""; bankingSnapshot.updatedAt = new Date(); })
    .catch((e: unknown) => { bankingSnapshot.error = e instanceof Error ? e.message : "Banking profile unavailable"; })
    .finally(() => { bankingInFlight = null; emitBanking(); });
  return bankingInFlight;
}
export function resetBankingProfileForTests() {
  bankingSnapshot.profile = null; bankingSnapshot.error = ""; bankingSnapshot.updatedAt = null; bankingInFlight = null;
}

export function useBankingProfile() {
  const load = useServerFn(getBankingProfile);
  const [snapshot, setSnapshot] = useState<BankingSnapshot>({ ...bankingSnapshot });
  useEffect(() => {
    bankingLoader = load;
    bankingListeners.add(setSnapshot);
    void refreshBankingProfile();
    return () => { bankingListeners.delete(setSnapshot); };
  }, [load]);
  return { profile: snapshot.profile, error: snapshot.error, updatedAt: snapshot.updatedAt, refresh: refreshBankingProfile };
}

export function ModeBanner({ profile, error }: { profile: Profile | null; error: string }) {
  if (error) return <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">{error}</div>;
  if (!profile) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your banking environment…</div>;
  const live = profile.mode === "live";
  const bal = Object.entries(profile.balances);
  return <div className={`relative overflow-hidden rounded-2xl border p-5 ${live ? "border-cyan/40 bg-cyan/5" : "border-magenta/40 bg-magenta/5"}`}>
    <div className="relative flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${live ? "bg-cyan/20 text-cyan" : "bg-magenta/20 text-magenta"}`}>{live ? <Radio className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}</span>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Environment</p>
          <p className="text-lg font-black">{live ? "Live — real money" : "Sandbox — test money only"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(bal.length ? bal : [["NGN", 0] as [string, number]]).map(([c, v]) => <span key={c} className="rounded-xl border border-border bg-background/60 px-4 py-2 font-mono text-sm font-bold">{c} {v.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>)}
      </div>
    </div>
    {!live && !profile.sandboxReady && <p className="relative mt-3 text-xs font-semibold text-magenta">Sandbox services start once sandbox access is connected.</p>}
  </div>;
}

function ResultView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  if (typeof value !== "object") return <span className="break-all font-mono text-xs">{whiteLabelConsoleText(String(value))}</span>;
  if (Array.isArray(value)) {
    const rows = value.slice(0, 50);
    if (rows.length && rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r as object)))].slice(0, 7);
      return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-xs"><thead className="bg-cobalt/10 text-muted-foreground"><tr>{cols.map((c) => <th key={c} className="p-2 font-bold">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c} className="p-2 align-top">{depth < 2 ? <ResultView value={(r as Record<string, unknown>)[c]} depth={depth + 1} /> : "…"}</td>)}</tr>)}</tbody></table>{value.length > 50 && <p className="p-2 text-xs text-muted-foreground">Showing 50 of {value.length}</p>}</div>;
    }
    return <span className="font-mono text-xs">{whiteLabelConsoleText(rows.map((r: unknown) => (typeof r === "object" ? JSON.stringify(r) : String(r))).join(", "))}</span>;
  }
  return <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(120px,auto)_1fr]">{Object.entries(value as Record<string, unknown>).map(([k, v]) => <div key={k} className="contents"><dt className="text-xs font-bold text-muted-foreground">{k}</dt><dd>{depth < 3 ? <ResultView value={v} depth={depth + 1} /> : "…"}</dd></div>)}</dl>;
}

function Runner({ endpoint, mode, onClose, onDone }: { endpoint: PaddleEndpoint; mode: "sandbox" | "live"; onClose: () => void; onDone: () => void }) {
  const run = useServerFn(runPaddleOperation);
  const [params, setParams] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(endpoint.fields.flatMap((f) => f.enum?.[0] ? [[f.name, f.enum[0]]] : [])));
  const reference = useRef<string | null>(null);
  const submitting = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const [extra, setExtra] = useState("");
  const [pin, setPin] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<Awaited<ReturnType<typeof run>> | null>(null);
  const money = movesMoney(endpoint);
  const queryParams = endpoint.params.filter((p) => p.in === "query");
  const pathParams = endpoint.params.filter((p) => p.in === "path");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || money && attempted) return;
    setError(""); setOut(null);
    let body: Record<string, unknown> = {};
    try { body = extra.trim() ? JSON.parse(extra) as Record<string, unknown> : {}; if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); }
    catch { return setError("Additional details must be a JSON object, e.g. {\"key\": \"value\"}."); }
    for (const f of endpoint.fields) {
      const v = values[f.name]?.trim();
      if (!v) { if (f.required) return setError(`Enter ${f.name}.`); continue; }
      body[f.name] = f.type === "number" || f.type === "integer" ? Number(v) : f.type === "boolean" ? v === "true" : f.type === "array" || f.type === "object" ? (() => { try { return JSON.parse(v) as unknown; } catch { return v; } })() : v;
    }
    for (const q of queryParams) if (params[q.name]) body[q.name] = params[q.name];
    submitting.current = true; setBusy(true);
    reference.current ??= crypto.randomUUID();
    if (money) setAttempted(true);
    try {
      const r = await run({ data: { id: endpoint.id, params: Object.fromEntries(pathParams.map((p) => [p.name, params[p.name] ?? ""])), body, idempotencyKey: reference.current, pin: pin || undefined, currency } });
      setOut(r);
      if (!r.receipt || r.receipt.status === "succeeded") toast.success(r.receipt ? consoleReceiptMessage(r.receipt.status) : "Request completed");
      else if (r.receipt.status === "failed") toast.error(consoleReceiptMessage(r.receipt.status));
      else toast.info(consoleReceiptMessage(r.receipt.status));
      onDone();
    } catch (err) { setError(money ? paymentFeedback(err, "transfer") : "Request could not be completed. Refresh and try again."); onDone(); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center slik-overlay-backdrop p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={label(endpoint)} className="slik-popup max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan">{endpoint.method} · {endpoint.tag}</p>
          <h2 className="mt-1 text-xl font-black">{label(endpoint)}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{endpoint.path}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" disabled={busy} onClick={onClose}><X /></Button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {[...pathParams, ...queryParams].map((p) => <label key={p.name} className="block text-sm font-semibold text-body">{p.name}{p.required && " *"}<input className="field mt-1 w-full" value={params[p.name] ?? ""} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))} required={p.required} /></label>)}
        {endpoint.fields.filter((f) => !(endpoint.id === "post-accounts-virtual" && f.name === "bank")).map((f) => <div key={f.name}>
          {f.enum?.length ? <><p className="mb-1 text-sm font-semibold text-body">{f.name}{f.required && " *"}</p><BrandSelect label={f.name} value={values[f.name] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} options={f.enum.map((o) => ({ value: o, label: o }))} /></>
            : <label className="block text-sm font-semibold text-body">{f.name}{f.required && " *"}<input className="field mt-1 w-full" inputMode={f.type === "number" ? "decimal" : undefined} placeholder={f.example != null ? String(typeof f.example === "object" ? JSON.stringify(f.example) : f.example) : f.type} value={values[f.name] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} /></label>}
          {f.hint && <p className="mt-1 text-[11px] text-muted-foreground">{whiteLabelConsoleText(f.hint)}</p>}
        </div>)}
        {endpoint.method !== "GET" && <label className="block text-sm font-semibold text-body">{endpoint.fields.length ? "Additional details (optional JSON)" : "Request details (JSON)"}<textarea className="field mt-1 min-h-24 w-full font-mono text-xs" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder='{"amount": 5000}' /></label>}
        {money && <div className="grid gap-3 rounded-xl border border-magenta/30 bg-magenta/5 p-3 sm:grid-cols-2">
          <div><p className="mb-1 text-sm font-semibold text-body">Currency</p><BrandSelect label="Currency" value={currency} onChange={setCurrency} options={["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR", "USDT"].map((c) => ({ value: c, label: c }))} /></div>
          {mode === "live" ? <label className="block text-sm font-semibold text-body">Transaction PIN<input className="field mt-1 w-full font-mono tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
            : <p className="self-end text-xs font-semibold text-magenta">Sandbox — no real money moves.</p>}
        </div>}
        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        {money && attempted && <p role="status" className="text-xs text-muted-foreground">This attempt is recorded. Check its reference in your ledger before starting another payment.</p>}
        {reference.current && <div className="flex items-center gap-2 text-xs"><span className="min-w-0 break-all font-mono">{reference.current}</span><Button variant="ghost" size="icon" type="button" title="Copy attempt reference" aria-label="Copy attempt reference" onClick={() => { if (reference.current) void navigator.clipboard.writeText(reference.current).then(() => toast.success("Reference copied")).catch(() => toast.error("Could not copy reference")); }}><Copy /></Button></div>}
        <Button variant="brand" type="submit" disabled={busy || money && attempted} className="shine h-12 w-full bg-gradient-tri text-base">{busy && <Loader2 className="animate-spin" />}{money ? "Confirm transaction" : endpoint.method === "GET" ? "Fetch" : "Submit"}</Button>
      </form>
      {out && <div className="mt-5 space-y-3">
        {out.receipt && <div className="rounded-2xl border border-cyan/40 bg-cyan/5 p-4">
          <p className="flex items-center gap-2 font-bold text-cyan"><CheckCircle2 className="h-5 w-5" />{consoleReceiptMessage(out.receipt.status)} · {out.receipt.mode}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{out.receipt.currency} {out.receipt.amount?.toLocaleString()}</dd><dt className="text-muted-foreground">Reference</dt><dd className="break-all font-mono">{out.receipt.reference ?? "Not returned"}</dd><dt className="text-muted-foreground">NIP session ID</dt><dd className="break-all font-mono">{out.receipt.sessionId ?? "Not returned"}</dd></dl>
        </div>}
        {out.message && <p className="text-sm font-semibold text-body">{out.message}</p>}
        <div className="rounded-2xl border border-border bg-background/50 p-4"><ResultView value={JSON.parse(out.resultJson) as unknown} /></div>
      </div>}
    </div>
  </div>;
}

export function PaddleConsole({ role }: { role: Role }) {
  const { profile, error, refresh } = useBankingProfile();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PaddleEndpoint | null>(null);
  const [tab, setTab] = useState<"keys" | "explorer" | "webhooks" | "receipts" | "docs">("keys");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const mode = profile?.mode ?? "sandbox";
  const list = useMemo(() => ENDPOINTS.map((e) => ({ e, access: accessFor(e, role, mode), cat: categoryOf(e.path) })).filter((x) => x.access.allowed || role === "merchant"), [role, mode]);
  const cats = CATEGORIES.filter((c) => list.some((x) => x.cat === c.id));
  const shown = list.filter((x) => (cat === "all" || x.cat === cat) && (method === "all" || x.e.method === method) && `${label(x.e)} ${x.e.path} ${x.e.tag}`.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(shown.length / 18));
  const currentPage = Math.min(page, pages);
  const visible = shown.slice((currentPage - 1) * 18, currentPage * 18);
  const available = list.filter((x) => x.access.allowed).length;

  return <div className="developer-studio">
    <aside className="developer-studio-rail">
      <p className="text-lg font-bold">Slikpay</p><Code2 className="mt-5 size-9 text-cyan" /><h2 className="mt-3 text-2xl font-bold">Developers</h2>
      <p className="mt-2 text-xs text-muted-foreground">API & Webhooks</p>
      <div className="my-6 flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-xs font-semibold">{mode === "live" ? <Radio className="size-4 text-cyan" /> : <FlaskConical className="size-4 text-magenta" />}{profile ? `${mode === "live" ? "Live" : "Sandbox"} environment` : "Checking environment…"}</div>
      <nav className="developer-studio-navigation" aria-label="Developer workspace">{[{ id: "keys" as const, name: "API keys", icon: KeyRound }, { id: "explorer" as const, name: "Request explorer", icon: Code2 }, { id: "webhooks" as const, name: "Webhooks", icon: Webhook }, { id: "receipts" as const, name: "Payment attempts", icon: Receipt }, { id: "docs" as const, name: "Documentation", icon: BookOpen }].map(({ id, name, icon: Icon }) => <Button key={id} variant="ghost" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className="developer-studio-nav"><Icon />{name}</Button>)}</nav>
      <div className="developer-studio-readiness mt-8 border-t border-border pt-5"><p className="text-xs font-semibold text-muted-foreground">Integration readiness</p><ul className="mt-4 space-y-4 text-xs">{[{ label: "Account environment", ready: Boolean(profile) }, { label: "Business API keys", ready: false }, { label: "Outbound subscriptions", ready: false }].map((step) => <li key={step.label} className="flex items-start gap-2.5">{step.ready ? <CheckCircle2 className="size-4 shrink-0 text-cyan" /> : <Clock className="size-4 shrink-0 text-muted-foreground" />}<span>{step.label}<span className="mt-1 block text-[11px] text-muted-foreground">{step.ready ? "Connected" : "Not connected"}</span></span></li>)}</ul></div>
      <Button variant="outline" className="mt-6 w-full" onClick={() => void refresh()}><RefreshCw />Refresh account</Button>
    </aside>
    <div className="developer-studio-workspace space-y-6">
    {tab === "keys" && <section className="space-y-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">API keys and access</h2><p className="mt-2 text-sm text-muted-foreground">Business credentials · separate sandbox and live access</p></div><Button disabled title="Business key issuance is not connected"><KeyRound />Create key</Button></header>
      <div className="divide-y divide-border">{[ { name: "Sandbox secret key", detail: "Testing and development", icon: FlaskConical, tone: "text-primary bg-primary/10" }, { name: "Live secret key", detail: "Production access", icon: Radio, tone: "text-magenta bg-magenta/10" }].map(({ name, detail, icon: Icon, tone }) => <article key={name} className="flex flex-wrap items-center gap-4 py-6"><span className={`rounded-md p-3 ${tone}`}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{name}</h3><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="text-right"><p className="text-sm font-semibold">Not issued</p><p className="mt-1 text-xs text-muted-foreground">Key management not connected</p></div><Lock className="size-4 text-muted-foreground" /></article>)}</div>
      <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-3">{[{ icon: ShieldCheck, title: "Key permissions", value: "Not configured" }, { icon: RefreshCw, title: "Rotation & expiry", value: "Not configured" }, { icon: Lock, title: "IP restrictions", value: "Not configured" }].map(({ icon: Icon, title, value }) => <div key={title}><Icon className="mb-3 size-5 text-primary" /><p className="text-sm font-semibold">{title}</p><p className="mt-2 text-xs text-muted-foreground">{value}</p></div>)}</div>
      <section className="flex flex-wrap items-start justify-between gap-4 py-2"><div className="flex gap-3"><Webhook className="mt-1 size-6 text-primary" /><div><h3 className="font-bold">Webhook delivery history</h3><p className="mt-2 text-xs text-muted-foreground">Incoming signed events and reconciliation for your receiving accounts.</p></div></div><Button variant="outline" onClick={() => setTab("webhooks")}>View deliveries<ArrowUpRight /></Button></section>
      <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />Platform banking credentials stay private and are never shared as business API keys.</p>
    </section>}
    {tab === "docs" && <section className="space-y-6"><BookOpen className="size-8 text-primary" /><h2 className="text-2xl font-bold">Developer documentation</h2><p className="text-sm text-muted-foreground">Public Slikpay API documentation is not published yet. Business API endpoints and credentials are not available.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setTab("explorer")}><Code2 />Browse connected operations</Button><Button variant="outline" onClick={() => setTab("webhooks")}><Webhook />Check incoming events</Button></div></section>}
    {error && <p role="alert" className="text-sm text-destructive">Account information is unavailable. Refresh before making a request.</p>}
    {tab === "webhooks" && <WebhookMonitor />}
    {tab === "explorer" && <>
    <header><h2 className="text-2xl font-bold">Request explorer</h2><p className="mt-2 text-xs text-muted-foreground">{available} accessible operations · {mode} environment</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{shown.length}</span> operations</p>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto"><label className="relative min-w-0 flex-1 sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search services" className="field h-11 w-full pl-9" placeholder="Search name or endpoint…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label><div className="w-28"><BrandSelect label="Request method" value={method} onChange={(v) => { setMethod(v); setPage(1); }} options={["all", "GET", "POST", "DELETE"].map((v) => ({ value: v, label: v === "all" ? "All methods" : v }))} /></div></div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {[{ id: "all", label: "All" }, ...cats].map((c) => <Button key={c.id} variant="outline" size="sm" aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setPage(1); }} className={`shrink-0 ${cat === c.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{c.label}</Button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {visible.map(({ e, access }) => <Button variant="outline" key={e.id} disabled={!profile || !access.allowed} onClick={() => setOpen(e)} className="group flex h-auto min-h-28 items-start gap-3 whitespace-normal rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-65">
        <span className={`mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${e.method === "GET" ? "bg-cyan/15 text-cyan" : e.method === "DELETE" ? "bg-destructive/15 text-destructive" : "bg-magenta/15 text-magenta"}`}>{e.method}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{label(e)}</span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{e.path}</span>
          {!access.allowed ? <span className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{access.reason}</span> : <span className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${movesMoney(e) ? "text-magenta" : "text-primary"}`}>{movesMoney(e) ? <><Sparkles className="h-3 w-3" />Payment · confirmation required</> : <><ShieldCheck className="h-3 w-3" />Authenticated request</>}</span>}
        </span>
        {access.allowed && <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cyan" />}
      </Button>)}
    </div>
    {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">No services match “{q}”.</p>}
    <div className="flex items-center justify-between border-t border-border pt-3"><p className="text-xs text-muted-foreground">Page {currentPage} of {pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next<ArrowRight /></Button></div></div>
    </>}
    {tab === "receipts" && <section className="min-w-0 py-2">
      <h2 className="mb-1 font-bold">Recent payment attempts</h2><p className="mb-4 text-xs text-muted-foreground">Pending is not a confirmed payment. Keep the original reference for reconciliation.</p>
      {!profile ? <p className="text-sm text-muted-foreground">Payment history is unavailable.</p> : !profile.receipts.length ? <p className="py-10 text-center text-sm text-muted-foreground">No recorded payment attempts.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-muted-foreground"><tr><th className="p-2">When</th><th className="p-2">Service</th><th className="p-2">Amount</th><th className="p-2">Reference</th><th className="p-2">NIP session</th><th className="p-2">Status</th></tr></thead><tbody>{profile.receipts.map((r) => <tr key={r.id} className="border-t border-border"><td className="p-2">{new Date(r.created_at).toLocaleString()}</td><td className="p-2 font-mono">{r.operation.replace("/v1/", "")}</td><td className="p-2 font-mono">{r.currency} {Number(r.amount ?? 0).toLocaleString()}</td><td className="p-2 font-mono">{r.provider_reference ?? "—"}</td><td className="p-2 font-mono">{r.session_id ?? "—"}</td><td className={`p-2 font-bold ${r.status === "succeeded" ? "text-cyan" : r.status === "failed" ? "text-destructive" : "text-magenta"}`}>{r.status}{r.mode === "sandbox" && " · test"}</td></tr>)}</tbody></table></div>
    }</section>}
    </div>
    {open && <Runner endpoint={open} mode={mode} onClose={() => setOpen(null)} onDone={() => void refresh()} />}
  </div>;
}

export function GoLive({ role }: { role: Role }) {
  const { profile, error, refresh } = useBankingProfile();
  const check = useServerFn(submitIdentityCheck);
  const [f, setF] = useState({ bvn: "", firstName: "", lastName: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const stepId = role === "merchant" ? "director_bvn" : "personal_bvn";
  const bvnStep = profile?.kyc.find((k) => k.step === stepId);
  const steps = stepsFor(role).map((st) => ({ ...st, status: statusOf(st, profile?.kyc ?? [], profile?.review) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{11}$/.test(f.bvn)) return setMsg("BVN must be 11 digits.");
    setBusy(true); setMsg("");
    try { const r = await check({ data: f }); setMsg(r.verified ? "Verified — your next step is unlocked." : "We could not match those details."); await refresh(); }
    catch (err) { setMsg(err instanceof Error ? err.message : "Verification failed"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <ModeBanner profile={profile} error={error} />
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="h-5 w-5 text-cyan" />{role === "merchant" ? "KYB checklist to go live" : "KYC checklist to go live"}</h2>
        <ol className="mt-5 space-y-3">{steps.map((st, i) => { const done = st.status === "verified"; return <li key={st.key} className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${done ? "border-cyan bg-cyan/20 text-cyan" : st.status === "rejected" ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>{done ? <BadgeCheck className="h-4 w-4" /> : i + 1}</span><div><p className={`text-sm font-semibold ${done ? "text-foreground" : "text-body"}`}>{st.title}{st.tier && <span className="ml-2 rounded-full bg-cobalt/20 px-2 py-0.5 text-[10px] font-bold text-cyan">Tier {st.tier}</span>}<span className={`ml-2 text-[11px] font-bold ${STATUS_TONE[st.status]}`}>{STATUS_LABEL[st.status]}</span></p><p className="text-xs text-muted-foreground">{st.detail}</p></div></li>; })}</ol>
        <p className="mt-5 text-xs text-muted-foreground">You stay in sandbox until every step is complete and Slikpay approves your account. Live mode then processes real transactions.</p>
      </section>
      <section className="rounded-2xl border border-cobalt/40 bg-cobalt/5 p-6">
        <h2 className="text-lg font-black">{role === "merchant" ? "Director verification" : "Verify your identity"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">We check your BVN instantly. Your BVN is not stored.</p>
        {bvnStep?.status === "verified" ? <p className="mt-5 flex items-center gap-2 font-bold text-cyan"><CheckCircle2 className="h-5 w-5" />Verified · {bvnStep.summary}</p> :
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-body">First name<input className="field mt-1 w-full" value={f.firstName} onChange={(e) => setF((s) => ({ ...s, firstName: e.target.value }))} required /></label>
              <label className="block text-sm font-semibold text-body">Last name<input className="field mt-1 w-full" value={f.lastName} onChange={(e) => setF((s) => ({ ...s, lastName: e.target.value }))} required /></label>
            </div>
            <label className="block text-sm font-semibold text-body">BVN<input className="field mt-1 w-full font-mono tracking-widest" inputMode="numeric" maxLength={11} value={f.bvn} onChange={(e) => setF((s) => ({ ...s, bvn: e.target.value.replace(/\D/g, "") }))} required /></label>
            {msg && <p role="status" className="text-sm font-semibold text-magenta">{msg}</p>}
            <Button variant="brand" type="submit" disabled={busy} className="shine h-12 w-full bg-gradient-tri">{busy && <Loader2 className="animate-spin" />}Verify</Button>
            {profile?.mode === "sandbox" && <p className="text-[11px] text-muted-foreground">Sandbox tip: the test BVN is 22222222222.</p>}
          </form>}
      </section>
    </div>
  </div>;
}

const STATUS_LABEL: Record<StepStatus, string> = { not_started: "Not started", submitted: "In review", verified: "Verified", rejected: "Rejected — resubmit" };
const STATUS_TONE: Record<StepStatus, string> = { not_started: "text-muted-foreground", submitted: "text-magenta", verified: "text-cyan", rejected: "text-destructive" };

export function GoLiveProgress({ role, onOpen }: { role: Role; onOpen: () => void }) {
  const { profile } = useBankingProfile();
  if (!profile || profile.mode === "live") return null;
  const p = progress(role, profile.kyc, profile.review);
  const next = stepsFor(role).find((st) => statusOf(st, profile.kyc, profile.review) !== "verified");
  return <section className="relative overflow-hidden rounded-2xl border border-cyan/40 bg-gradient-to-r from-cobalt/25 via-card to-magenta/15 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-[11px] font-bold uppercase tracking-widest text-cyan">You're in sandbox</p><h2 className="mt-1 text-lg font-black">{p.done} of {p.total} steps complete to go live</h2>{next && <p className="mt-1 text-sm text-muted-foreground">Next: {next.title} — {next.detail}</p>}</div>
      <Button variant="brand" className="shine bg-gradient-tri" onClick={onOpen}>Continue verification <ChevronRight /></Button>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-gradient-tri transition-all" style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
  </section>;
}

