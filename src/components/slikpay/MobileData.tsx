import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, ChevronLeft, Copy, History, Loader2, Lock, Phone, Share2, Signal, User, Wallet, Wifi, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { paymentFeedback } from "@/lib/payment-feedback";
import { naira } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useBankingProfile } from "./PaddleConsole";
import { detectedNetwork, normalizeNgPhone } from "./Airtime";

interface Operator { id: string; label: string }
export interface DataPlan { code: string; name: string; amount: number; validity: string; size: string }
interface Recent { phone: string; network: string; operatorId: string; planCode: string; planName: string; amount: number; at: string }
type Step = "details" | "review" | "done";

const RECENTS_KEY = "slk-data-recents";
const PHONE_OK = /^0\d{10}$/;

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const listOf = (d: unknown): Record<string, unknown>[] => {
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  const o = d as Record<string, unknown> | null;
  for (const k of ["plans", "operators", "data", "items"]) if (o && Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  return [];
};
const toOperators = (d: unknown): Operator[] =>
  listOf(d)
    .filter((i) => i["isData"] !== false)
    .map((i) => ({ id: str(i["id"]) || str(i["code"]), label: str(i["shortName"]) || str(i["name"]) }))
    .filter((o) => o.id && o.label);

const NETWORK_KEYS = ["network", "operator", "operatorName", "provider", "shortName", "biller", "billerName", "service", "serviceType", "telco", "brand"];
const networkOf = (i: Record<string, unknown>) => { for (const k of NETWORK_KEYS) { const v = str(i[k]); if (v) return v; } return ""; };
const matches = (tag: string, wanted: string[]) => { const t = tag.toLowerCase(); return wanted.some((w) => t.includes(w) || w.includes(t)); };

/** Pull data plans out of the provider payload, whatever shape it takes. When network matchers are given, plans tagged with a different network are dropped; untagged plans are kept only when the whole payload is untagged. */
export function toDataPlans(d: unknown, ...matchers: string[]): DataPlan[] {
  const wanted = matchers.map((m) => m.toLowerCase()).filter(Boolean);
  let rows = listOf(d);
  if (wanted.length) {
    // Nested per-network groups: { airtel: [...], mtn: [...] }
    if (!Array.isArray(d) && d && typeof d === "object") {
      for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
        if (Array.isArray(v) && matches(k, wanted)) { rows = v as Record<string, unknown>[]; break; }
      }
    }
    // Operators each carrying their own plans: [{ name: "Airtel", plans: [...] }, ...]
    const grouped = rows.filter((i) => Array.isArray(i["plans"]));
    if (grouped.length) {
      const match = grouped.find((i) => matches(networkOf(i) || str(i["name"]) || str(i["title"]), wanted));
      rows = match ? (match["plans"] as Record<string, unknown>[]) : [];
    }
  }
  const tagged = rows.map((i) => ({ i, tag: networkOf(i) }));
  const anyTagged = tagged.some((t) => t.tag);
  return tagged
    .filter(({ tag }) => !wanted.length || !anyTagged || (tag !== "" && matches(tag, wanted)))
    .map(({ i }) => {
      const amount = Number(i["amount"] ?? i["price"] ?? 0);
      const code = str(i["itemCode"]) || str(i["planCode"]) || str(i["code"]) || str(i["id"]);
      const name = str(i["name"]) || str(i["title"]) || str(i["plan"]);
      if (!code || !name || !(amount > 0)) return null;
      return { code, name, amount, validity: str(i["validity"]) || str(i["duration"]), size: str(i["size"]) || str(i["dataValue"]) || str(i["data"]) };
    })
    .filter((p): p is DataPlan => p !== null)
    .sort((a, b) => a.amount - b.amount);
}

function loadRecents(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as Recent[]; } catch { return []; }
}

export function MobileData() {
  const { profile } = useBankingProfile();
  const run = useServerFn(runPaddleOperation);
  const live = profile?.mode === "live";
  const balance = profile?.balances["NGN"] ?? null;

  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [phone, setPhone] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState("");
  const [plans, setPlans] = useState<DataPlan[] | null>(null);
  const [plansFailed, setPlansFailed] = useState(false);
  const [planCode, setPlanCode] = useState("");
  const [amount, setAmount] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [recents, setRecents] = useState<Recent[]>([]);
  const [step, setStep] = useState<Step>("details");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ ref: string | null } | null>(null);
  const detectSeq = useRef(0);
  const plansSeq = useRef(0);

  useEffect(() => { setRecents(loadRecents()); }, []);
  useEffect(() => {
    let on = true;
    run({ data: { id: "get-bills-airtime-operators", params: {}, body: {}, idempotencyKey: crypto.randomUUID(), currency: "NGN" } })
      .then((r) => { if (on) setOperators(toOperators(JSON.parse(r.resultJson))); })
      .catch(() => on && setOperators([]));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let on = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!on) return;
      const p = normalizeNgPhone(str(data.user?.user_metadata?.["phone"]));
      if (PHONE_OK.test(p)) setMyPhone(p);
    }).catch(() => undefined);
    return () => { on = false; };
  }, []);

  // Auto-detect the network once the number looks complete.
  useEffect(() => {
    if (!PHONE_OK.test(phone)) { setDetected(""); return; }
    const seq = ++detectSeq.current;
    const t = setTimeout(() => {
      setDetecting(true);
      run({ data: { id: "post-bills-airtime-detect", params: {}, body: { phone }, idempotencyKey: crypto.randomUUID(), currency: "NGN" } })
        .then((r) => {
          if (detectSeq.current !== seq) return;
          const name = detectedNetwork(JSON.parse(r.resultJson));
          setDetected(name);
          if (name && operators?.length) {
            const match = operators.find((o) => o.label.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(o.label.toLowerCase()));
            if (match) setOperatorId(match.id);
          }
        })
        .catch(() => undefined)
        .finally(() => { if (detectSeq.current === seq) setDetecting(false); });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, operators]);

  // Load every plan for the selected network from the provider.
  useEffect(() => {
    if (!operatorId) { setPlans(null); setPlansFailed(false); return; }
    const seq = ++plansSeq.current;
    const label = operators?.find((o) => o.id === operatorId)?.label ?? "";
    setPlans(null); setPlansFailed(false); setPlanCode(""); setAmount("");
    run({ data: { id: "get-bills-data-plans", params: {}, body: { operator: operatorId, network: label || operatorId }, idempotencyKey: crypto.randomUUID(), currency: "NGN" } })
      .then((r) => {
        if (plansSeq.current !== seq) return;
        const list = toDataPlans(JSON.parse(r.resultJson), label || undefined);
        setPlans(list);
        setPlansFailed(list.length === 0);
      })
      .catch(() => { if (plansSeq.current === seq) { setPlans([]); setPlansFailed(true); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, operators]);

  const operator = useMemo(() => operators?.find((o) => o.id === operatorId) ?? null, [operators, operatorId]);
  const plan = useMemo(() => plans?.find((p) => p.code === planCode) ?? null, [plans, planCode]);
  const value = plan ? plan.amount : Number(amount);
  const valid = PHONE_OK.test(phone) && !!operator && (plan !== null || value > 0);
  const short = balance !== null && value > balance;

  const pickPlan = (p: DataPlan) => { setPlanCode(p.code); setAmount(String(p.amount)); setError(""); };

  const applyRecent = (r: Recent) => {
    setPhone(r.phone);
    setOperatorId(r.operatorId);
    setPlanCode(r.planCode);
    setAmount(String(r.amount));
    setError("");
  };

  const remember = (ref: string | null) => {
    if (!operator) return;
    const entry: Recent = { phone, network: operator.label, operatorId: operator.id, planCode, planName: plan?.name ?? "", amount: value, at: new Date().toISOString() };
    const next = [entry, ...recents.filter((r) => !(r.phone === phone && r.planCode === planCode))].slice(0, 5);
    setRecents(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setReceipt({ ref });
  };

  const pay = async () => {
    setError("");
    if (live && !/^\d{4}$/.test(pin)) { setError("Enter your 4-digit transaction PIN."); return; }
    setBusy(true);
    try {
      const key = crypto.randomUUID();
      const r = await run({ data: { id: "post-bills-data-purchase", params: {}, body: { phone, amount: value, operatorId: Number(operatorId) || operatorId, planCode: plan?.code, itemCode: plan?.code, reference: `DAT-${key.slice(0, 8).toUpperCase()}` }, idempotencyKey: key, currency: "NGN", pin: pin || undefined } });
      const d = (JSON.parse(r.resultJson) ?? {}) as Record<string, unknown>;
      remember(r.receipt?.reference ?? (typeof d["reference"] === "string" ? d["reference"] : null));
      setStep("done");
    } catch (e) { setError(paymentFeedback(e, "transfer")); } finally { setBusy(false); }
  };

  const share = async () => {
    const text = [`Slikpay Mobile data · ${naira(value)}`, `Phone: ${phone}`, `Network: ${operator?.label ?? ""}`, plan ? `Plan: ${plan.name}` : "", receipt?.ref ? `Reference: ${receipt.ref}` : ""].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Slikpay data receipt", text });
      else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); }
    } catch { /* dismissed */ }
  };

  const reset = () => { setStep("details"); setPin(""); setReceipt(null); setPlanCode(""); setAmount(""); setError(""); };

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
    {/* Navy rail */}
    <aside className="bg-navy-rail relative overflow-hidden rounded-3xl p-6 text-white md:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">Bills & top-up</p>
      <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">Data that finds its network</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">Type the number — we detect the network and load every live plan for it. Pick one, confirm, done.</p>
      <ol className="mt-6 space-y-3">
        {["Enter the phone number", "Pick a live data plan", "Confirm and pay"].map((s, i) => {
          const active = (step === "details" && i === 0) || (step === "review" && i <= 2) || step === "done";
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

    {/* White workspace */}
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
      {step === "details" && <div className="space-y-5">
        {recents.length > 0 && <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><History className="h-3.5 w-3.5" />Buy again</p>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => <Button key={`${r.phone}-${r.planCode}-${r.at}`} variant="outline" size="sm" className="rounded-full" onClick={() => applyRecent(r)}><Phone className="h-3.5 w-3.5 text-cobalt" />{r.phone}<span className="text-muted-foreground">· {r.planName || r.network}</span></Button>)}
          </div>
        </div>}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="data-phone" className="text-xs font-bold">Phone number</label>
            {myPhone && phone !== myPhone && <Button variant="link" size="sm" className="h-auto p-0 text-xs font-bold text-cobalt" onClick={() => setPhone(myPhone)}><User className="h-3 w-3" />My number</Button>}
          </div>
          <Input id="data-phone" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setError(""); }} placeholder="080 0000 0000" className="h-12 rounded-xl font-mono text-base tracking-wide" aria-label="Phone number" />
          {phone && !PHONE_OK.test(phone) && <p className="text-[11px] font-semibold text-destructive">Enter the full 11-digit number starting with 0.</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="data-net" className="text-xs font-bold">Network {detecting && <Loader2 className="inline h-3 w-3 animate-spin text-cobalt" aria-label="Detecting network" />}</label>
          <select id="data-net" value={operatorId} disabled={!operators?.length} onChange={(e) => setOperatorId(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-background/60 px-3 text-sm font-semibold disabled:opacity-60" aria-label="Network">
            <option value="">{operators === null ? "Loading networks…" : detecting ? "Detecting…" : "Choose network"}</option>
            {operators?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {detected && <p className="flex items-center gap-1 text-[11px] font-semibold text-chart-2"><Zap className="h-3 w-3" />Detected: {detected}</p>}
        </div>

        {operatorId && <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-bold"><Signal className="h-3.5 w-3.5 text-cobalt" />{operator ? `${operator.label} plans` : "Available plans"} {plans && plans.length > 0 && <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-extrabold text-cyan">{plans.length} live</span>}</p>
          {plans === null && <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/40 p-4 text-xs font-semibold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-cobalt" />Loading live plans…</div>}
          {plans !== null && plans.length > 0 && <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {plans.map((p) => <button key={p.code} type="button" onClick={() => pickPlan(p)} className={`rounded-2xl border p-3 text-left transition ${planCode === p.code ? "border-cobalt bg-cobalt/5 ring-2 ring-cobalt/30" : "border-border bg-background/40 hover:border-cobalt/50"}`} aria-pressed={planCode === p.code}>
              <p className="flex items-center justify-between gap-2 text-sm font-extrabold"><span className="truncate">{p.name}</span>{planCode === p.code && <Check className="h-4 w-4 shrink-0 text-cobalt" />}</p>
              <p className="mt-0.5 font-mono text-base font-bold text-cobalt">{naira(p.amount)}</p>
              {(p.size || p.validity) && <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{[p.size, p.validity].filter(Boolean).join(" · ")}</p>}
            </button>)}
          </div>}
          {plansFailed && <div className="space-y-2">
            <p className="rounded-2xl border border-amber-300/50 bg-amber-50 p-3 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Live plans aren't available for this network right now — enter an amount instead.</p>
            <Input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} placeholder="Amount (₦)" className="h-12 rounded-xl font-mono" aria-label="Amount in naira" />
          </div>}
        </div>}

        {short && <p className="text-[11px] font-semibold text-destructive">This is more than your available balance of {naira(balance ?? 0)}.</p>}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button variant="brand" className="h-12 w-full rounded-full text-sm" disabled={!valid || short} onClick={() => { setError(""); setStep("review"); }}>
          Continue<ArrowRight />
        </Button>
      </div>}

      {step === "review" && <div className="space-y-5">
        <dl className="space-y-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd className="font-mono font-bold">{phone}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Network</dt><dd className="font-bold">{operator?.label}</dd></div>
          {plan && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Plan</dt><dd className="text-right font-bold">{plan.name}{plan.validity ? ` · ${plan.validity}` : ""}</dd></div>}
          <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{naira(value)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fee</dt><dd className="font-mono font-bold">Shown on receipt</dd></div>
          <div className="flex justify-between gap-3 text-base"><dt className="font-extrabold">Total</dt><dd className="font-mono font-extrabold">{naira(value)}</dd></div>
        </dl>
        {live && <Input inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit transaction PIN" aria-label="Transaction PIN" className="text-center font-mono tracking-[0.5em]" />}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="rounded-full" onClick={() => setStep("details")}><ChevronLeft />Edit</Button>
          <Button variant="brand" className="h-12 flex-1 rounded-full" disabled={busy} onClick={pay}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Buy data · {naira(value)}</Button>
        </div>
      </div>}

      {step === "done" && <div className="space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground"><Check className="h-7 w-7" /></span>
        <div>
          <p className="text-lg font-extrabold">Data sent</p>
          <p className="font-mono text-2xl font-bold">{naira(value)}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><Wifi className="h-4 w-4" />{plan?.name ? `${plan.name} → ` : ""}{phone} · {operator?.label}</p>
        </div>
        {receipt?.ref && <p className="text-xs text-muted-foreground">Reference <span className="font-mono">{receipt.ref}</span></p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="flex-1 rounded-full" onClick={share}>{"share" in navigator ? <Share2 /> : <Copy />}{"share" in navigator ? "Share receipt" : "Copy receipt"}</Button>
          <Button variant="brand" className="flex-1 rounded-full" onClick={reset}>New purchase</Button>
        </div>
      </div>}
    </div>
  </section>;
}
