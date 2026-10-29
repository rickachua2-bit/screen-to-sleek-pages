import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, ChevronLeft, Copy, History, Loader2, Lock, Phone, Share2, Smartphone, User, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { paymentFeedback } from "@/lib/payment-feedback";
import { naira } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useBankingProfile } from "./PaddleConsole";

interface Operator { id: string; label: string }
interface Recent { phone: string; network: string; operatorId: string; at: string }
type Step = "details" | "review" | "done";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const RECENTS_KEY = "slk-airtime-recents";
const PHONE_OK = /^0\d{10}$/;

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const listOf = (d: unknown): Record<string, unknown>[] => {
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  const o = d as Record<string, unknown> | null;
  for (const k of ["operators", "data", "items"]) if (o && Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  return [];
};
const toOperators = (d: unknown): Operator[] =>
  listOf(d)
    .filter((i) => i["isAirtime"] !== false)
    .map((i) => ({ id: str(i["id"]) || str(i["code"]), label: str(i["shortName"]) || str(i["name"]) }))
    .filter((o) => o.id && o.label);

/** Normalise +234…/234… to the 11-digit 0… form the bills API expects. */
export function normalizeNgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^234\d{10}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits.slice(0, 11);
}

/** Pull a network name out of the detect payload, whatever shape it takes. */
export function detectedNetwork(d: unknown): string {
  const o = (Array.isArray(d) ? d[0] : d) as Record<string, unknown> | null;
  if (!o) return "";
  for (const k of ["network", "operator", "operatorName", "name", "shortName", "provider"]) {
    const v = str(o[k]);
    if (v) return v;
  }
  return "";
}

function loadRecents(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as Recent[]; } catch { return []; }
}

export function Airtime() {
  const { profile } = useBankingProfile();
  const run = useServerFn(runPaddleOperation);
  const live = profile?.mode === "live";
  const balance = profile?.balances["NGN"] ?? null;

  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [phone, setPhone] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState("");
  const [amount, setAmount] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [recents, setRecents] = useState<Recent[]>([]);
  const [step, setStep] = useState<Step>("details");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ ref: string | null } | null>(null);
  const detectSeq = useRef(0);

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

  const operator = useMemo(() => operators?.find((o) => o.id === operatorId) ?? null, [operators, operatorId]);
  const value = Number(amount);
  const valid = PHONE_OK.test(phone) && operator && value > 0;
  const short = balance !== null && value > balance;

  const applyRecent = (r: Recent) => {
    setPhone(r.phone);
    setOperatorId(r.operatorId);
    setError("");
  };

  const remember = (ref: string | null) => {
    if (!operator) return;
    const next = [{ phone, network: operator.label, operatorId: operator.id, at: new Date().toISOString() }, ...recents.filter((r) => r.phone !== phone)].slice(0, 5);
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
      const r = await run({ data: { id: "post-bills-airtime-topup", params: {}, body: { operatorId: Number(operatorId) || operatorId, amount: value, phone, reference: `AIR-${key.slice(0, 8).toUpperCase()}` }, idempotencyKey: key, currency: "NGN", pin: pin || undefined } });
      const d = (JSON.parse(r.resultJson) ?? {}) as Record<string, unknown>;
      remember(r.receipt?.reference ?? (typeof d["reference"] === "string" ? d["reference"] : null));
      setStep("done");
    } catch (e) { setError(paymentFeedback(e, "transfer")); } finally { setBusy(false); }
  };

  const share = async () => {
    const text = [`Slikpay Airtime · ${naira(value)}`, `Phone: ${phone}`, `Network: ${operator?.label ?? ""}`, receipt?.ref ? `Reference: ${receipt.ref}` : ""].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Slikpay airtime receipt", text });
      else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); }
    } catch { /* dismissed */ }
  };

  const reset = () => { setStep("details"); setPin(""); setReceipt(null); setAmount(""); setError(""); };

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
    {/* Navy rail */}
    <aside className="bg-navy-rail relative overflow-hidden rounded-3xl p-6 text-white md:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">Bills & top-up</p>
      <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">Airtime in seconds</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">We detect the network from the number, you pick an amount, and the top-up lands instantly.</p>
      <ol className="mt-6 space-y-3">
        {["Enter the phone number", "Pick or type an amount", "Confirm and pay"].map((s, i) => {
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
            {recents.map((r) => <Button key={r.phone} variant="outline" size="sm" className="rounded-full" onClick={() => applyRecent(r)}><Phone className="h-3.5 w-3.5 text-cobalt" />{r.phone}<span className="text-muted-foreground">· {r.network}</span></Button>)}
          </div>
        </div>}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="air-phone" className="text-xs font-bold">Phone number</label>
            {myPhone && phone !== myPhone && <Button variant="link" size="sm" className="h-auto p-0 text-xs font-bold text-cobalt" onClick={() => setPhone(myPhone)}><User className="h-3 w-3" />My number</Button>}
          </div>
          <Input id="air-phone" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setError(""); }} placeholder="080 0000 0000" className="h-12 rounded-xl font-mono text-base tracking-wide" aria-label="Phone number" />
          {phone && !PHONE_OK.test(phone) && <p className="text-[11px] font-semibold text-destructive">Enter the full 11-digit number starting with 0.</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="air-net" className="text-xs font-bold">Network {detecting && <Loader2 className="inline h-3 w-3 animate-spin text-cobalt" aria-label="Detecting network" />}</label>
          <select id="air-net" value={operatorId} disabled={!operators?.length} onChange={(e) => setOperatorId(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-background/60 px-3 text-sm font-semibold disabled:opacity-60" aria-label="Network">
            <option value="">{operators === null ? "Loading networks…" : detecting ? "Detecting…" : "Choose network"}</option>
            {operators?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {detected && <p className="flex items-center gap-1 text-[11px] font-semibold text-chart-2"><Zap className="h-3 w-3" />Detected: {detected}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="air-amt" className="text-xs font-bold">Amount (₦)</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK_AMOUNTS.map((q) => <Button key={q} type="button" variant={value === q ? "brand" : "outline"} size="sm" className="rounded-full font-mono font-bold" onClick={() => setAmount(String(q))}>₦{q.toLocaleString()}</Button>)}
          </div>
          <Input id="air-amt" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} placeholder="Or type an amount" className="h-12 rounded-xl font-mono" aria-label="Amount in naira" />
          {short && <p className="text-[11px] font-semibold text-destructive">This is more than your available balance of {naira(balance ?? 0)}.</p>}
        </div>

        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button variant="brand" className="h-12 w-full rounded-full text-sm" disabled={!valid || short} onClick={() => { setError(""); setStep("review"); }}>
          Continue<ArrowRight />
        </Button>
      </div>}

      {step === "review" && <div className="space-y-5">
        <dl className="space-y-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd className="font-mono font-bold">{phone}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Network</dt><dd className="font-bold">{operator?.label}</dd></div>
          <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{naira(value)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fee</dt><dd className="font-mono font-bold">Shown on receipt</dd></div>
          <div className="flex justify-between gap-3 text-base"><dt className="font-extrabold">Total</dt><dd className="font-mono font-extrabold">{naira(value)}</dd></div>
        </dl>
        {live && <Input inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit transaction PIN" aria-label="Transaction PIN" className="text-center font-mono tracking-[0.5em]" />}
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="rounded-full" onClick={() => setStep("details")}><ChevronLeft />Edit</Button>
          <Button variant="brand" className="h-12 flex-1 rounded-full" disabled={busy} onClick={pay}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Buy airtime · {naira(value)}</Button>
        </div>
      </div>}

      {step === "done" && <div className="space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground"><Check className="h-7 w-7" /></span>
        <div>
          <p className="text-lg font-extrabold">Airtime sent</p>
          <p className="font-mono text-2xl font-bold">{naira(value)}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><Smartphone className="h-4 w-4" />{phone} · {operator?.label}</p>
        </div>
        {receipt?.ref && <p className="text-xs text-muted-foreground">Reference <span className="font-mono">{receipt.ref}</span></p>}
        <div className="flex gap-2">
          <Button variant="crisp" className="flex-1 rounded-full" onClick={share}>{"share" in navigator ? <Share2 /> : <Copy />}{"share" in navigator ? "Share receipt" : "Copy receipt"}</Button>
          <Button variant="brand" className="flex-1 rounded-full" onClick={reset}>New top-up</Button>
        </div>
      </div>}
    </div>
  </section>;
}
