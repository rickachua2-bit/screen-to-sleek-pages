import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import * as Icons from "lucide-react";
import { ArrowRight, Check, ChevronLeft, Copy, Loader2, Lock, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { runPaddleOperation } from "@/lib/paddle.functions";
import type { Role } from "@/lib/paddle-policy";
import { SERVICES, SERVICE_CATEGORIES, STATUS_LABEL, reviewTotal, searchServices, serviceStatus, type FlowField, type OptionItem, type ServiceDef, type ServiceStatus } from "@/lib/services-registry";
import { useBankingProfile } from "./PaddleConsole";

const PERSONAL_MODULES: Record<string, string> = { banking: "send", cards: "cards", treasury: "savings" };
const naira = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Boxes;
  return <C className={className} />;
}

function usePrefs(role: Role) {
  const key = `slk-services-${role}`;
  const [prefs, setPrefs] = useState<{ fav: string[]; recent: { id: string; label: string; at: string }[] }>({ fav: [], recent: [] });
  useEffect(() => { try { const v = localStorage.getItem(key); if (v) setPrefs(JSON.parse(v)); } catch { /* ignore */ } }, [key]);
  const save = (p: typeof prefs) => { setPrefs(p); try { localStorage.setItem(key, JSON.stringify(p)); } catch { /* ignore */ } };
  return {
    prefs,
    toggleFav: (id: string) => save({ ...prefs, fav: prefs.fav.includes(id) ? prefs.fav.filter((f) => f !== id) : [...prefs.fav, id] }),
    addRecent: (id: string, label: string) => save({ ...prefs, recent: [{ id, label, at: new Date().toISOString() }, ...prefs.recent.filter((r) => r.label !== label)].slice(0, 6) }),
  };
}

const STATUS_STYLE: Record<ServiceStatus, string> = {
  available: "bg-chart-2/15 text-chart-2", sandbox: "bg-chart-4/20 text-chart-4", verify: "bg-magenta/15 text-magenta", business: "bg-muted text-muted-foreground",
};

export function ServicesHub({ role, only, title }: { role: Role; only?: string[]; title?: string }) {
  const { profile } = useBankingProfile();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ServiceDef | null>(null);
  const { prefs, toggleFav, addRecent } = usePrefs(role);
  const ctx = { role, mode: profile?.mode ?? "sandbox", review: profile?.review ?? "not_started" } as const;
  const items = useMemo(() => SERVICES.filter((s) => (role === "merchant" || !s.module || PERSONAL_MODULES[s.module]) && (!only || only.includes(s.id))), [role, only]);
  const results = searchServices(q, items);

  const launch = (s: ServiceDef) => {
    const st = serviceStatus(s, ctx);
    if (st === "business") { toast.message("Available on business accounts."); return; }
    if (s.flow) { setOpen(s); return; }
    const mod = role === "merchant" ? s.module : PERSONAL_MODULES[s.module ?? ""];
    if (!mod) return;
    if (s.note) toast.message(s.note);
    void navigate({ to: role === "merchant" ? "/dashboard" : "/personal", search: { module: mod } as never });
  };

  const tile = (s: ServiceDef) => {
    const st = serviceStatus(s, ctx); const fav = prefs.fav.includes(s.id);
    return <div key={s.id} className="group hover-lift relative rounded-2xl border border-border bg-card/70 p-4 backdrop-blur transition-colors hover:border-cyan/50">
      <button type="button" onClick={() => toggleFav(s.id)} aria-label={fav ? `Remove ${s.label} from favourites` : `Add ${s.label} to favourites`} className="absolute right-3 top-3 text-muted-foreground hover:text-chart-4"><Star className={`h-4 w-4 ${fav ? "fill-chart-4 text-chart-4" : ""}`} /></button>
      <button type="button" onClick={() => launch(s)} className="flex w-full flex-col items-start gap-3 text-left">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-tri text-primary-foreground shadow-md">{st === "business" ? <Lock className="h-4 w-4" /> : <Icon name={s.icon} className="h-5 w-5" />}</span>
        <span className="text-sm font-extrabold leading-tight">{s.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
      </button>
    </div>;
  };

  const favs = items.filter((s) => prefs.fav.includes(s.id));
  return <section className="space-y-6">
    <div className="hero-surface p-6 md:p-8">
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/70">All services</p>
        <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{title ?? "What would you like to do?"}</h2>
        <div className="relative mt-5 max-w-xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try "pay electricity", "DStv" or "send to Ghana"' className="h-12 rounded-full bg-background/60 pl-11" aria-label="Search services" /></div>
        {!q && prefs.recent.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{prefs.recent.map((r) => { const s = SERVICES.find((x) => x.id === r.id); return s ? <button key={r.at} onClick={() => launch(s)} className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-bold hover:border-cyan/60"><Icons.History className="mr-1 inline h-3 w-3" />{r.label}</button> : null; })}</div>}
      </div>
    </div>

    {q ? <div><h3 className="mb-3 text-sm font-extrabold">{results.length} result{results.length === 1 ? "" : "s"}</h3>{results.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{results.map(tile)}</div> : <p className="text-sm text-muted-foreground">No service matches “{q}”.</p>}</div> : <>
      {favs.length > 0 && <div><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Star className="h-4 w-4 fill-chart-4 text-chart-4" />Favourites</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{favs.map(tile)}</div></div>}
      {SERVICE_CATEGORIES.map((c) => { const list = items.filter((s) => s.category === c.id); return list.length ? <div key={c.id}><div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="text-sm font-extrabold">{c.label}</h3><span className="text-[11px] text-muted-foreground">{c.blurb}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{list.map(tile)}</div></div> : null; })}
    </>}
    {open?.flow && <GuidedService service={open} live={ctx.mode === "live"} onClose={() => setOpen(null)} onDone={(label) => addRecent(open.id, label)} />}
  </section>;
}

type Step = "details" | "review" | "done";

export function GuidedService({ service, live, onClose, onDone }: { service: ServiceDef; live: boolean; onClose: () => void; onDone: (label: string) => void }) {
  const flow = service.flow!;
  const run = useServerFn(runPaddleOperation);
  const [values, setValues] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, Record<string, unknown>>>({});
  const [step, setStep] = useState<Step>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<Record<string, unknown> | null>(null);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ref: string | null; data: Record<string, unknown> } | null>(null);

  const set = (f: FlowField, v: string, it?: Record<string, unknown>) => {
    setValues((p) => { const next = { ...p, [f.name]: v }; for (const g of flow.fields) if (g.options?.dependsOn === f.name) delete next[g.name]; const amt = it && f.setsAmount?.(it); if (amt) next["amount"] = String(amt); return next; });
    if (it) setPicked((p) => ({ ...p, [f.name]: it }));
  };
  const amountKey = flow.fields.find((f) => f.kind === "amount")?.name ?? "amount";
  const amount = Number(values[amountKey] ?? 0);
  const fee = flow.fee?.(picked) ?? null;
  const totals = reviewTotal(amount, fee);
  const missing = flow.fields.find((f) => !values[f.name]?.trim() || (f.pattern && !f.pattern.test(values[f.name] ?? "")) || (f.kind === "amount" && !(Number(values[f.name]) > 0)));

  const toReview = async () => {
    setError("");
    if (missing) { setError(missing.patternHint && values[missing.name] ? `${missing.label}: ${missing.patternHint}.` : `Enter ${missing.label.toLowerCase()}.`); return; }
    if (!flow.validate) { setStep("review"); return; }
    setBusy(true);
    try {
      const r = await run({ data: { id: flow.validate.op, params: {}, body: flow.validate.body(values, picked), idempotencyKey: crypto.randomUUID(), currency: "NGN" } });
      const d = (JSON.parse(r.resultJson) ?? {}) as Record<string, unknown>;
      if (d["valid"] === false) throw new Error("We couldn't confirm those details. Check and try again.");
      setCheck(d); setStep("review");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't check those details."); } finally { setBusy(false); }
  };

  const pay = async () => {
    setError("");
    if (live && !/^\d{4}$/.test(pin)) { setError("Enter your 4-digit transaction PIN."); return; }
    setBusy(true);
    try {
      const r = await run({ data: { id: flow.pay.op, params: {}, body: flow.pay.body(values, picked), idempotencyKey: crypto.randomUUID(), currency: "NGN", pin: pin || undefined } });
      const d = (JSON.parse(r.resultJson) ?? {}) as Record<string, unknown>;
      setResult({ ref: r.receipt?.reference ?? (typeof d["reference"] === "string" ? d["reference"] : null), data: d });
      setStep("done");
      const sel = Object.values(picked)[0]; onDone(`${service.label}${sel ? ` · ${String(sel["shortName"] ?? sel["name"] ?? "")}` : ""}`.slice(0, 40));
    } catch (e) { setError(e instanceof Error ? e.message : "Payment didn't go through. No money was taken."); } finally { setBusy(false); }
  };

  const summary = flow.fields.filter((f) => f.kind !== "amount").map((f) => [f.label, f.kind === "select" ? (f.choices?.find((c) => c.value === values[f.name])?.label ?? String(picked[f.name]?.["shortName"] ?? picked[f.name]?.["name"] ?? values[f.name])) : values[f.name]] as const);
  const checked = check ? (flow.validate?.show ?? []).map((k) => [k, check[k]] as const).filter(([, v]) => v !== undefined && v !== null && v !== "") : [];
  const extras = result ? (flow.receipt ?? []).map((k) => [k, result.data[k]] as const).filter(([, v]) => v !== undefined && v !== null && v !== "") : [];
  const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="theme-flame sm:max-w-md">
      <DialogHeader><DialogTitle className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-tri text-primary-foreground"><Icon name={service.icon} className="h-4 w-4" /></span>{service.label}{!live && <span className="rounded-full bg-chart-4/20 px-2 py-0.5 text-[10px] font-bold text-chart-4">Sandbox</span>}</DialogTitle></DialogHeader>
      <ol className="flex gap-1.5" aria-label="Progress">{(["details", "review", "done"] as Step[]).map((s, i) => <li key={s} className={`h-1 flex-1 rounded-full ${(["details", "review", "done"] as Step[]).indexOf(step) >= i ? "bg-gradient-tri" : "bg-muted"}`} />)}</ol>

      {step === "details" && <div className="space-y-4">
        {flow.fields.map((f) => <FieldInput key={f.name} field={f} values={values} value={values[f.name] ?? ""} onChange={(v, it) => set(f, v, it)} />)}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button variant="brand" className="w-full rounded-full" disabled={busy} onClick={toReview}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{flow.validate ? "Check details" : "Continue"}</Button>
      </div>}

      {step === "review" && <div className="space-y-4">
        {checked.length > 0 && <div className="rounded-2xl border border-chart-2/40 bg-chart-2/10 p-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-chart-2"><Check className="h-3.5 w-3.5" />Details confirmed</p><dl className="space-y-1 text-xs">{checked.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label(k)}</dt><dd className="text-right font-bold">{String(v)}</dd></div>)}</dl></div>}
        <dl className="space-y-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
          {summary.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-bold">{v}</dd></div>)}
          <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{naira(totals.amount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fee</dt><dd className="font-mono font-bold">{fee !== null ? naira(totals.fee) : "Shown on receipt"}</dd></div>
          <div className="flex justify-between gap-3 text-base"><dt className="font-extrabold">Total</dt><dd className="font-mono font-extrabold">{naira(totals.total)}</dd></div>
        </dl>
        {live && <Input inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit transaction PIN" aria-label="Transaction PIN" className="text-center font-mono tracking-[0.5em]" />}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <div className="flex gap-2"><Button variant="crisp" className="rounded-full" onClick={() => setStep("details")}><ChevronLeft />Edit</Button><Button variant="brand" className="flex-1 rounded-full" disabled={busy} onClick={pay}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}{flow.pay.verb} · {naira(totals.total)}</Button></div>
      </div>}

      {step === "done" && result && <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground"><Check className="h-7 w-7" /></span>
        <div><p className="text-lg font-extrabold">{flow.pay.verb} successful</p><p className="font-mono text-2xl font-bold">{naira(totals.total)}</p></div>
        {extras.map(([k, v]) => <div key={k} className="rounded-2xl border border-cyan/40 bg-cyan/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan">{label(k)}</p><p className="break-all font-mono text-lg font-bold">{String(v)}</p></div>)}
        {result.ref && <p className="text-xs text-muted-foreground">Reference <span className="font-mono">{result.ref}</span></p>}
        <div className="flex gap-2"><Button variant="crisp" className="flex-1 rounded-full" onClick={async () => { const text = [`${service.label} · ${naira(totals.total)}`, ...summary.map(([k, v]) => `${k}: ${v}`), ...extras.map(([k, v]) => `${label(k)}: ${String(v)}`), result.ref ? `Reference: ${result.ref}` : ""].filter(Boolean).join("\n"); try { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); } catch { toast.error("Copy unavailable"); } }}><Copy />Copy receipt</Button><Button variant="brand" className="flex-1 rounded-full" onClick={onClose}>Done</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}

function FieldInput({ field, value, values, onChange }: { field: FlowField; value: string; values: Record<string, string>; onChange: (v: string, item?: Record<string, unknown>) => void }) {
  const run = useServerFn(runPaddleOperation);
  const [opts, setOpts] = useState<OptionItem[] | null>(field.choices ? field.choices.map((c) => ({ ...c, item: {} })) : null);
  const [err, setErr] = useState("");
  const dep = field.options?.dependsOn ? values[field.options.dependsOn] ?? "" : "";
  useEffect(() => {
    const o = field.options; if (!o) return;
    const query = o.query ? o.query(values) : {};
    if (query === null) { setOpts(null); return; }
    let on = true; setOpts(null); setErr("");
    run({ data: { id: o.op, params: {}, body: query, idempotencyKey: crypto.randomUUID(), currency: "NGN" } })
      .then((r) => { if (!on) return; const d: unknown = JSON.parse(r.resultJson); const arr = (o.pick ?? ((x: unknown) => (Array.isArray(x) ? x : [])))(d); setOpts(arr.map((i) => o.map(i as Record<string, unknown>)).filter((x): x is OptionItem => Boolean(x))); })
      .catch(() => on && setErr("Couldn't load options. Close and try again."));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.name, dep]);
  const id = `svc-${field.name}`;
  return <div className="space-y-1.5">
    <label htmlFor={id} className="text-xs font-bold">{field.label}</label>
    {field.kind === "select" ? <select id={id} value={value} disabled={!opts} onChange={(e) => { const o = opts?.find((x) => x.value === e.target.value); onChange(e.target.value, o?.item); }} className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm font-semibold disabled:opacity-60">
      <option value="">{opts ? `Choose ${field.label.toLowerCase()}` : field.options?.dependsOn && !dep ? "Choose the option above first" : "Loading…"}</option>
      {opts?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select> : <Input id={id} value={value} inputMode={field.kind === "amount" || field.kind === "phone" ? "decimal" : undefined} type={field.kind === "email" ? "email" : field.kind === "date" ? "date" : "text"} placeholder={field.placeholder} onChange={(e) => onChange(field.kind === "amount" ? e.target.value.replace(/[^\d.]/g, "") : field.kind === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 11) : e.target.value)} className="h-11 rounded-xl bg-background/60" />}
    {err && <p className="text-[11px] text-destructive">{err}</p>}
  </div>;
}
