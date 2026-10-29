import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2, CalendarClock, Clock3, Landmark, Loader2, Lock, Pause, Play, PlayCircle, RefreshCw, Repeat, Search, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDirectDebit, createSchedule, deleteSchedule, listDirectDebits, listSchedules, runSchedule, setScheduleActive, DEBIT_CURRENCIES, SCHEDULE_FREQUENCIES, type BillingScheduleView, type DebitCurrency, type DirectDebitView } from "@/lib/mandates.functions";
import type { LinkStatus } from "@/lib/checkout-links.server";
import { useBankingProfile } from "./PaddleConsole";
import hero from "@/assets/direct-debit-hero.jpg";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const STATUS_STYLE: Record<LinkStatus, { label: string; className: string }> = {
  paid: { label: "Collected", className: "border-success/40 bg-success/10 text-success" },
  awaiting: { label: "Processing", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  failed: { label: "Failed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  unknown: { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" },
};

const RAIL_LABEL: Record<DebitCurrency, string> = { USD: "US ACH", EUR: "EU SEPA", GBP: "UK Bacs" };

function CreateDebitCard({ onCreated }: { onCreated: (d: DirectDebitView) => void }) {
  const createFn = useServerFn(createDirectDebit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<DebitCurrency>("USD");
  const [description, setDescription] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const bankValid =
    currency === "USD" ? /^\d{9}$/.test(routingNumber) && /^\d{4,17}$/.test(accountNumber)
    : currency === "EUR" ? /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)
    : /^\d{6}$/.test(sortCode) && /^\d{4,17}$/.test(accountNumber);
  const valid = name.trim().length >= 2 && emailValid && amountValid && bankValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const d = await createFn({
        data: {
          customerName: name.trim(), customerEmail: email.trim(), amount: Number(amount), currency,
          description: description.trim() || undefined,
          routingNumber: currency === "USD" ? routingNumber : undefined,
          accountNumber: currency !== "EUR" ? accountNumber : undefined,
          iban: currency === "EUR" ? iban : undefined,
          sortCode: currency === "GBP" ? sortCode : undefined,
          reference: `SLKDD-${crypto.randomUUID()}`,
        },
      });
      toast.success(`Debit of ${money(d.amount, d.currency)} started`);
      setName(""); setEmail(""); setAmount(""); setDescription(""); setRoutingNumber(""); setAccountNumber(""); setIban(""); setSortCode("");
      onCreated(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This debit could not be started. Check the details and try again.");
    } finally { setBusy(false); }
  };

  return <form className="rounded-2xl border border-border bg-card p-5 shadow-sm" onSubmit={(e) => void submit(e)} aria-label="Collect a direct debit">
    <h3 className="font-bold">Collect a direct debit</h3>
    <p className="mt-0.5 text-xs text-muted-foreground">Pull a payment straight from your customer's bank — US ACH, EU SEPA or UK Bacs. Only collect from customers who have authorised you.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="dd-name">Customer name</Label>
        <Input id="dd-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Johnathan Edwards" autoComplete="off" required />
      </div>
      <div className="space-y-1.5"><Label htmlFor="dd-email">Customer email</Label>
        <Input id="dd-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="customer@domain.com" autoComplete="off" required />
      </div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5"><Label htmlFor="dd-amount">Amount</Label>
        <Input id="dd-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" required className="h-11 text-lg font-bold tabular-nums" />
      </div>
      <div className="space-y-1.5"><Label id="dd-currency-label">Rail & currency</Label>
        <div className="flex gap-1.5" role="group" aria-labelledby="dd-currency-label">
          {DEBIT_CURRENCIES.map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}
            className={`h-11 rounded-lg border px-3 text-xs font-bold transition-colors ${currency === c ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>
            {c}<span className="ml-1 hidden font-normal opacity-70 sm:inline">{RAIL_LABEL[c]}</span>
          </button>)}
        </div>
      </div>
    </div>
    {currency === "USD" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="dd-routing">Routing number</Label>
        <Input id="dd-routing" inputMode="numeric" value={routingNumber} maxLength={9} onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ""))} placeholder="021000021" autoComplete="off" required className="font-mono" />
      </div>
      <div className="space-y-1.5"><Label htmlFor="dd-account">Account number</Label>
        <Input id="dd-account" inputMode="numeric" value={accountNumber} maxLength={17} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0284719283" autoComplete="off" required className="font-mono" />
      </div>
    </div>}
    {currency === "EUR" && <div className="mt-3 space-y-1.5"><Label htmlFor="dd-iban">Customer IBAN</Label>
      <Input id="dd-iban" value={iban} maxLength={34} onChange={(e) => setIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="DE89370400440532013000" autoComplete="off" required className="font-mono" />
    </div>}
    {currency === "GBP" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="dd-sort">Sort code</Label>
        <Input id="dd-sort" inputMode="numeric" value={sortCode} maxLength={6} onChange={(e) => setSortCode(e.target.value.replace(/\D/g, ""))} placeholder="200000" autoComplete="off" required className="font-mono" />
      </div>
      <div className="space-y-1.5"><Label htmlFor="dd-account-uk">Account number</Label>
        <Input id="dd-account-uk" inputMode="numeric" value={accountNumber} maxLength={17} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0284719283" autoComplete="off" required className="font-mono" />
      </div>
    </div>}
    <div className="mt-3 space-y-1.5"><Label htmlFor="dd-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
      <Input id="dd-desc" value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} placeholder="October subscription" autoComplete="off" />
    </div>
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    <Button type="submit" variant="brand" className="mt-4 w-full" disabled={!valid || busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}{busy ? "Starting debit…" : "Collect now"}
    </Button>
    <p className="mt-2 text-center text-[11px] text-muted-foreground">The debit is sent to the banking network immediately and its status is tracked live.</p>
  </form>;
}

function DebitRow({ d }: { d: DirectDebitView }) {
  const st = STATUS_STYLE[d.status];
  return <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cobalt/10"><Building2 className="h-4 w-4 text-cobalt" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{d.customerName} <span className="font-normal text-muted-foreground">· {d.accountHint}</span></p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{d.reference}{d.description ? ` · ${d.description}` : ""}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <p className="text-sm font-extrabold tabular-nums">{money(d.amount, d.currency)}</p>
      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
    </div>
  </li>;
}

const TABS = [
  { id: "debits", label: "Direct debits", icon: Landmark },
  { id: "schedules", label: "Billing schedules", icon: CalendarClock },
] as const;

export function DirectDebits({ preview }: { preview?: { debits: DirectDebitView[] } }) {
  const listFn = useServerFn(listDirectDebits);
  const { profile } = useBankingProfile();
  const [tab, setTab] = useState<"debits" | "schedules">("debits");
  const [debits, setDebits] = useState<DirectDebitView[] | null>(preview?.debits ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError("");
    try { const r = await listFn(); setDebits(r.debits); }
    catch (e) { setError(e instanceof Error ? e.message : "Your direct debits could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn, preview]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = debits ?? [];
    return q ? all.filter((d) => `${d.customerName} ${d.customerEmail} ${d.reference} ${d.description}`.toLowerCase().includes(q)) : all;
  }, [debits, search]);

  const collected = (debits ?? []).filter((d) => d.status === "paid");
  const processing = (debits ?? []).filter((d) => d.status === "awaiting");
  const collectedTotal = collected.reduce((s, d) => s + d.amount, 0);

  return <section className="transfer-center collections-composer space-y-5" aria-label="Direct debits">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Direct debits</h2>
      <p className="mt-1 text-sm text-muted-foreground">{profile ? (profile.mode === "live" ? "Live account" : "Sandbox account") : "Checking account…"} · pull payments from customer banks in the US, EU and UK</p>
    </div>
    <div className="transfer-composer-layout">
      <aside className="transfer-story">
        <span className="transfer-eyebrow"><Repeat className="h-4 w-4" />BANK COLLECTIONS</span>
        <h2>Collect on<br /><span>autopilot.</span></h2>
        <p className="crypto-story-description">Debit your customers' bank accounts directly over ACH, SEPA and Bacs — no cards, no expiry dates, no failed renewals from lost cards.</p>
        <img src={hero} alt="A glowing bank connected to a recurring payment coin" width={1152} height={640} className="collections-hero" loading="lazy" />
        <ol className="crypto-stages">{[
          ["Get authorisation", "Your customer agrees to the debit — keep their consent on file."],
          ["Start the debit", "Enter their bank details once; the network pulls the funds."],
          ["Track it live", "Every debit is verified against the banking network in real time."],
        ].map(([title, detail], i) => <li key={title}><span className="crypto-stage-number">{i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}
        </ol>
        <p className="crypto-story-security"><Lock className="h-3.5 w-3.5" />ACH · SEPA · Bacs · Live status checks</p>
      </aside>

      <section className="transfer-composer space-y-4" aria-label="Direct debits workspace">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Direct debit sections">
          {TABS.map((t) => <Button key={t.id} variant={tab === t.id ? "default" : "outline"} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}><t.icon />{t.label}</Button>)}
        </div>

        {tab === "schedules" && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-magenta/10"><CalendarClock className="h-6 w-6 text-magenta" /></span>
          <h3 className="mt-4 font-bold">Recurring schedules are not connected yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Automatic weekly or monthly debits will appear here once the scheduling service is available. Until then, start each debit from the Direct debits tab — nothing is charged automatically.</p>
        </div>}

        {tab === "debits" && <>
          <CreateDebitCard onCreated={(d) => setDebits((prev) => (prev ? [d, ...prev] : prev))} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Collected</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{debits ? collected.length : "—"}</p>
              {collectedTotal > 0 && <p className="text-[11px] text-muted-foreground tabular-nums">{collectedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} across currencies</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-cyan" />Processing</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{debits ? processing.length : "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Wallet className="h-3.5 w-3.5 text-magenta" />Total debits</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{debits?.length ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer, reference or description" aria-label="Search direct debits"
                className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh direct debits" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
          </div>

          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          {loading && !debits && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your debits…</p>}

          {debits && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10"><Landmark className="h-6 w-6 text-cobalt" /></span>
            <h3 className="mt-4 font-bold">{debits.length ? "No debits match your search" : "No direct debits yet"}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{debits.length ? "Try a different customer or reference." : "Start your first collection above — funds are pulled straight from your customer's bank."}</p>
          </div>}

          <ul className="space-y-2">
            {filtered.map((d) => <DebitRow key={d.reference} d={d} />)}
          </ul>
        </>}
      </section>
    </div>
  </section>;
}
