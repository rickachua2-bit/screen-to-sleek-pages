import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as Icons from "lucide-react";
import { ArrowRight, Check, ChevronLeft, Copy, History, Loader2, Lock, Share2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { paymentFeedback } from "@/lib/payment-feedback";
import { naira } from "@/lib/api";
import { SERVICES, reviewTotal, type FlowField, type ServiceDef } from "@/lib/services-registry";
import { useBankingProfile } from "./PaddleConsole";
import { FieldInput } from "./ServicesHub";

type Step = "details" | "review" | "done";
interface Recent { label: string; values: Record<string, string>; at: string }

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function loadRecents(id: string): Recent[] {
  try { return JSON.parse(localStorage.getItem(`slk-bills-recents-${id}`) ?? "[]") as Recent[]; } catch { return []; }
}

/** Premium full-page bills experience shared by data, power, TV, internet, betting and exam PINs. */
export function BillsService({ serviceId }: { serviceId: string }) {
  const service: ServiceDef | undefined = SERVICES.find((s) => s.id === serviceId);
  const flow = service?.flow;
  const { profile } = useBankingProfile();
  const run = useServerFn(runPaddleOperation);
  const live = profile?.mode === "live";
  const balance = profile?.balances["NGN"] ?? null;

  const [values, setValues] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, Record<string, unknown>>>({});
  const [step, setStep] = useState<Step>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<Record<string, unknown> | null>(null);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ref: string | null; data: Record<string, unknown> } | null>(null);
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => { setRecents(loadRecents(serviceId)); }, [serviceId]);

  const fields: FlowField[] = useMemo(() => flow?.fields ?? [], [flow]);
  const amountKey = fields.find((f) => f.kind === "amount")?.name ?? "amount";
  const amount = Number(values[amountKey] ?? 0);
  const fee = flow?.fee?.(picked) ?? null;
  const totals = reviewTotal(amount, fee);
  const planSetsAmount = fields.some((f) => f.setsAmount);
  const missing = fields.find((f) => !values[f.name]?.trim() || (f.pattern && !f.pattern.test(values[f.name] ?? "")) || (f.kind === "amount" && !(Number(values[f.name]) > 0)));
  const short = balance !== null && totals.total > balance;

  if (!service || !flow) return null;

  const set = (f: FlowField, v: string, it?: Record<string, unknown>) => {
    setValues((p) => { const next = { ...p, [f.name]: v }; for (const g of fields) if (g.options?.dependsOn === f.name) delete next[g.name]; const amt = it && f.setsAmount?.(it); if (amt) next[amountKey] = String(amt); return next; });
    if (it) setPicked((p) => ({ ...p, [f.name]: it }));
    setError("");
  };

  const recentLabel = (v: Record<string, string>) => {
    const main = fields.find((f) => f.kind !== "amount" && f.kind !== "select");
    const sel = fields.find((f) => f.kind === "select");
    const parts = [main ? v[main.name] : "", sel ? str(picked[sel.name]?.["shortName"] ?? picked[sel.name]?.["name"]) : ""].filter(Boolean);
    return parts.join(" · ").slice(0, 40) || service.label;
  };

  const remember = () => {
    const next = [{ label: recentLabel(values), values, at: new Date().toISOString() }, ...recents.filter((r) => r.label !== recentLabel(values))].slice(0, 5);
    setRecents(next);
    try { localStorage.setItem(`slk-bills-recents-${serviceId}`, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toReview = async () => {
    setError("");
    if (missing) { setError(missing.patternHint && values[missing.name] ? `${missing.label}: ${missing.patternHint}.` : `Enter ${missing.label.toLowerCase()}.`); return; }
    if (short) { setError(`This is more than your available balance of ${naira(balance ?? 0)}.`); return; }
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
      remember();
      setStep("done");
    } catch (e) { setError(paymentFeedback(e, "transfer")); } finally { setBusy(false); }
  };

  const summary = fields.filter((f) => f.kind !== "amount").map((f) => [f.label, f.kind === "select" ? (f.choices?.find((c) => c.value === values[f.name])?.label ?? str(picked[f.name]?.["shortName"] ?? picked[f.name]?.["name"] ?? values[f.name])) : values[f.name]] as const);
  const checked = check ? (flow.validate?.show ?? []).map((k) => [k, check[k]] as const).filter(([, v]) => v !== undefined && v !== null && v !== "") : [];
  const extras = result ? (flow.receipt ?? []).map((k) => [k, result.data[k]] as const).filter(([, v]) => v !== undefined && v !== null && v !== "") : [];

  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const share = async () => {
    const text = [`Slikpay ${service.label} · ${naira(totals.total)}`, ...summary.map(([k, v]) => `${k}: ${v}`), ...extras.map(([k, v]) => `${label(k)}: ${String(v)}`), result?.ref ? `Reference: ${result.ref}` : ""].filter(Boolean).join("\n");
    try {
      if (canShare) await navigator.share({ title: `Slikpay ${service.label} receipt`, text });
      else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); }
    } catch { /* dismissed */ }
  };

  const reset = () => { setStep("details"); setPin(""); setResult(null); setCheck(null); setError(""); };

  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[service.icon] ?? Icons.Boxes;

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
    <aside className="bg-navy-rail relative overflow-hidden rounded-3xl p-6 text-white md:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">Bills & top-up</p>
      <h2 className="mt-2 flex items-center gap-3 text-2xl font-extrabold md:text-3xl"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Icon className="h-5 w-5 text-cyan" /></span>{service.label}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">Verify the details, confirm the total, and it lands instantly — all from your wallet.</p>
      <ol className="mt-6 space-y-3">
        {["Enter the details", flow.validate ? "We verify them" : "Review the total", "Confirm and pay"].map((s, i) => {
          const active = step === "done" || (step === "review" && i <= 2) || (step === "details" && i === 0);
          return <li key={s} className="flex items-center gap-3 text-sm font-semibold">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${active ? "bg-gradient-tri text-white" : "border border-white/25 text-white/60"}`}>{i + 1}</span>
            <span className={active ? "text-white" : "text-white/60"}>{s}</span>
          </li>;
        })}
      </ol>
      <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/60"><Wallet className="h-3.5 w-3.5 text-cyan" />Wallet balance</p>
        <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">{balance === null ? "…" : naira(balance)}</p>
        {!live && <p className="mt-1 text-[11px] font-semibold text-amber-300">Sandbox mode — no real money moves</p>}
      </div>
    </aside>

    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
      {step === "details" && <div className="space-y-5">
        {recents.length > 0 && <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><History className="h-3.5 w-3.5" />Pay again</p>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => <Button key={r.at} variant="outline" size="sm" className="max-w-full rounded-full" onClick={() => { setValues(r.values); setError(""); }}><History className="h-3.5 w-3.5 shrink-0 text-cobalt" /><span className="truncate">{r.label}</span></Button>)}
          </div>
        </div>}

        {fields.map((f) => <FieldInput key={f.name} field={f} values={values} value={values[f.name] ?? ""} onChange={(v, it) => set(f, v, it)} />)}

        {!planSetsAmount && <div className="space-y-1.5">
          <p className="text-xs font-bold">Quick amounts</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK_AMOUNTS.map((q) => <Button key={q} type="button" variant={amount === q ? "brand" : "outline"} size="sm" className="rounded-full font-mono font-bold" onClick={() => setValues((p) => ({ ...p, [amountKey]: String(q) }))}>₦{q.toLocaleString()}</Button>)}
          </div>
        </div>}

        {short && <p className="text-[11px] font-semibold text-destructive">This is more than your available balance of {naira(balance ?? 0)}.</p>}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button variant="brand" className="h-12 w-full rounded-full text-sm" disabled={busy || !!missing || short} onClick={toReview}>
          {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{flow.validate ? "Verify details" : "Continue"}
        </Button>
      </div>}

      {step === "review" && <div className="space-y-5">
        {checked.length > 0 && <div className="rounded-2xl border border-chart-2/40 bg-chart-2/10 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-chart-2"><Check className="h-3.5 w-3.5" />Details confirmed</p>
          <dl className="space-y-1 text-xs">{checked.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label(k)}</dt><dd className="text-right font-bold">{String(v)}</dd></div>)}</dl>
        </div>}
        <dl className="space-y-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
          {summary.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-bold">{v}</dd></div>)}
          <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{naira(totals.amount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fee</dt><dd className="font-mono font-bold">{fee !== null ? naira(totals.fee) : "Shown on receipt"}</dd></div>
          <div className="flex justify-between gap-3 text-base"><dt className="font-extrabold">Total</dt><dd className="font-mono font-extrabold">{naira(totals.total)}</dd></div>
        </dl>
        {live && <Input inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit transaction PIN" aria-label="Transaction PIN" className="text-center font-mono tracking-[0.5em]" />}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="rounded-full" onClick={() => setStep("details")}><ChevronLeft />Edit</Button>
          <Button variant="brand" className="h-12 flex-1 rounded-full" disabled={busy} onClick={pay}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}{flow.pay.verb} · {naira(totals.total)}</Button>
        </div>
      </div>}

      {step === "done" && result && <div className="space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground"><Check className="h-7 w-7" /></span>
        <div>
          <p className="text-lg font-extrabold">{flow.pay.verb} successful</p>
          <p className="font-mono text-2xl font-bold">{naira(totals.total)}</p>
        </div>
        {extras.map(([k, v]) => <div key={k} className="rounded-2xl border border-cyan/40 bg-cyan/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan">{label(k)}</p><p className="break-all font-mono text-lg font-bold">{String(v)}</p></div>)}
        {result.ref && <p className="text-xs text-muted-foreground">Reference <span className="font-mono">{result.ref}</span></p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="flex-1 rounded-full" onClick={share}>{canShare ? <Share2 /> : <Copy />}{canShare ? "Share receipt" : "Copy receipt"}</Button>
          <Button variant="brand" className="flex-1 rounded-full" onClick={reset}>New payment</Button>
        </div>
      </div>}
    </div>
  </section>;
}
