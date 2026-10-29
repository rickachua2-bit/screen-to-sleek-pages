import { TreasuryAutomation } from "./TreasuryAutomation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BadgeCheck, Clock3, Download, Globe2, GraduationCap, History, Info, Landmark, Repeat, Wallet, Loader2, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
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

const money = (n: number, currency?: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

interface ProfileLike { mode: string; balances: Record<string, number>; receipts: Array<{ id: string; operation: string; status: string; amount: number | string; currency: string; provider_reference: string | null; created_at: string; mode?: string; summary?: Record<string, unknown> | null }> }

/** Alternating brand tints for destination dots on the navy explorer rail. */
const DOTS = ["bg-cyan", "bg-magenta", "bg-cobalt", "bg-success"];

/** Cross-border / remittance payout composer — Destination Explorer layout, backed by the owner-confirmed provider contract. */
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

  const quoteKey = `${source}|${country}|${accountName}|${corridor?.fields.map((fl) => fields[fl.name] ?? "").join("|") ?? ""}|${amount}`;
  const runQuote = useCallback(async (key: string) => {
    if (!amountValid || !fieldsFilled) { setQuote(null); setQuoteError(""); return; }
    setQuoting(true); setQuoteError("");
    try {
      const q = await quoteFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
      } });
      if (key === quoteKey) { setQuote(q); setQuotedAt(Date.now()); }
    } catch (e) {
      if (key === quoteKey) { setQuote(null); setQuoteError(e instanceof Error ? e.message : "Could not price this payment. Try again."); }
    } finally { if (key === quoteKey) setQuoting(false); }
  }, [quoteFn, source, country, accountName, fields, amount, amountValid, fieldsFilled, quoteKey]);
  useEffect(() => {
    const key = quoteKey;
    const t = setTimeout(() => { void runQuote(key); }, 550);
    return () => clearTimeout(t);
  }, [quoteKey, runQuote]);
  useEffect(() => { if (!quote) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [quote]);
  const secondsLeft = quote ? quoteSecondsLeft(quotedAt, now) : 0;
  // Expired quotes are re-priced automatically; the user confirms whatever total is current.
  useEffect(() => { if (quote && secondsLeft === 0 && !sending) void runQuote(quoteKey); }, [quote, secondsLeft, sending, runQuote, quoteKey]);
  const applySaved = (key: string) => {
    const r = saved.find((x) => x.key === key); if (!r) return;
    setCountry(r.country); setAccountName(r.accountName); setFields(r.fields); setQuote(null);
  };

  const send = async () => {
    if (!corridor || !amountValid || !fieldsFilled || !quote) return;
    setSending(true); setError(""); setResult(null);
    if (attemptKey.current?.for !== quoteKey) attemptKey.current = { for: quoteKey, key: crypto.randomUUID() };
    try {
      const r = await sendFn({ data: {
        sourceCurrency: source, country, accountName: accountName.trim(), amount: Number(amount),
        beneficiary: fields, pin: pin ? pin : undefined, idempotencyKey: attemptKey.current.key,
        confirmedTotal: quote.totalDebit, purpose: payPurpose,
      } });
      setResult(r);
      if (r.status !== "pending") attemptKey.current = null;
      if (r.status === "succeeded") { setQuote(null); setAmount(""); setPin(""); }
      refresh();
    } catch (e) {
      if (e instanceof Error && e.message === QUOTE_CHANGED) { attemptKey.current = null; setError(QUOTE_CHANGED); void runQuote(quoteKey); }
      else setError(paymentFeedback(e, "transfer"));
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

  const heading = purpose === "remittance" ? "Send money abroad" : "Pay a bank account abroad";

  return <div className="space-y-5">
    <div className="overflow-hidden rounded-2xl border border-border bg-card lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Navy destination explorer rail */}
      <aside className="bg-navy-rail p-4 text-white">
        <h3 className="text-sm font-bold tracking-wide">{heading}</h3>
        <p className="mt-0.5 text-xs text-white/90">{profile.mode === "live" ? "Live account" : "Sandbox account"}</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/85" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries or currencies" aria-label="Search destinations"
            className="h-9 w-full rounded-lg border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/80 focus:border-cyan focus:outline-none" />
        </div>
        <ul role="listbox" aria-label="Destinations" className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {filtered.map((c, i) => {
            const active = c.id === country;
            return <li key={c.id} className="shrink-0 lg:shrink">
              <button type="button" role="option" aria-selected={active}
                onClick={() => { setCountry(c.id); setFields({}); setQuote(null); setQuoteError(""); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:border-l-2 ${active ? "border-cyan bg-white/10" : "border-transparent hover:bg-white/5"}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOTS[i % DOTS.length]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.label}</span><span className="block truncate text-xs text-white/90">{c.target} · {corridorMethod(c)}</span></span>
                <span className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-cyan lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden="true" />{profile.mode === "live" ? "Available" : "Sandbox"}</span>
              </button>
            </li>;
          })}
          {!filtered.length && <li className="px-3 py-2 text-xs text-white/85">No matching destination.</li>}
        </ul>
        <p className="mt-4 hidden border-t border-white/10 pt-3 text-xs leading-5 text-white/90 lg:block">Fees are priced live per corridor. Funds stay reserved if a network is slow, and are returned automatically on a confirmed decline.</p>
      </aside>

      {/* White payment workspace */}
      <div className="min-w-0 space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
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

        <div className="rounded-xl border border-border p-5">
          <h4 className="text-base font-bold">Recipient details</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Funds are reserved at the exact total before any payment is dispatched.</p>
          {saved.length > 0 && <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Repeat className="h-3.5 w-3.5 text-magenta" />Send again</p>
            <div className="mt-2 flex flex-wrap gap-2">{saved.map((r) => <button key={r.key} type="button" onClick={() => applySaved(r.key)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold hover:border-cobalt hover:text-cobalt">{r.accountName} · {r.country}</button>)}</div>
          </div>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              <Input id="xp-pin" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4 digits" autoComplete="off" />
            </div>}
          </div>
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
            <Button className="min-w-44" disabled={!quote || sending || (profile.mode === "live" && pin.length !== 4)} onClick={() => void send()}>
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
  const history = profile.receipts.filter((r) => isInternationalReceipt(r.operation) && (!r.mode || r.mode === profile.mode));
  const pendingCount = history.filter((r) => !["succeeded", "failed"].includes(r.status)).length;
  const check = useCallback(async (quiet: boolean) => {
    setChecking(true);
    try {
      const r = await reconcileFn();
      if (!quiet) setNote(r.checked === 0 ? "No payments are awaiting confirmation." : `${r.checked} checked — ${r.results.filter((x) => x.status === "succeeded").length} paid, ${r.results.filter((x) => x.status === "failed").length} declined.`);
      refresh();
    } catch { if (!quiet) setNote("Payments could not be checked. Try again."); }
    finally { setChecking(false); }
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
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{pendingCount ? `${pendingCount} payment${pendingCount === 1 ? "" : "s"} awaiting the network — checked automatically every 30 seconds. Do not send these again.` : "All payments are settled."}</p>
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

type Tab = "receive" | "hold" | "swap" | "send" | "track" | "treasury";
const TABS: Array<{ id: Tab; label: string; icon: typeof Globe2 }> = [
  { id: "receive", label: "Receive", icon: Landmark }, { id: "hold", label: "Hold", icon: Wallet }, { id: "swap", label: "Swap", icon: Repeat },
  { id: "send", label: "Send", icon: ArrowRight }, { id: "track", label: "Track", icon: History }, { id: "treasury", label: "Treasury Vault & Sweeps", icon: Landmark },
];

export function InternationalServices({ initial = "cross-border" }: { initial?: "cross-border" | "remittance" | "crypto" | "swap" | "treasury" | "receive" | "hold" | "track" | "send" }) {
  const { profile, error: profileError, refresh } = useBankingProfile();
  const [tab, setTab] = useState<Tab>(initial === "crypto" || initial === "swap" ? "swap" : initial === "treasury" ? "treasury" : initial === "receive" ? "receive" : initial === "hold" ? "hold" : initial === "track" ? "track" : "send");
  const [kind, setKind] = useState<"cross-border" | "remittance" | "tuition">(initial === "remittance" ? "remittance" : "cross-border");
  const unavailable = <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{profileError || "Your account could not be confirmed. Refresh to try again."}</p>;
  return <section className="space-y-5" aria-label="International services">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">International & Swap</h2><p className="mt-1 text-xs text-muted-foreground">Receive, hold, swap, send and track — {profile ? profile.mode === "live" ? "Live account" : "Sandbox account" : "checking account…"}</p></div>
      <Button variant="outline" size="icon" aria-label="Refresh international services" onClick={() => refresh()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    <div className="flex gap-2 overflow-x-auto border-b border-border pb-4" role="tablist" aria-label="International payment steps">
      {TABS.map((t) => <Button key={t.id} role="tab" aria-selected={tab === t.id} variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}><t.icon />{t.label}</Button>)}
    </div>
    {tab === "receive" ? <ReceiveAccounts />
      : tab === "hold" ? <HoldBalances ngn={profile?.balances["NGN"]} />
      : tab === "swap" ? <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl border border-cyan/40 bg-cyan/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />Live conversion is available for USDT and USDC into naira, with an optional payout to any Nigerian bank. Other currency pairs are not yet available for conversion.</p>
          <CryptoBankFunding balances={profileError ? undefined : profile?.balances} />
        </div>
      : tab === "treasury" ? <TreasuryAutomation />
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
