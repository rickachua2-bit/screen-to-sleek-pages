import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, CheckCircle2, Clock, Download, Loader2, Luggage, Plane, PlaneLanding, PlaneTakeoff, RefreshCw, Search, ShieldCheck, Ticket, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bookFlight, getFlightHealth, getFlightTrips, pollFlights, searchAirports, searchFlights } from "@/lib/flights.functions";
import { CABINS, flightSearch, money, passenger, prettyDuration, type Airport, type Cabin, type FlightOffer, type Passenger } from "@/lib/flights";
import { paymentFeedback } from "@/lib/payment-feedback";
import { useBankingProfile } from "./PaddleConsole";

type Trip = Awaited<ReturnType<typeof getFlightTrips>>[number];
const CABIN_LABEL: Record<Cabin, string> = { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First" };
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const time = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const minutes = (o: FlightOffer) => o.slices.reduce((t, s) => t + (Date.parse(s.arriveAt) - Date.parse(s.departAt)) / 60000, 0);
const blankPax = (): Passenger => ({ title: "mr", givenName: "", familyName: "", bornOn: "", gender: "m", email: "", phone: "", passport: "" });

function AirportField({ label, value, onChange, icon: Icon }: { label: string; value: Airport | null; onChange: (a: Airport) => void; icon: typeof Plane }) {
  const find = useServerFn(searchAirports);
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const [list, setList] = useState<Airport[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return; }
    const t = setTimeout(() => { setBusy(true); setErr(""); find({ data: q }).then(setList).catch(() => setErr("Airport search unavailable")).finally(() => setBusy(false)); }, 300);
    return () => clearTimeout(t);
  }, [q, find]);
  return (
    <div className="relative">
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 focus-within:border-cobalt">
        <Icon className="h-4 w-4 shrink-0 text-cobalt" />
        <input aria-label={label} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Type any city, airport or code (e.g. LHR)" value={open ? q : value ? (value.city ? `${value.city} (${value.code})` : value.code) : ""} onFocus={() => { setOpen(true); setQ(""); }} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); const code = q.trim().toUpperCase(); const hit = list.find((a) => a.code === code) ?? (/^[A-Z]{3}$/.test(code) ? { code, name: code, city: "", country: "" } : list[0]); if (hit) { onChange(hit); setOpen(false); (e.target as HTMLInputElement).blur(); } }} />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && (q.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-border bg-popover p-1 shadow-xl">
          {/^[a-zA-Z]{3}$/.test(q.trim()) && !list.some((a) => a.code === q.trim().toUpperCase()) && <button type="button" onMouseDown={() => { const code = q.trim().toUpperCase(); onChange({ code, name: code, city: "", country: "" }); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"><span className="rounded-lg bg-magenta/10 px-2 py-1 font-mono text-xs font-bold text-magenta">{q.trim().toUpperCase()}</span><span className="text-sm font-semibold">Use code {q.trim().toUpperCase()} — press Enter</span></button>}
          {err ? <p className="p-3 text-xs text-destructive">{err}</p> : !busy && !list.length ? <p className="p-3 text-xs text-muted-foreground">No matches — type a 3-letter city or airport code and press Enter</p> : list.map((a) => (
            <button key={a.code} type="button" onMouseDown={() => { onChange(a); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted">
              <span className="rounded-lg bg-cobalt/10 px-2 py-1 font-mono text-xs font-bold text-cobalt">{a.code}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{a.city || a.name}</span><span className="block truncate text-xs text-muted-foreground">{a.name}{a.country ? ` · ${a.country}` : ""}</span></span>
            </button>))}
        </div>)}
    </div>
  );
}

function OfferCard({ o, onSelect }: { o: FlightOffer; onSelect: () => void }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:border-cobalt/50 hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-44">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cobalt to-cyan font-mono text-xs font-bold text-primary-foreground">{o.airlineCode || <Plane className="h-4 w-4" />}</span>
          <div className="min-w-0"><p className="truncate font-bold">{o.airline || "Airline"}</p><p className="truncate text-xs text-muted-foreground">{o.slices[0]!.segments.map((s) => s.flightNumber).filter(Boolean).join(" · ")}</p></div>
        </div>
        <div className="flex-1 space-y-3">
          {o.slices.map((s, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div><p className="text-lg font-extrabold">{time(s.departAt)}</p><p className="font-mono text-xs text-muted-foreground">{s.from}</p></div>
              <div className="text-center"><p className="text-[11px] text-muted-foreground">{prettyDuration(s.duration) ?? ""}</p><div className="relative my-1 h-px bg-border"><Plane className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-cobalt" /></div><p className={`text-[11px] font-semibold ${s.stops ? "text-magenta" : "text-success"}`}>{s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""} · ${s.segments.slice(0, -1).map((g) => g.to).join(", ")}` : "Non-stop"}</p></div>
              <div className="text-right"><p className="text-lg font-extrabold">{time(s.arriveAt)}</p><p className="font-mono text-xs text-muted-foreground">{s.to}</p></div>
            </div>))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 lg:w-48 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="lg:text-right"><p className="text-xl font-extrabold text-cobalt">{money(o.amount, o.currency)}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground lg:justify-end">{o.baggage && <><Luggage className="h-3 w-3" />{o.baggage}</>}</p></div>
          <Button onClick={onSelect}>Select</Button>
        </div>
      </div>
    </article>
  );
}

export function FlightBooking({ role = "merchant" }: { role?: "merchant" | "personal" }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  const health = useServerFn(getFlightHealth), search = useServerFn(searchFlights), poll = useServerFn(pollFlights), book = useServerFn(bookFlight), trips = useServerFn(getFlightTrips);
  const [tab, setTab] = useState<"search" | "trips">("search");
  const [online, setOnline] = useState<boolean | null>(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [from, setFrom] = useState<Airport | null>(null), [to, setTo] = useState<Airport | null>(null);
  const [depart, setDepart] = useState(inDays(14)), [ret, setRet] = useState(inDays(21));
  const [adults, setAdults] = useState(1), [cabin, setCabin] = useState<Cabin>("economy");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ searchId: string | null; offers: FlightOffer[] } | null>(null);
  const [sort, setSort] = useState<"cheapest" | "fastest" | "earliest">("cheapest"), [nonstop, setNonstop] = useState(false);
  const [picked, setPicked] = useState<FlightOffer | null>(null);
  const [pax, setPax] = useState<Passenger[]>([blankPax()]), [pin, setPin] = useState("");
  const [booking, setBooking] = useState(false), [bookErr, setBookErr] = useState("");
  const key = useRef(""); const seq = useRef(0);
  const [tripList, setTripList] = useState<Trip[] | null>(null), [tripErr, setTripErr] = useState("");

  useEffect(() => { health().then((h) => setOnline(h.online)).catch(() => setOnline(false)); }, [health]);
  const loadTrips = () => { setTripErr(""); trips().then(setTripList).catch(() => setTripErr("Your trips could not be loaded.")); };
  useEffect(() => { if (tab === "trips") loadTrips(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async () => {
    const parsed = flightSearch.safeParse({ origin: from?.code ?? "", destination: to?.code ?? "", departureDate: depart, returnDate: roundTrip ? ret : undefined, adults, cabinClass: cabin });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your search"); return; }
    const n = ++seq.current; setBusy(true); setError(""); setResult(null);
    try {
      let r = await search({ data: parsed.data });
      for (let i = 0; i < 6 && !r.complete && r.searchId && n === seq.current; i++) { await new Promise((ok) => setTimeout(ok, 2500)); r = await poll({ data: r.searchId }); }
      if (n === seq.current) setResult({ searchId: r.searchId, offers: r.offers });
    } catch (e) { if (n === seq.current) setError(e instanceof Error ? e.message : "Flight search is unavailable."); }
    finally { if (n === seq.current) setBusy(false); }
  };

  const shown = useMemo(() => {
    const list = (result?.offers ?? []).filter((o) => !nonstop || o.slices.every((s) => s.stops === 0));
    return [...list].sort((a, b) => sort === "cheapest" ? a.amount - b.amount : sort === "fastest" ? minutes(a) - minutes(b) : Date.parse(a.slices[0]!.departAt) - Date.parse(b.slices[0]!.departAt));
  }, [result, sort, nonstop]);

  const choose = (o: FlightOffer) => { setPicked(o); setBookErr(""); setPin(""); key.current = `FLT-${crypto.randomUUID()}`; setPax(Array.from({ length: adults }, (_, i) => pax[i] ?? blankPax())); };
  const confirm = async () => {
    if (!picked || !result?.searchId || booking) return;
    for (const p of pax) { const v = passenger.safeParse({ ...p, passport: p.passport || undefined }); if (!v.success) { setBookErr(v.error.issues[0]?.message ?? "Check traveller details"); return; } }
    if (live && !/^\d{4}$/.test(pin)) { setBookErr("Enter your 4-digit transaction PIN."); return; }
    setBooking(true); setBookErr("");
    try {
      const r = await book({ data: { searchId: result.searchId, offerId: picked.id, expectedAmount: picked.amount, expectedCurrency: picked.currency, passengers: pax.map((p) => ({ ...p, passport: p.passport || undefined })), pin: pin || undefined, idempotencyKey: key.current } });
      setPin("");
      if (r.status === "succeeded") toast.success(`Ticket issued · PNR ${r.pnr}`);
      else if (r.status === "failed") toast.error("The airline declined this booking. Your reserved funds are released.");
      else toast.message("Booking submitted — awaiting airline confirmation. Funds stay reserved until confirmed.");
      setPicked(null); setTab("trips");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setBookErr(/fare|no longer|expired|verification/i.test(msg) ? msg : paymentFeedback(e, "transfer").replace("Transfer", "Booking"));
    } finally { setBooking(false); }
  };

  const receipt = (t: Trip) => {
    const text = [`Slikpay flight booking`, `Status: ${t.status}`, `PNR: ${t.pnr ?? "pending"}`, `Airline: ${t.airline}`, `Route: ${t.route}`, `Departure: ${date(t.departAt)} ${time(t.departAt)}`, `Travellers: ${t.passengers.join(", ")}`, `E-tickets: ${t.tickets.join(", ") || "pending"}`, `Amount: ${money(t.amount, t.currency)}`, `Reference: ${t.key}`].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = `flight-${t.pnr ?? t.key}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cobalt";

  return (
    <div className="space-y-5">
      <section className="bg-navy-rail relative overflow-hidden rounded-3xl p-6 text-foreground shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan/25 blur-3xl" /><div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-magenta/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan"><Plane className="h-4 w-4" />{role === "personal" ? "Travel" : "Business travel"}</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Fly anywhere, pay from your wallet</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Live fares from global airlines. Tickets are paid from the wallet matching the fare currency, and you're only charged the price you confirm.</p></div>
          <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${online ? "bg-success/20 text-success" : online === false ? "bg-destructive/20 text-foreground" : "bg-foreground/10"}`}><span className={`h-2 w-2 rounded-full ${online ? "bg-success animate-pulse" : online === false ? "bg-destructive" : "bg-muted-foreground"}`} />{online === null ? "Checking airlines…" : online ? "Airlines connected" : "Flight service unavailable"}{profile ? ` · ${profile.mode}` : ""}</span>
        </div>
        <div className="relative mt-5 inline-flex rounded-full bg-foreground/10 p-1">
          {(["search", "trips"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${tab === t ? "bg-background text-cobalt" : "text-foreground"}`}>{t === "search" ? "Search flights" : "My trips"}</button>)}
        </div>
      </section>

      {tab === "search" ? <>
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2">{[false, true].map((r) => <button key={String(r)} onClick={() => setRoundTrip(r)} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${roundTrip === r ? "border-cobalt bg-cobalt/10 text-cobalt" : "border-border"}`}>{r ? "Round trip" : "One way"}</button>)}</div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
            <AirportField label="From" value={from} onChange={setFrom} icon={PlaneTakeoff} />
            <button aria-label="Swap airports" onClick={() => { setFrom(to); setTo(from); }} className="mx-auto grid h-10 w-10 place-items-center self-end rounded-full border border-border bg-background hover:border-cobalt"><ArrowLeftRight className="h-4 w-4 text-cobalt" /></button>
            <AirportField label="To" value={to} onChange={setTo} icon={PlaneLanding} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Depart<input type="date" min={inDays(0)} value={depart} onChange={(e) => setDepart(e.target.value)} className={field} /></label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Return<input type="date" disabled={!roundTrip} min={depart} value={ret} onChange={(e) => setRet(e.target.value)} className={`${field} disabled:opacity-50`} /></label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Travellers<select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={field}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1} adult{i ? "s" : ""}</option>)}</select></label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cabin<select value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)} className={field}>{CABINS.map((c) => <option key={c} value={c}>{CABIN_LABEL[c]}</option>)}</select></label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
          <Button className="mt-4 w-full sm:w-auto" size="lg" onClick={runSearch} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}{busy ? "Searching airlines…" : "Search flights"}</Button>
        </section>

        {busy && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted" />)}</div>}
        {result && !busy && <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{shown.length} flight{shown.length === 1 ? "" : "s"} · {from?.code} → {to?.code}</p>
            <div className="flex flex-wrap gap-2">{(["cheapest", "fastest", "earliest"] as const).map((s) => <button key={s} onClick={() => setSort(s)} className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${sort === s ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-card"}`}>{s}</button>)}<button onClick={() => setNonstop((v) => !v)} className={`rounded-full border px-3 py-1 text-xs font-bold ${nonstop ? "border-magenta bg-magenta/10 text-magenta" : "border-border bg-card"}`}>Non-stop only</button></div>
          </div>
          {shown.length ? shown.map((o) => <OfferCard key={o.id} o={o} onSelect={() => choose(o)} />) : <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center"><Plane className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 font-bold">No flights found</p><p className="text-sm text-muted-foreground">Try other dates, airports or remove filters.</p></div>}
        </section>}
      </> : (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">My trips</h2><Button variant="outline" size="sm" onClick={loadTrips}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button></div>
          {tripErr ? <p className="text-sm text-destructive">{tripErr}</p> : !tripList ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !tripList.length ? <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center"><Ticket className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 font-bold">No bookings yet</p><p className="text-sm text-muted-foreground">Tickets you book appear here with their PNR.</p></div> : tripList.map((t) => (
            <article key={t.key} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cobalt/10 text-cobalt"><Ticket className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-bold">{t.route || "Flight"} · {t.airline}</p><p className="text-xs text-muted-foreground">{date(t.departAt)} {time(t.departAt)} · {t.passengers.join(", ")}</p><p className="mt-1 font-mono text-xs">PNR {t.pnr ?? "awaiting airline"}{t.tickets.length ? ` · e-ticket ${t.tickets.join(", ")}` : ""}</p></div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end"><p className="font-extrabold">{money(t.amount, t.currency)}</p><span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.status === "succeeded" ? "bg-success/15 text-success" : t.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-magenta/15 text-magenta"}`}>{t.status === "succeeded" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{t.status === "succeeded" ? "Ticketed" : t.status === "failed" ? "Declined" : "Pending"}</span><button onClick={() => receipt(t)} className="flex items-center gap-1 text-xs font-bold text-cobalt"><Download className="h-3 w-3" />Receipt</button></div>
            </article>))}
          <p className="text-xs text-muted-foreground">Pending bookings keep funds reserved until the airline confirms. For changes or cancellations, contact support with your reference.</p>
        </section>)}

      {picked && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cobalt">Review & book</p><h3 className="text-xl font-extrabold">{picked.slices.map((s) => `${s.from} → ${s.to}`).join(" · ")}</h3><p className="text-sm text-muted-foreground">{picked.airline} · {date(picked.slices[0]!.departAt)} · {CABIN_LABEL[cabin]}</p></div><button aria-label="Close" onClick={() => !booking && setPicked(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 space-y-4">{pax.map((p, i) => {
            const set = (patch: Partial<Passenger>) => setPax((all) => all.map((x, j) => j === i ? { ...x, ...patch } : x));
            return <fieldset key={i} className="rounded-2xl border border-border p-4"><legend className="flex items-center gap-1 px-1 text-xs font-bold"><Users className="h-3.5 w-3.5" />Traveller {i + 1} · as on passport</legend>
              <div className="grid gap-2 sm:grid-cols-6">
                <select aria-label="Title" value={p.title} onChange={(e) => set({ title: e.target.value as Passenger["title"] })} className={`${field} sm:col-span-1`}>{["mr", "ms", "mrs", "miss", "dr"].map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</select>
                <input aria-label="First name" placeholder="First name" value={p.givenName} onChange={(e) => set({ givenName: e.target.value })} className={`${field} sm:col-span-2`} />
                <input aria-label="Last name" placeholder="Last name" value={p.familyName} onChange={(e) => set({ familyName: e.target.value })} className={`${field} sm:col-span-3`} />
                <label className="text-[11px] font-bold text-muted-foreground sm:col-span-2">Date of birth<input type="date" value={p.bornOn} onChange={(e) => set({ bornOn: e.target.value })} className={field} /></label>
                <label className="text-[11px] font-bold text-muted-foreground sm:col-span-1">Gender<select value={p.gender} onChange={(e) => set({ gender: e.target.value as "m" | "f" })} className={field}><option value="m">Male</option><option value="f">Female</option></select></label>
                <label className="text-[11px] font-bold text-muted-foreground sm:col-span-3">Passport no. (international)<input value={p.passport} onChange={(e) => set({ passport: e.target.value.toUpperCase() })} className={field} /></label>
                <input aria-label="Email" type="email" placeholder="Email" value={p.email} onChange={(e) => set({ email: e.target.value })} className={`${field} sm:col-span-3`} />
                <input aria-label="Phone" placeholder="+2348012345678" value={p.phone} onChange={(e) => set({ phone: e.target.value.replace(/[^\d+]/g, "") })} className={`${field} sm:col-span-3`} />
              </div></fieldset>; })}
          </div>
          <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm"><div className="flex justify-between"><span>Fare for {adults} traveller{adults > 1 ? "s" : ""}</span><span className="font-extrabold">{money(picked.amount, picked.currency)}</span></div><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-success" />Charged from your {picked.currency} wallet. If the airline changes the fare, nothing is charged.</p></div>
          {live && <label className="mt-3 block text-sm font-semibold">Transaction PIN<input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={`${field} font-mono tracking-[0.5em]`} /></label>}
          {bookErr && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{bookErr}</p>}
          <Button className="mt-4 w-full" size="lg" onClick={confirm} disabled={booking}>{booking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Issuing ticket…</> : <>Pay {money(picked.amount, picked.currency)} & book</>}</Button>
        </div>
      </div>}
    </div>
  );
}
