import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BadgeCheck, Clock3, Globe2, History, Info, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CORRIDORS, GLOBAL_SOURCES, isInternationalReceipt, type Corridor } from "@/lib/international";
import {
  quoteGlobalPayout, sendGlobalPayout, reconcileGlobalPayoutsFn,
  type GlobalQuote, type GlobalPayoutResult,
} from "@/lib/international.functions";
import { paymentFeedback } from "@/lib/payment-feedback";
import { useBankingProfile } from "./PaddleConsole";
import { CryptoBankFunding } from "./CryptoBankFunding";

const money = (n: number, currency?: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

interface ProfileLike { mode: string; balances: Record<string, number>; receipts: Array<{ id: string; operation: string; status: string; amount: number | string; currency: string; provider_reference: string | null; created_at: string }> }

/** Cross-border / remittance payout composer, backed by the owner-confirmed provider contract. */
function CrossBorderPayout({ purpose, profile, refresh }: { purpose: "cross-border" | "remittance"; profile: ProfileLike; refresh: () => void }) {
  const quoteFn = useServerFn(quoteGlobalPayout);
  const sendFn = useServerFn(sendGlobalPayout);
  const reconcileFn = useServerFn(reconcileGlobalPayoutsFn);

  const sources = useMemo(() => GLOBAL_SOURCES
    .map((code) => ({ code, balance: profile.balances[code] ?? 0 }))
    .filter((s) => s.code === "NGN" || s.balance > 0), [profile.balances]);
  const [source, setSource] = useState("NGN");
  const [country, setCountry] = useState("US");
  const [accountName, setAccountName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [quote, setQuote] = useState<GlobalQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<GlobalPayoutResult | null>(null);
  const [error, setError] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileNote, setReconcileNote] = useState("");

  const corridor: Corridor | null = useMemo(() => CORRIDORS.find((c) => c.id === country) ?? null, [country]);
  const corridors = useMemo(() => source === "NGN" ? CORRIDORS : CORRIDORS.filter((c) => c.target === source), [source]);
  useEffect(() => { if (corridor && !corridors.some((c) => c.id === corridor.id)) { const next = corridors[0]; if (next) { setCountry(next.id); setFields({}); } } }, [corridor, corridors]);

  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const fieldsFilled = Boolean(corridor && accountName.trim().length >= 2 && corridor.fields.every((fl) => (fields[fl.name] ?? "").trim()));
  const sourceBalance = sources.find((s) => s.code === source)?.balance ?? 0;

  const quoteKey = `${source}|${country}|${accountName}|${corridor?.fields.map((fl) => fields[fl.name] ?? "").join("|") ?? ""}|${amount}`;
  const runQuote = useCallback(async (key: string) => {
    if (!amountValid || !fieldsFilled) { setQuote(null); setQuoteError(""); return; }
    setQuoting(true); setQuoteError("");
    try {
      const q = await quoteFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
      } });
      if (key === quoteKey) setQuote(q);
    } catch (e) {
      if (key === quoteKey) { setQuote(null); setQuoteError(e instanceof Error ? e.message : "Could not price this payment. Try again."); }
    } finally { if (key === quoteKey) setQuoting(false); }
  }, [quoteFn, source, country, accountName, fields, amount, amountValid, fieldsFilled, quoteKey]);
  useEffect(() => {
    const key = quoteKey;
    const t = setTimeout(() => { void runQuote(key); }, 550);
    return () => clearTimeout(t);
  }, [quoteKey, runQuote]);

  const send = async () => {
    if (!corridor || !amountValid || !fieldsFilled || !quote) return;
    setSending(true); setError(""); setResult(null);
    try {
      const r = await sendFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: fields, pin: pin ? pin : undefined, idempotencyKey: crypto.randomUUID(),
      } });
      setResult(r);
      if (r.status === "succeeded") { setQuote(null); setAmount(""); setPin(""); }
      refresh();
    } catch (e) {
      setError(paymentFeedback(e, "transfer"));
      refresh();
    } finally { setSending(false); }
  };

  const reconcile = async () => {
    setReconciling(true); setReconcileNote("");
    try {
      const r = await reconcileFn();
      const settled = r.results.filter((x) => x.status === "succeeded").length;
      const declined = r.results.filter((x) => x.status === "failed").length;
      setReconcileNote(r.checked === 0 ? "No payments are awaiting confirmation."
        : `${r.checked} payment${r.checked === 1 ? "" : "s"} checked — ${settled} completed, ${declined} declined, ${r.checked - settled - declined} still awaiting the network.`);
      refresh();
    } catch { setReconcileNote("Pending payments could not be checked. Try again."); }
    finally { setReconciling(false); }
  };

  const pending = profile.receipts.filter((r) => isInternationalReceipt(r.operation) && !["succeeded", "failed"].includes(r.status));
  const heading = purpose === "remittance" ? "Send money abroad" : "Pay a bank account abroad";

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">{heading}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Live rates and fees come from our banking partner. Funds are reserved at the exact total before any payment is dispatched.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="xp-source">Pay from</Label>
            <select id="xp-source" value={source} onChange={(e) => { setSource(e.target.value); setQuote(null); }}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              {sources.map((s) => <option key={s.code} value={s.code}>{s.code === "NGN" ? "Naira wallet (auto-convert)" : `${s.code} wallet`} — {money(s.balance, s.code)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="xp-country">Destination</Label>
            <select id="xp-country" value={country} onChange={(e) => { setCountry(e.target.value); setFields({}); setQuote(null); }}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              {corridors.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.target})</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="xp-name">Recipient account name</Label>
            <Input id="xp-name" value={accountName} maxLength={160} onChange={(e) => setAccountName(e.target.value)} placeholder="Full name on the receiving account" autoComplete="off" />
          </div>
          {corridor?.fields.map((fl) => <div key={fl.name} className="space-y-1.5">
            <Label htmlFor={`xp-${fl.name}`}>{fl.label}</Label>
            <Input id={`xp-${fl.name}`} value={fields[fl.name] ?? ""} onChange={(e) => setFields((p) => ({ ...p, [fl.name]: e.target.value }))}
              placeholder={fl.hint} autoComplete="off" />
          </div>)}
          <div className="space-y-1.5"><Label htmlFor="xp-amount">Amount ({corridor?.target ?? ""})</Label>
            <Input id="xp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" />
          </div>
          {profile.mode === "live" && <div className="space-y-1.5"><Label htmlFor="xp-pin">Transaction PIN</Label>
            <Input id="xp-pin" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4 digits" autoComplete="off" />
          </div>}
        </div>
        {sources.length === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4" />Fund a wallet first — payouts need an available balance.</p>}
      </div>

      {pending.length > 0 && <div className="rounded-2xl border border-magenta/40 bg-magenta/5 p-5">
        <h4 className="flex items-center gap-2 font-bold"><Clock3 className="h-4 w-4 text-magenta" />Payments awaiting confirmation</h4>
        <ul className="mt-3 space-y-2 text-sm">
          {pending.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2">
            <span className="font-mono text-xs">{r.provider_reference ?? r.id}</span>
            <span className="tabular-nums">{Number(r.amount).toLocaleString()} {r.currency}</span>
          </li>)}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Reserved funds stay unavailable until the network confirms or declines each payment. Do not submit these payments again.</p>
        <Button variant="outline" size="sm" className="mt-3" disabled={reconciling} onClick={() => void reconcile()}>
          <RefreshCw className={reconciling ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Check payment status
        </Button>
        {reconcileNote && <p className="mt-2 text-xs text-muted-foreground">{reconcileNote}</p>}
      </div>}

      {result && <div className={`rounded-2xl border p-5 ${result.status === "succeeded" ? "border-success/40 bg-success/5" : result.status === "failed" ? "border-destructive/40 bg-destructive/5" : "border-magenta/40 bg-magenta/5"}`} role="status">
        {result.status === "succeeded" ? <>
          <p className="flex items-center gap-2 font-bold text-success"><BadgeCheck className="h-5 w-5" />Payment completed</p>
          <p className="mt-1 text-sm">{money(result.recipientGets, result.destinationCurrency)} is on its way to the recipient.</p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            {result.reference && <div className="flex gap-2"><dt className="font-semibold">Reference</dt><dd className="font-mono">{result.reference}</dd></div>}
            {result.trackingReference && <div className="flex gap-2"><dt className="font-semibold">Tracking</dt><dd className="font-mono">{result.trackingReference}</dd></div>}
            <div className="flex gap-2"><dt className="font-semibold">Total debited</dt><dd className="tabular-nums">{money(result.totalDebit, quote?.feeCurrency ?? source)}</dd></div>
          </dl>
        </> : result.status === "failed" ? <p className="flex items-start gap-2 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{result.reason}</span></p>
          : <p className="flex items-start gap-2 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>{result.note}</span></p>}
      </div>}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    </div>

    <aside className="h-fit space-y-4 rounded-2xl border border-border bg-obsidian p-5 text-white lg:sticky lg:top-4" style={{ background: "linear-gradient(150deg, hsl(var(--obsidian)) 0%, hsl(222 60% 14%) 100%)" }}>
      <h4 className="flex items-center gap-2 font-bold"><Globe2 className="h-4 w-4 text-cyan" />Payment summary</h4>
      {!quote && <p className="text-xs leading-6 text-white/70">{quoting ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Pricing this payment…</span> : quoteError || "Fill in the recipient and amount to see the exact rate, fee and total debit."}</p>}
      {quoteError && !quoting && <p className="text-xs text-rose-300">{quoteError}</p>}
      {quote && <dl className="space-y-3 text-sm">
        <div><dt className="text-xs text-white/60">Recipient gets</dt><dd className="text-lg font-bold tabular-nums text-cyan">{money(quote.recipientGets, quote.target)}</dd></div>
        {quote.rate && <div><dt className="text-xs text-white/60">Exchange rate</dt><dd className="tabular-nums">₦{quote.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} per {quote.target}</dd></div>}
        <div><dt className="text-xs text-white/60">Fee</dt><dd className="tabular-nums">{money(quote.fee, quote.feeCurrency)}</dd></div>
        <div><dt className="text-xs text-white/60">Total debited from {quote.feeCurrency} wallet</dt><dd className="text-lg font-bold tabular-nums">{money(quote.totalDebit, quote.feeCurrency)}</dd></div>
        <p className="border-t border-white/10 pt-3 text-xs text-white/60">{quote.rule} · minimum {money(quote.minimum, quote.target)}</p>
        <p className={`text-xs ${sourceBalance >= quote.totalDebit ? "text-white/60" : "text-rose-300"}`}>Available: {money(sourceBalance, quote.feeCurrency)}{sourceBalance < quote.totalDebit ? " — not enough for this total yet" : ""}</p>
      </dl>}
      <Button className="w-full" disabled={!quote || sending || (profile.mode === "live" && pin.length !== 4)} onClick={() => void send()}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{sending ? "Sending…" : "Send payment"}
      </Button>
      <p className="flex items-start gap-2 text-xs text-white/50"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />If the network is slow, funds stay reserved and the payment completes or is returned automatically.</p>
    </aside>
  </div>;
}

export function InternationalServices({ initial = "cross-border" }: { initial?: "cross-border" | "remittance" | "crypto" }) {
  const { profile, error: profileError, refresh } = useBankingProfile();
  const [tab, setTab] = useState<"cross-border" | "remittance" | "crypto">(initial);
  const history = profile?.receipts.filter((r) => isInternationalReceipt(r.operation)) ?? [];
  return <section className="space-y-5" aria-label="International services">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">Cross-border & remittances</h2><p className="mt-1 text-xs text-muted-foreground">{profile ? profile.mode === "live" ? "Live account" : "Sandbox account" : "Checking account…"}</p></div>
      <Button variant="outline" size="icon" aria-label="Refresh international services" onClick={() => refresh()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border pb-4" role="group" aria-label="International payment services">
      <Button variant={tab === "cross-border" ? "default" : "outline"} aria-pressed={tab === "cross-border"} onClick={() => setTab("cross-border")}><Globe2 />Cross-border</Button>
      <Button variant={tab === "remittance" ? "default" : "outline"} aria-pressed={tab === "remittance"} onClick={() => setTab("remittance")}><ArrowRight />Remittances</Button>
      <Button variant={tab === "crypto" ? "default" : "outline"} aria-pressed={tab === "crypto"} onClick={() => setTab("crypto")}><ArrowRight />Crypto to NGN bank</Button>
    </div>
    {tab === "crypto" ? <CryptoBankFunding balances={profileError ? undefined : profile?.balances} /> : profileError || !profile
      ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{profileError || "Your account could not be confirmed. Refresh to try again."}</p>
      : <>
        <CrossBorderPayout purpose={tab} profile={profile} refresh={refresh} />
        <section className="border-t border-border pt-5"><h3 className="mb-3 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-cobalt" />International payment history</h3>
          {!history.length ? <p className="text-sm text-muted-foreground">No international payments recorded.</p> : <ul className="divide-y divide-border">{history.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0 break-all font-mono">{r.provider_reference ?? r.id}</span><span className="tabular-nums">{Number(r.amount).toLocaleString()} {r.currency}</span><span className={r.status === "succeeded" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{r.status === "succeeded" ? "Completed" : r.status === "failed" ? "Failed" : "Awaiting confirmation"}</span></li>)}</ul>}
        </section>
      </>}
  </section>;
}
