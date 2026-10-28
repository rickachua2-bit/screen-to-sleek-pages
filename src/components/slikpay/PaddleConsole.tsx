import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CheckCircle2, ChevronRight, FlaskConical, Loader2, Lock, Radio, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrandSelect } from "./BrandSelect";
import { CATEGORIES, ENDPOINTS, accessFor, categoryOf, movesMoney, type PaddleEndpoint, type Role } from "@/lib/paddle-policy";
import { getBankingProfile, runPaddleOperation, submitIdentityCheck } from "@/lib/paddle.functions";

type Profile = Awaited<ReturnType<typeof getBankingProfile>>;

function label(e: PaddleEndpoint) {
  const s = e.summary.replace(/^(GET|POST|DELETE)\s+\/v1\//, "");
  if (s !== e.summary) return s.split("/").map((p) => p.replace(/[{}]/g, "").replace(/-/g, " ")).join(" › ").replace(/^\w/, (c) => c.toUpperCase());
  return s;
}

export function useBankingProfile() {
  const load = useServerFn(getBankingProfile);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const refresh = () => load().then((p) => { setProfile(p); setError(""); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Banking profile unavailable"));
  useEffect(() => { void refresh(); }, []);
  return { profile, error, refresh };
}

export function ModeBanner({ profile, error }: { profile: Profile | null; error: string }) {
  if (error) return <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">{error}</div>;
  if (!profile) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your banking environment…</div>;
  const live = profile.mode === "live";
  const bal = Object.entries(profile.balances);
  return <div className={`relative overflow-hidden rounded-2xl border p-5 ${live ? "border-cyan/40 bg-cyan/5" : "border-magenta/40 bg-magenta/5"}`}>
    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cobalt/25 blur-3xl" />
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
    {!live && !profile.sandboxReady && <p className="relative mt-3 text-xs font-semibold text-magenta">Sandbox services start once the Paddle sandbox key is added.</p>}
  </div>;
}

function ResultView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  if (typeof value !== "object") return <span className="break-all font-mono text-xs">{String(value)}</span>;
  if (Array.isArray(value)) {
    const rows = value.slice(0, 50);
    if (rows.length && rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r as object)))].slice(0, 7);
      return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-xs"><thead className="bg-cobalt/10 text-muted-foreground"><tr>{cols.map((c) => <th key={c} className="p-2 font-bold">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c} className="p-2 align-top">{depth < 2 ? <ResultView value={(r as Record<string, unknown>)[c]} depth={depth + 1} /> : "…"}</td>)}</tr>)}</tbody></table>{value.length > 50 && <p className="p-2 text-xs text-muted-foreground">Showing 50 of {value.length}</p>}</div>;
    }
    return <span className="font-mono text-xs">{rows.map((r) => (typeof r === "object" ? JSON.stringify(r) : String(r))).join(", ")}</span>;
  }
  return <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(120px,auto)_1fr]">{Object.entries(value as Record<string, unknown>).map(([k, v]) => <div key={k} className="contents"><dt className="text-xs font-bold text-muted-foreground">{k}</dt><dd>{depth < 3 ? <ResultView value={v} depth={depth + 1} /> : "…"}</dd></div>)}</dl>;
}

function Runner({ endpoint, mode, onClose, onDone }: { endpoint: PaddleEndpoint; mode: "sandbox" | "live"; onClose: () => void; onDone: () => void }) {
  const run = useServerFn(runPaddleOperation);
  const [params, setParams] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(endpoint.fields.filter((f) => f.enum?.length).map((f) => [f.name, f.enum![0]!])));
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
    if (busy) return;
    setError(""); setOut(null);
    let body: Record<string, unknown> = {};
    try { body = extra.trim() ? JSON.parse(extra) as Record<string, unknown> : {}; if (typeof body !== "object" || Array.isArray(body)) throw new Error(); }
    catch { return setError("Additional details must be a JSON object, e.g. {\"key\": \"value\"}."); }
    for (const f of endpoint.fields) {
      const v = values[f.name]?.trim();
      if (!v) { if (f.required) return setError(`Enter ${f.name}.`); continue; }
      body[f.name] = f.type === "number" || f.type === "integer" ? Number(v) : f.type === "boolean" ? v === "true" : f.type === "array" || f.type === "object" ? (() => { try { return JSON.parse(v) as unknown; } catch { return v; } })() : v;
    }
    for (const q of queryParams) if (params[q.name]) body[q.name] = params[q.name];
    setBusy(true);
    try {
      const r = await run({ data: { id: endpoint.id, params: Object.fromEntries(pathParams.map((p) => [p.name, params[p.name] ?? ""])), body, idempotencyKey: crypto.randomUUID(), pin: pin || undefined, currency } });
      setOut(r); toast.success(r.receipt ? "Transaction confirmed by Paddle" : "Paddle responded"); onDone();
    } catch (err) { setError(err instanceof Error ? err.message.replace(/\s*\[retry-after:\d+\]/, "") : "Request failed"); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center slik-overlay-backdrop p-0 sm:items-center sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={label(endpoint)} className="slik-popup max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan">{endpoint.method} · {endpoint.tag}</p>
          <h2 className="mt-1 text-xl font-black">{label(endpoint)}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{endpoint.path}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {[...pathParams, ...queryParams].map((p) => <label key={p.name} className="block text-sm font-semibold text-body">{p.name}{p.required && " *"}<input className="field mt-1 w-full" value={params[p.name] ?? ""} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))} required={p.required} /></label>)}
        {endpoint.fields.map((f) => <div key={f.name}>
          {f.enum?.length ? <><p className="mb-1 text-sm font-semibold text-body">{f.name}{f.required && " *"}</p><BrandSelect label={f.name} value={values[f.name] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} options={f.enum.map((o) => ({ value: o, label: o }))} /></>
            : <label className="block text-sm font-semibold text-body">{f.name}{f.required && " *"}<input className="field mt-1 w-full" inputMode={f.type === "number" ? "decimal" : undefined} placeholder={f.example != null ? String(typeof f.example === "object" ? JSON.stringify(f.example) : f.example) : f.type} value={values[f.name] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} /></label>}
          {f.hint && <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>}
        </div>)}
        {endpoint.method !== "GET" && <label className="block text-sm font-semibold text-body">{endpoint.fields.length ? "Additional details (optional JSON)" : "Request details (JSON)"}<textarea className="field mt-1 min-h-24 w-full font-mono text-xs" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder='{"amount": 5000}' /></label>}
        {money && <div className="grid gap-3 rounded-xl border border-magenta/30 bg-magenta/5 p-3 sm:grid-cols-2">
          <div><p className="mb-1 text-sm font-semibold text-body">Currency</p><BrandSelect label="Currency" value={currency} onChange={setCurrency} options={["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR", "USDT"].map((c) => ({ value: c, label: c }))} /></div>
          {mode === "live" ? <label className="block text-sm font-semibold text-body">Transaction PIN<input className="field mt-1 w-full font-mono tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
            : <p className="self-end text-xs font-semibold text-magenta">Sandbox — no real money moves.</p>}
        </div>}
        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        <Button variant="brand" type="submit" disabled={busy} className="shine h-12 w-full bg-gradient-tri text-base">{busy && <Loader2 className="animate-spin" />}{money ? "Confirm transaction" : endpoint.method === "GET" ? "Fetch" : "Submit"}</Button>
      </form>
      {out && <div className="mt-5 space-y-3">
        {out.receipt && <div className="rounded-2xl border border-cyan/40 bg-cyan/5 p-4">
          <p className="flex items-center gap-2 font-bold text-cyan"><CheckCircle2 className="h-5 w-5" />Receipt · {out.receipt.mode}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{out.receipt.currency} {out.receipt.amount?.toLocaleString()}</dd><dt className="text-muted-foreground">Paddle reference</dt><dd className="break-all font-mono">{out.receipt.reference ?? "Not returned"}</dd><dt className="text-muted-foreground">NIP session ID</dt><dd className="break-all font-mono">{out.receipt.sessionId ?? "Not returned"}</dd></dl>
        </div>}
        {out.message && <p className="text-sm font-semibold text-body">{out.message}</p>}
        <div className="rounded-2xl border border-border bg-background/50 p-4"><ResultView value={out.result} /></div>
      </div>}
    </div>
  </div>;
}

export function PaddleConsole({ role }: { role: Role }) {
  const { profile, error, refresh } = useBankingProfile();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PaddleEndpoint | null>(null);
  const mode = profile?.mode ?? "sandbox";
  const list = useMemo(() => ENDPOINTS.map((e) => ({ e, access: accessFor(e, role, mode), cat: categoryOf(e.path) })).filter((x) => x.access.allowed || role === "merchant"), [role, mode]);
  const cats = CATEGORIES.filter((c) => list.some((x) => x.cat === c.id));
  const shown = list.filter((x) => (cat === "all" || x.cat === cat) && `${label(x.e)} ${x.e.path} ${x.e.tag}`.toLowerCase().includes(q.toLowerCase()));
  const available = list.filter((x) => x.access.allowed).length;

  return <div className="space-y-5">
    <ModeBanner profile={profile} error={error} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{available}</span> services available to you via Paddle</p>
      <label className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search services" className="field h-11 w-full pl-9" placeholder="Search cards, flights, payouts…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {[{ id: "all", label: "All" }, ...cats].map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${cat === c.id ? "border-cyan bg-cyan/15 text-cyan shadow-[0_0_20px_-6px_var(--cyan)]" : "border-border text-muted-foreground hover:border-magenta/50 hover:text-foreground"}`}>{c.label}</button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map(({ e, access }) => <button key={e.id} type="button" disabled={!access.allowed} onClick={() => setOpen(e)} className="panel group flex items-start gap-3 rounded-2xl border border-border bg-card/70 p-4 text-left disabled:cursor-not-allowed disabled:opacity-55">
        <span className={`mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${e.method === "GET" ? "bg-cyan/15 text-cyan" : e.method === "DELETE" ? "bg-destructive/15 text-destructive" : "bg-magenta/15 text-magenta"}`}>{e.method}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{label(e)}</span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{e.path}</span>
          {!access.allowed ? <span className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />{access.reason}</span> : movesMoney(e) && <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-magenta"><Sparkles className="h-3 w-3" />Moves money · receipt issued</span>}
        </span>
        {access.allowed && <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cyan" />}
      </button>)}
    </div>
    {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">No services match “{q}”.</p>}
    {profile && profile.receipts.length > 0 && <section className="rounded-2xl border border-border bg-card/60 p-5">
      <h2 className="mb-3 font-bold">Recent receipts</h2>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-muted-foreground"><tr><th className="p-2">When</th><th className="p-2">Service</th><th className="p-2">Amount</th><th className="p-2">Paddle reference</th><th className="p-2">NIP session</th><th className="p-2">Status</th></tr></thead><tbody>{profile.receipts.map((r) => <tr key={r.id} className="border-t border-border"><td className="p-2">{new Date(r.created_at).toLocaleString()}</td><td className="p-2 font-mono">{r.operation.replace("/v1/", "")}</td><td className="p-2 font-mono">{r.currency} {Number(r.amount ?? 0).toLocaleString()}</td><td className="p-2 font-mono">{r.provider_reference ?? "—"}</td><td className="p-2 font-mono">{r.session_id ?? "—"}</td><td className={`p-2 font-bold ${r.status === "succeeded" ? "text-cyan" : r.status === "failed" ? "text-destructive" : "text-magenta"}`}>{r.status}{r.mode === "sandbox" && " · test"}</td></tr>)}</tbody></table></div>
    </section>}
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
  const steps = role === "merchant"
    ? [{ t: "Phone & email verified", done: true }, { t: "CAC business lookup", done: true }, { t: "Director verification (BVN)", done: bvnStep?.status === "verified" }, { t: "Further KYB steps", done: false, note: "Details coming soon" }, { t: "Slikpay compliance review", done: profile?.review === "approved" }]
    : [{ t: "Identity verification (BVN)", done: bvnStep?.status === "verified" }, { t: "Slikpay review", done: profile?.review === "approved" }];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{11}$/.test(f.bvn)) return setMsg("BVN must be 11 digits.");
    setBusy(true); setMsg("");
    try { const r = await check({ data: f }); setMsg(r.verified ? "Verified — your next step is unlocked." : "Paddle could not match those details."); await refresh(); }
    catch (err) { setMsg(err instanceof Error ? err.message : "Verification failed"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <ModeBanner profile={profile} error={error} />
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="h-5 w-5 text-cyan" />{role === "merchant" ? "KYB checklist to go live" : "KYC checklist to go live"}</h2>
        <ol className="mt-5 space-y-3">{steps.map((s, i) => <li key={s.t} className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${s.done ? "border-cyan bg-cyan/20 text-cyan" : "border-border text-muted-foreground"}`}>{s.done ? <BadgeCheck className="h-4 w-4" /> : i + 1}</span><span className={`text-sm font-semibold ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.t}{"note" in s && s.note && <span className="ml-2 text-[11px] text-magenta">{s.note}</span>}</span></li>)}</ol>
        <p className="mt-5 text-xs text-muted-foreground">You stay in sandbox until every step is complete and Slikpay approves your account. Live mode then processes real transactions.</p>
      </section>
      <section className="rounded-2xl border border-cobalt/40 bg-cobalt/5 p-6">
        <h2 className="text-lg font-black">{role === "merchant" ? "Director verification" : "Verify your identity"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">We check your BVN with Paddle. Your BVN is not stored.</p>
        {bvnStep?.status === "verified" ? <p className="mt-5 flex items-center gap-2 font-bold text-cyan"><CheckCircle2 className="h-5 w-5" />Verified · {bvnStep.summary}</p> :
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-body">First name<input className="field mt-1 w-full" value={f.firstName} onChange={(e) => setF((s) => ({ ...s, firstName: e.target.value }))} required /></label>
              <label className="block text-sm font-semibold text-body">Last name<input className="field mt-1 w-full" value={f.lastName} onChange={(e) => setF((s) => ({ ...s, lastName: e.target.value }))} required /></label>
            </div>
            <label className="block text-sm font-semibold text-body">BVN<input className="field mt-1 w-full font-mono tracking-widest" inputMode="numeric" maxLength={11} value={f.bvn} onChange={(e) => setF((s) => ({ ...s, bvn: e.target.value.replace(/\D/g, "") }))} required /></label>
            {msg && <p role="status" className="text-sm font-semibold text-magenta">{msg}</p>}
            <Button variant="brand" type="submit" disabled={busy} className="shine h-12 w-full bg-gradient-tri">{busy && <Loader2 className="animate-spin" />}Verify with Paddle</Button>
            {profile?.mode === "sandbox" && <p className="text-[11px] text-muted-foreground">Sandbox tip: Paddle's test BVN is 22222222222.</p>}
          </form>}
      </section>
    </div>
  </div>;
}
