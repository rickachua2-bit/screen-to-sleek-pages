import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BadgeCheck, Clock3, Download, Globe2, GraduationCap, History, Info, Landmark, Repeat, Wallet, Loader2, RefreshCw, Search, ShieldCheck, TriangleAlert, ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CORRIDORS, GLOBAL_SOURCES, PAYMENT_PURPOSES, QUOTE_CHANGED, corridorMethod, isInternationalReceipt, quoteSecondsLeft, savedRecipientsFrom, trackSteps, type Corridor, type PaymentPurpose } from "@/lib/international";
import {
  quoteGlobalPayout, sendGlobalPayout, reconcileGlobalPayoutsFn,
  type GlobalQuote, type GlobalPayoutResult,
} from "@/lib/international.functions";
import { paymentFeedback } from "@/lib/payment-feedback";
import { useBankingProfile } from "./PaddleConsole";
import { CryptoBankFunding } from "./CryptoBankFunding";
import { HoldBalances, ReceiveAccounts } from "./InternationalAccounts";
import { currencyDef } from "@/lib/wallets";
import globe from "@/assets/transfer-globe.jpg";

const money = (n: number, currency?: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

interface ProfileLike { mode: string; balances: Record<string, number>; receipts: Array<{ id: string; operation: string; status: string; amount: number | string; currency: string; provider_reference: string | null; created_at: string; mode?: string; summary?: Record<string, unknown> | null }> }

/** Cross-border / remittance payout composer — Destination Explorer layout, backed by the owner-confirmed provider contract. */
function CrossBorderPayout({ purpose, profile, refresh, compact = false }: { purpose: "cross-border" | "remittance"; profile: ProfileLike; refresh: () => void; compact?: boolean }) {
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
  const [search, setSearch] = useState("");
  const [quote, setQuote] = useState<GlobalQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<GlobalPayoutResult | null>(null);
  const [error, setError] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileNote, setReconcileNote] = useState("");
  const [payPurpose, setPayPurpose] = useState<PaymentPurpose>(purpose === "remittance" ? "Family support" : "Business services");
  const [quotedAt, setQuotedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // One stable reference per payment attempt: retries after an error resume the same payment instead of creating a duplicate.
  const attemptKey = useRef<{ for: string; key: string } | null>(null);
  const saved = useMemo(() => savedRecipientsFrom(profile.receipts.filter((r) => !r.mode || r.mode === profile.mode)), [profile.receipts, profile.mode]);

  const corridor: Corridor | null = useMemo(() => CORRIDORS.find((c) => c.id === country) ?? null, [country]);
  const corridors = useMemo(() => source === "NGN" ? CORRIDORS : CORRIDORS.filter((c) => c.target === source), [source]);
  useEffect(() => { if (corridor && !corridors.some((c) => c.id === corridor.id)) { const next = corridors[0]; if (next) { setCountry(next.id); setFields({}); } } }, [corridor, corridors]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? corridors.filter((c) => `${c.label} ${c.target}`.toLowerCase().includes(q)) : corridors;
  }, [corridors, search]);

  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const fieldsFilled = Boolean(corridor && accountName.trim().length >= 2 && corridor.fields.every((fl) => (fields[fl.name] ?? "").trim()));
  const sourceBalance = sources.find((s) => s.code === source)?.balance ?? 0;

  const quoteKey = `${profile.mode}|${source}|${country}|${accountName}|${corridor?.fields.map((fl) => fields[fl.name] ?? "").join("|") ?? ""}|${amount}`;
  const currentQuoteKey = useRef(quoteKey);
  currentQuoteKey.current = quoteKey;
  const quoteSequence = useRef(0);
  const quoteInFlight = useRef(false);
  const [pricedKey, setPricedKey] = useState("");
  const dispatching = useRef(false);
  const runQuote = useCallback(async (key: string) => {
    const sequence = ++quoteSequence.current;
    if (!amountValid || !fieldsFilled) { setQuote(null); setQuoteError(""); return; }
    quoteInFlight.current = true;
    setQuoting(true); setQuoteError("");
    try {
      const q = await quoteFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
      } });
      if (key === currentQuoteKey.current && sequence === quoteSequence.current) { setQuote(q); setPricedKey(key); setQuotedAt(Date.now()); setNow(Date.now()); }
    } catch (e) {
      if (key === currentQuoteKey.current && sequence === quoteSequence.current) { setQuote(null); setQuoteError("Could not price this payment. Check recipient details and try again."); }
    } finally { if (sequence === quoteSequence.current) { quoteInFlight.current = false; setQuoting(false); } }
  }, [quoteFn, source, country, accountName, fields, amount, amountValid, fieldsFilled, quoteKey]);
  useEffect(() => {
    setQuote(null); setPricedKey("");
    const key = quoteKey;
    const t = setTimeout(() => { void runQuote(key); }, 550);
    return () => clearTimeout(t);
  }, [quoteKey, runQuote]);
  useEffect(() => { if (!quote) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [quote]);
  const secondsLeft = quote ? quoteSecondsLeft(quotedAt, now) : 0;
  // Expired quotes are re-priced automatically; the user confirms whatever total is current.
  useEffect(() => { if (quote && secondsLeft === 0 && !sending && !quoteInFlight.current) void runQuote(quoteKey); }, [quote, secondsLeft, sending, runQuote, quoteKey]);
  const canSend = Boolean(quote && pricedKey === quoteKey && !quoting && secondsLeft > 0 && sourceBalance >= quote.totalDebit && result?.status !== "pending");
  const applySaved = (key: string) => {
    const r = saved.find((x) => x.key === key); if (!r) return;
    setCountry(r.country); setAccountName(r.accountName); setFields(r.fields); setQuote(null);
  };

  const send = async () => {
    if (dispatching.current || !canSend || !corridor || !amountValid || !fieldsFilled || !quote) return;
    dispatching.current = true;
    setSending(true); setError(""); setResult(null);
    if (attemptKey.current?.for !== quoteKey) attemptKey.current = { for: quoteKey, key: crypto.randomUUID() };
    try {
      const r = await sendFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: fields, pin: pin ? pin : undefined, idempotencyKey: attemptKey.current.key,
        confirmedTotal: quote.totalDebit, purpose: payPurpose,
      } });
      setResult(r);
      // Keep the original reference for declined and pending attempts too; only edited instructions start another attempt.
      if (r.status === "succeeded") { setQuote(null); setAmount(""); setPin(""); }
      refresh();
    } catch (e) {
      if (e instanceof Error && e.message === QUOTE_CHANGED) { attemptKey.current = null; setError(QUOTE_CHANGED); void runQuote(quoteKey); }
      else setError(paymentFeedback(e, "transfer"));
      refresh();
    } finally { dispatching.current = false; setSending(false); setPin(""); }
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

  const heading = purpose === "remittance" ? "Send money abroad" : "Pay a bank account abroad";

  return <div className={`international-send space-y-5 ${compact ? "international-send-compact" : ""}`}>
    <div className="international-send-workspace">
      {/* Navy destination explorer rail */}
      <aside className="international-destinations">
        <h3 className="text-sm font-bold tracking-wide">{heading}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{profile.mode === "live" ? "Live account" : "Sandbox account"}</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries or currencies" aria-label="Search destinations"
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
        </div>
        <ul role="listbox" aria-label="Destinations" className="international-country-list">
          {filtered.map((c) => {
            const active = c.id === country;
            return <li key={c.id} className="shrink-0 lg:shrink">
              <Button disabled={sending || result?.status === "pending"} variant="outline" type="button" role="option" aria-selected={active}
                onClick={() => { setCountry(c.id); setFields({}); setQuote(null); setQuoteError(""); }}
                className={`international-country ${active ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                <span className="text-xl" aria-hidden="true">{currencyDef(c.target)?.flag}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.label}</span><span className="block truncate text-xs text-muted-foreground">{c.target} · {corridorMethod(c)}</span></span>
                <span className="international-country-status"><span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden="true" />{profile.mode === "live" ? "Available" : "Sandbox"}</span>
              </Button>
            </li>;
          })}
          {!filtered.length && <li className="px-3 py-2 text-xs text-muted-foreground">No matching destination.</li>}
        </ul>
        
      </aside>

      {/* White payment workspace */}
      <div className="international-recipient-workspace min-w-0 space-y-5">
        <div className="international-quote-metrics grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowRight className="h-3.5 w-3.5 text-cobalt" />Exchange rate</p>
            <p className="mt-1.5 text-sm font-bold tabular-nums">{quote?.rate ? `₦${quote.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} per ${quote.target}` : quoting ? "Pricing…" : "Live at review"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Live rate, refreshed per payment</p>
          </div>
          <div className="rounded-xl border border-border p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-magenta" />Transfer fee</p>
            <p className="mt-1.5 text-sm font-bold tabular-nums">{quote ? money(quote.fee, quote.feeCurrency) : "0.5%"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{quote ? quote.rule : "Naira-funded: min ₦5,000 · wallets: min 5, max 25"}</p>
          </div>
          <div className="rounded-xl border border-border p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-cyan" />Minimum amount</p>
            <p className="mt-1.5 text-sm font-bold tabular-nums">{quote ? money(quote.minimum, quote.target) : "USD 10 equiv."}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Confirmed by the payment network</p>
          </div>
        </div>

        <div className="international-recipient-form">
          <h4 className="text-base font-bold">Recipient details</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Funds are reserved at the exact total before any payment is dispatched.</p>
          {saved.length > 0 && <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Repeat className="h-3.5 w-3.5 text-magenta" />Send again</p>
            <div className="mt-2 flex flex-wrap gap-2">{saved.map((r) => <Button variant="outline" size="sm" key={r.key} type="button" onClick={() => applySaved(r.key)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold hover:border-cobalt hover:text-cobalt">{r.accountName} · {r.country}</Button>)}</div>
          </div>}
          <fieldset disabled={sending || result?.status === "pending"} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="xp-source">Pay from</Label>
              <select id="xp-source" value={source} onChange={(e) => { setSource(e.target.value); setQuote(null); }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {sources.map((s) => <option key={s.code} value={s.code}>{s.code === "NGN" ? "Naira wallet (auto-convert)" : `${s.code} wallet`} — {money(s.balance, s.code)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="xp-amount">Amount ({corridor?.target ?? ""})</Label>
              <Input id="xp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" />
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="xp-name">Recipient account name</Label>
              <Input id="xp-name" value={accountName} maxLength={160} onChange={(e) => setAccountName(e.target.value)} placeholder="Full name on the receiving account" autoComplete="off" />
            </div>
            {corridor?.fields.map((fl) => <div key={fl.name} className="space-y-1.5">
              <Label htmlFor={`xp-${fl.name}`}>{fl.label}</Label>
              <Input id={`xp-${fl.name}`} value={fields[fl.name] ?? ""} onChange={(e) => setFields((p) => ({ ...p, [fl.name]: e.target.value }))}
                placeholder={fl.hint} autoComplete="off" />
            </div>)}
            <div className="space-y-1.5"><Label htmlFor="xp-purpose">Purpose of payment</Label>
              <select id="xp-purpose" value={payPurpose} onChange={(e) => setPayPurpose(e.target.value as PaymentPurpose)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {PAYMENT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {profile.mode === "live" && <div className="space-y-1.5"><Label htmlFor="xp-pin">Transaction PIN</Label>
              <Input id="xp-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4 digits" autoComplete="off" />
            </div>}
          </fieldset>
          {sources.length === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4" />Fund a wallet first — payouts need an available balance.</p>}
          {quoteError && !quoting && <p className="mt-3 text-xs text-destructive">{quoteError}</p>}

          {quote && <div className="mt-4 rounded-xl border border-cyan/40 bg-cyan/5 p-4 text-sm" role="status">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Recipient gets <strong className="tabular-nums text-foreground">{money(quote.recipientGets, quote.target)}</strong></span>
              <span className="tabular-nums">Fee <strong>{money(quote.fee, quote.feeCurrency)}</strong></span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 border-t border-cyan/20 pt-2">
              <span className="text-muted-foreground">Total debited from {quote.feeCurrency} wallet</span>
              <strong className="text-lg tabular-nums text-cobalt">{money(quote.totalDebit, quote.feeCurrency)}</strong>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-cyan" />{secondsLeft > 0 ? `Rate held on screen for ${secondsLeft}s — re-checked when you send` : "Refreshing rate…"}{corridor ? ` · ${corridorMethod(corridor)}` : ""}</p>
            <p className={`mt-1.5 text-xs ${sourceBalance >= quote.totalDebit ? "text-muted-foreground" : "text-destructive"}`}>Available: {money(sourceBalance, quote.feeCurrency)}{sourceBalance < quote.totalDebit ? " — not enough for this total yet" : ""}</p>
          </div>}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="outline" className="border-magenta/50 text-magenta hover:bg-magenta/5" disabled={reconciling} onClick={() => void reconcile()}>
              <RefreshCw className={reconciling ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Check pending payments
            </Button>
            <Button className="min-w-44" disabled={!canSend || sending || (profile.mode === "live" && pin.length !== 4)} onClick={() => void send()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{sending ? "Sending…" : "Send payment"}
            </Button>
          </div>
          {reconcileNote && <p className="mt-2 text-xs text-muted-foreground">{reconcileNote}</p>}
        </div>

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
    </div>

  </div>;
}

const STATUS_TEXT = (s: string) => s === "succeeded" ? "Paid out" : s === "failed" ? "Declined" : "Awaiting confirmation";

/** Track tab: timeline per payment, automatic status checks against the original payment reference. */
function TrackPayments({ profile, refresh }: { profile: ProfileLike; refresh: () => void }) {
  const reconcileFn = useServerFn(reconcileGlobalPayoutsFn);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");
  const checkingRef = useRef(false);
  const history = profile.receipts.filter((r) => isInternationalReceipt(r.operation) && (!r.mode || r.mode === profile.mode));
  const pendingCount = history.filter((r) => !["succeeded", "failed"].includes(r.status)).length;
  const check = useCallback(async (quiet: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const r = await reconcileFn();
      if (!quiet) setNote(r.checked === 0 ? "No payments are awaiting confirmation." : `${r.checked} checked — ${r.results.filter((x) => x.status === "succeeded").length} paid, ${r.results.filter((x) => x.status === "failed").length} declined.`);
      refresh();
    } catch { if (!quiet) setNote("Payments could not be checked. Try again."); }
    finally { checkingRef.current = false; setChecking(false); }
  }, [reconcileFn, refresh]);
  useEffect(() => {
    if (!pendingCount) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void check(true); }, 30_000);
    return () => clearInterval(t);
  }, [pendingCount, check]);
  const download = (r: ProfileLike["receipts"][number]) => {
    const s = r.summary ?? {};
    const lines = ["Slikpay international payment receipt", `Reference: ${r.provider_reference ?? r.id}`, `Date: ${new Date(r.created_at).toLocaleString()}`, `Status: ${STATUS_TEXT(r.status)}`,
      `Recipient: ${String(s["recipient"] ?? "")}`, `Destination: ${String(s["country"] ?? "")} ${String(s["destinationCurrency"] ?? "")}`, `Recipient gets: ${String(s["recipientGets"] ?? "")} ${String(s["destinationCurrency"] ?? "")}`,
      `Fee: ${String(s["fee"] ?? "")} ${String(s["feeCurrency"] ?? r.currency)}`, `Total debited: ${String(s["totalDebit"] ?? r.amount)} ${String(s["feeCurrency"] ?? r.currency)}`, s["purpose"] ? `Purpose: ${String(s["purpose"])}` : "",
      typeof s["trackingReference"] === "string" ? `Tracking: ${s["trackingReference"]}` : ""].filter(Boolean);
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = `slikpay-${r.provider_reference ?? r.id}.txt`; a.click(); URL.revokeObjectURL(url);
  };
  return <section className="international-tracking space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{pendingCount ? `${pendingCount} payment${pendingCount === 1 ? "" : "s"} awaiting the network — checked automatically every 30 seconds. Do not send these again.` : history.length ? "All recorded payments are settled." : "No international payments recorded yet."}</p>
      <Button variant="outline" className="border-magenta/50 text-magenta hover:bg-magenta/5" disabled={checking} onClick={() => void check(false)}><RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Check now</Button>
    </div>
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
    {!history.length ? <p className="text-sm text-muted-foreground">No international payments recorded.</p> : <ul className="space-y-3">{history.map((r) => {
      const s = r.summary ?? {};
      return <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="font-bold">{String(s["recipient"] ?? "International payment")}</p><p className="break-all font-mono text-xs text-muted-foreground">{r.provider_reference ?? r.id} · {new Date(r.created_at).toLocaleString()}</p></div>
          <div className="text-right"><p className="font-bold tabular-nums">{Number(r.amount).toLocaleString()} {r.currency}</p>
            <p className={`text-xs font-semibold ${r.status === "succeeded" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-magenta"}`}>{STATUS_TEXT(r.status)}</p></div>
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Payment progress">{trackSteps(r.status).map((st) => <li key={st.label} className="flex items-center gap-2 text-xs">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.state === "done" ? "bg-success" : st.state === "failed" ? "bg-destructive" : st.state === "current" ? "animate-pulse bg-magenta" : "bg-muted"}`} aria-hidden="true" />
          <span className={st.state === "todo" ? "text-muted-foreground" : "font-semibold"}>{st.label}</span></li>)}</ol>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => download(r)}><Download className="h-3.5 w-3.5" />Receipt</Button>
      </li>;
    })}</ul>}
  </section>;
}

type Tab = "overview" | "receive" | "hold" | "swap" | "send" | "track" | "treasury";
const TABS: Array<{ id: Tab; label: string; icon: typeof Globe2 }> = [
  { id: "overview", label: "Overview", icon: Globe2 },
  { id: "receive", label: "Receive", icon: Landmark }, { id: "hold", label: "Hold", icon: Wallet }, { id: "swap", label: "Swap", icon: Repeat },
  { id: "send", label: "Send", icon: ArrowRight }, { id: "track", label: "Track", icon: History }, { id: "treasury", label: "Vaults · not connected", icon: Landmark },
];

export function InternationalServices({ initial }: { initial?: "cross-border" | "remittance" | "crypto" | "swap" | "treasury" | "receive" | "hold" | "track" | "send" }) {
  const { profile, error: profileError, refresh: refreshProfile } = useBankingProfile();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => { setRefreshVersion((v) => v + 1); setRefreshing(true); void refreshProfile().finally(() => setRefreshing(false)); }, [refreshProfile]);
  const [tab, setTab] = useState<Tab>(initial === "crypto" || initial === "swap" ? "swap" : initial === "treasury" ? "treasury" : initial === "receive" ? "receive" : initial === "hold" ? "hold" : initial === "track" ? "track" : initial === "cross-border" || initial === "remittance" || initial === "send" ? "send" : "overview");
  const [kind, setKind] = useState<"cross-border" | "remittance" | "tuition">(initial === "remittance" ? "remittance" : "cross-border");
  const unavailable = !profileError && !profile ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your account…</p> : <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Your account could not be confirmed. Refresh to try again.</p>;
  return <section className="international-bento space-y-5" aria-label="International services">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold text-muted-foreground">Your global money workspace</p><h2 className="mt-1 text-2xl font-extrabold">International & Swap</h2></div>
      <span className="international-mode"><Globe2 className="h-4 w-4 text-primary" />{profile ? profile.mode === "live" ? "Live account" : "Sandbox account" : "Checking account…"}</span>
      <Button variant="outline" size="icon" aria-label="Refresh international services" disabled={refreshing} onClick={() => refresh()}><RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
    </div>
    <div className="international-tabs" role="tablist" aria-label="International payment steps">
      {TABS.map((t) => <Button key={t.id} role="tab" aria-selected={tab === t.id} variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}><t.icon />{t.label}</Button>)}
    </div>
    {tab === "overview" ? <><div className="international-top-grid">
        <section className="international-global bg-navy-rail" aria-label="Global balances">
          <img src={globe} alt="" className="international-globe" />
          <div className="relative flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Global balances</h3><p className="mt-1 text-xs text-muted-foreground">Available across your currency wallets</p></div><Button variant="ghost" size="sm" className="international-dark-button" onClick={() => setTab("hold")}>All balances<ArrowUpRight /></Button></div>
          {profileError ? <p role="alert" className="relative mt-6 text-sm">Balances could not be loaded. Refresh to try again.</p> : <div className="international-wallet-strip">{["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "USDT", "USDC"].map((code) => <Button key={code} variant="ghost" className="international-wallet-tile" onClick={() => setTab("hold")} aria-label={`View ${code} wallet`}><span className="international-currency-symbol">{code === "USDT" ? "₮" : code === "USDC" ? "$" : currencyDef(code)?.flag}</span><span className="text-xs font-semibold">{code}</span><strong className="international-wallet-amount">{profile?.balances[code] !== undefined ? profile.balances[code].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: code === "USDT" || code === "USDC" ? 6 : 2 }) : "—"}</strong><ChevronRight className="h-3 w-3" /></Button>)}</div>}
          <div className="relative mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Account-owned balances</span><span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />Fiat & stablecoins</span></div>
        </section>
        <section className="international-swap-launch bg-navy-rail"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Swap</h3><Repeat className="h-5 w-5 text-cyan" /></div><p className="mt-1 text-xs text-muted-foreground">USDT / USDC → NGN</p><div className="international-swap-pair"><span className="international-currency-symbol">₮</span><div><p className="text-xs text-muted-foreground">From</p><strong>USDT or USDC</strong></div><span className="ml-auto font-mono text-sm">{profile?.balances["USDT"] !== undefined ? money(profile.balances["USDT"], "USDT") : "—"}</span></div><div className="my-2 flex justify-center"><ArrowRight className="h-4 w-4 rotate-90 text-cyan" /></div><div className="international-swap-pair"><span className="international-currency-symbol">🇳🇬</span><div><p className="text-xs text-muted-foreground">To</p><strong>Nigerian naira</strong></div><span className="ml-auto text-xs">NGN</span></div><p className="my-4 text-xs text-muted-foreground">Rate and net credit confirmed at review</p><Button className="international-swap-cta w-full" onClick={() => setTab("swap")}>Review conversion<ArrowRight /></Button></section>
      </div>
      <div className="international-main-grid"><section className="international-receive"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><Landmark className="h-4 w-4 text-primary" />Receive account details</h3><Button variant="ghost" size="icon" aria-label="View all receiving accounts" onClick={() => setTab("receive")}><ArrowUpRight /></Button></div><ReceiveAccounts compact refreshVersion={refreshVersion} /></section><section className="international-send-panel">{profileError || !profile ? unavailable : <CrossBorderPayout purpose="cross-border" profile={profile} refresh={refresh} compact />}</section></div>
      <div className="international-tracking-band"><h3 className="mb-4 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-magenta" />Payment tracking</h3>{profileError || !profile ? unavailable : <TrackPayments profile={profile} refresh={refresh} />}</div>
    </> : tab === "receive" ? <ReceiveAccounts refreshVersion={refreshVersion} />
      : tab === "hold" ? <HoldBalances ngn={profileError ? undefined : profile?.balances["NGN"]} refreshVersion={refreshVersion} />
      : tab === "swap" ? <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl border border-cyan/40 bg-cyan/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />Live conversion is available for USDT and USDC into naira, with an optional payout to any Nigerian bank. Other currency pairs are not yet available for conversion.</p>
          <CryptoBankFunding balances={profileError ? undefined : profile?.balances} />
        </div>
      : tab === "treasury" ? <p className="border-t border-border py-5 text-sm text-muted-foreground">Vaults & sweeps are not connected. No funds can be moved or yield earned here.</p>
      : profileError || !profile ? unavailable
      : tab === "track" ? <TrackPayments profile={profile} refresh={refresh} />
      : <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Payment type">
            <Button size="sm" variant={kind === "cross-border" ? "default" : "outline"} aria-pressed={kind === "cross-border"} onClick={() => setKind("cross-border")}><Globe2 />Business payout</Button>
            <Button size="sm" variant={kind === "remittance" ? "default" : "outline"} aria-pressed={kind === "remittance"} onClick={() => setKind("remittance")}><ArrowRight />Remittance</Button>
            <Button size="sm" variant={kind === "tuition" ? "default" : "outline"} aria-pressed={kind === "tuition"} onClick={() => setKind("tuition")}><GraduationCap />Tuition</Button>
          </div>
          {kind === "tuition"
            ? <p className="rounded-2xl border border-magenta/40 bg-magenta/5 p-5 text-sm"><strong className="block text-magenta">Coming soon</strong>School fee payments abroad are not active yet. Until then, pay the school's bank account using Business payout with the purpose "Education / tuition".</p>
            : <CrossBorderPayout key={kind} purpose={kind} profile={profile} refresh={refresh} />}
        </div>}
  </section>;
}
