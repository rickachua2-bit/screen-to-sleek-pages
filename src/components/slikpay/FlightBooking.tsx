import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { 
  AlertCircle, ArrowLeftRight, Check, CheckCircle2, Clock, 
  Coins, Copy, DollarSign, Download, Globe, Info, Loader2, 
  Luggage, Plane, PlaneLanding, PlaneTakeoff, Printer, QrCode, 
  RefreshCw, Search, ShieldCheck, Sparkles, Ticket, Users, 
  Utensils, Wallet, Wifi, X, Zap 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bookFlight, getFlightHealth, getFlightTrips, pollFlights, searchAirports, searchFlights } from "@/lib/flights.functions";
import { CABINS, flightSearch, money, passenger, prettyDuration, type Airport, type Cabin, type FlightOffer, type Passenger } from "@/lib/flights";
import { useLivePricing } from "@/lib/live-pricing";
import { quoteSwap, type FxRates } from "@/lib/pricing";
import { paymentFeedback } from "@/lib/payment-feedback";
import { useBankingProfile } from "./PaddleConsole";

type Trip = Awaited<ReturnType<typeof getFlightTrips>>[number];
const CABIN_LABEL: Record<Cabin, string> = { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First" };
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const time = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const minutes = (o: FlightOffer) => o.slices.reduce((t, s) => t + (Date.parse(s.arriveAt) - Date.parse(s.departAt)) / 60000, 0);
const blankPax = (): Passenger => ({ title: "mr", givenName: "", familyName: "", bornOn: "", gender: "m", email: "", phone: "", passport: "" });

export const POPULAR_AIRPORTS: (Airport & { flag: string })[] = [
  { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria", flag: "🇳🇬" },
  { code: "ABV", name: "Nnamdi Azikiwe Intl", city: "Abuja", country: "Nigeria", flag: "🇳🇬" },
  { code: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom", flag: "🇬🇧" },
  { code: "DXB", name: "Dubai International", city: "Dubai", country: "United Arab Emirates", flag: "🇦🇪" },
  { code: "JFK", name: "John F. Kennedy Intl", city: "New York", country: "United States", flag: "🇺🇸" },
  { code: "ACC", name: "Kotoka International", city: "Accra", country: "Ghana", flag: "🇬🇭" },
  { code: "KGL", name: "Kigali International", city: "Kigali", country: "Rwanda", flag: "🇷🇼" },
  { code: "NBO", name: "Jomo Kenyatta Intl", city: "Nairobi", country: "Kenya", flag: "🇰🇪" },
  { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", flag: "🇫🇷" },
  { code: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "Canada", flag: "🇨🇦" },
  { code: "JNB", name: "O.R. Tambo Intl", city: "Johannesburg", country: "South Africa", flag: "🇿🇦" },
];

export const POPULAR_ROUTES = [
  { from: { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria" }, to: { code: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom" }, label: "Lagos ⇄ London" },
  { from: { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria" }, to: { code: "ABV", name: "Nnamdi Azikiwe Intl", city: "Abuja", country: "Nigeria" }, label: "Lagos ⇄ Abuja" },
  { from: { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria" }, to: { code: "DXB", name: "Dubai International", city: "Dubai", country: "United Arab Emirates" }, label: "Lagos ⇄ Dubai" },
  { from: { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria" }, to: { code: "ACC", name: "Kotoka International", city: "Accra", country: "Ghana" }, label: "Lagos ⇄ Accra" },
  { from: { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria" }, to: { code: "JFK", name: "John F. Kennedy Intl", city: "New York", country: "United States" }, label: "Lagos ⇄ New York" },
  { from: { code: "ABV", name: "Nnamdi Azikiwe Intl", city: "Abuja", country: "Nigeria" }, to: { code: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom" }, label: "Abuja ⇄ London" },
];

export const SUPPORTED_CURRENCIES = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", category: "Naira", flag: "🇳🇬" },
  { code: "USD", name: "US Dollar", symbol: "$", category: "Fiat", flag: "🇺🇸" },
  { code: "GBP", name: "British Pound", symbol: "£", category: "Fiat", flag: "🇬🇧" },
  { code: "EUR", name: "Euro", symbol: "€", category: "Fiat", flag: "🇪🇺" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", category: "Fiat", flag: "🇨🇦" },
  { code: "USDT", name: "Tether USD", symbol: "₮", category: "Crypto", flag: "🪙" },
  { code: "USDC", name: "USD Coin", symbol: "USDC", category: "Crypto", flag: "🪙" },
  { code: "BTC", name: "Bitcoin", symbol: "₿", category: "Crypto", flag: "🪙" },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", category: "Crypto", flag: "🪙" },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]["code"];

const FALLBACK_RATES: Record<string, number> = {
  NGN: 1,
  USD: 1580,
  USDT: 1585,
  USDC: 1585,
  EUR: 1720,
  GBP: 2020,
  CAD: 1150,
  BTC: 105000000,
  ETH: 5200000,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string, fx: FxRates | null): { amount: number; rate: number } {
  const f = fromCurr.toUpperCase();
  const t = toCurr.toUpperCase();
  if (f === t) return { amount, rate: 1 };

  if (fx) {
    const quoted = quoteSwap(f, t, amount, fx);
    if (quoted && quoted.amount > 0) return quoted;
  }

  // Institutional fallback calculation via NGN bridge
  const fNgn = FALLBACK_RATES[f] ?? 1580;
  const tNgn = FALLBACK_RATES[t] ?? 1;
  const amountInNgn = amount * fNgn;
  const converted = amountInNgn / tNgn;
  const rate = converted / amount;
  return { amount: converted, rate };
}

function formatPriceWithSymbol(amount: number, currency: string) {
  const curr = currency.toUpperCase();
  if (curr === "NGN") {
    return `₦${Math.round(amount).toLocaleString("en-NG")}`;
  }
  if (curr === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (curr === "USDT" || curr === "USDC") {
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  }
  if (curr === "GBP") {
    return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (curr === "EUR") {
    return `€${amount.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (curr === "CAD") {
    return `C$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (curr === "BTC") {
    return `₿${amount.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  }
  if (curr === "ETH") {
    return `Ξ${amount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 5 })}`;
  }
  return `${curr} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function AirportField({ label, value, onChange, icon: Icon }: { label: string; value: Airport | null; onChange: (a: Airport) => void; icon: typeof Plane }) {
  const find = useServerFn(searchAirports);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Airport[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { 
      setList([]); 
      return; 
    }
    const t = setTimeout(() => { 
      setBusy(true); 
      setErr(""); 
      find({ data: q }).then(setList).catch(() => setErr("Airport search unavailable")).finally(() => setBusy(false)); 
    }, 250);
    return () => clearTimeout(t);
  }, [q, find]);

  const displayList = q.trim().length >= 2 ? list : POPULAR_AIRPORTS;

  return (
    <div className="relative">
      <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-3 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 focus-within:border-cobalt focus-within:ring-4 focus-within:ring-cobalt/15 transition-all shadow-sm">
        <Icon className="h-5 w-5 shrink-0 text-cobalt" />
        <input 
          aria-label={label} 
          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 placeholder:font-normal" 
          placeholder="Type city, airport name, or 3-letter IATA (e.g. LHR)" 
          value={open ? q : value ? (value.city ? `${value.city} (${value.code})` : value.code) : ""} 
          onFocus={() => { setOpen(true); setQ(""); }} 
          onBlur={() => setTimeout(() => setOpen(false), 250)} 
          onChange={(e) => setQ(e.target.value)} 
          onKeyDown={(e) => { 
            if (e.key !== "Enter") return; 
            e.preventDefault(); 
            const code = q.trim().toUpperCase(); 
            const hit = list.find((a) => a.code === code) ?? (/^[A-Z]{3}$/.test(code) ? { code, name: code, city: "", country: "" } : list[0]); 
            if (hit) { onChange(hit); setOpen(false); (e.target as HTMLInputElement).blur(); } 
          }} 
        />
        {busy && <Loader2 className="h-5 w-5 animate-spin text-cobalt shrink-0" />}
      </div>

      {/* Luminous, High-Visibility Popover Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 w-full min-w-[320px] sm:min-w-[420px] overflow-y-auto rounded-3xl border-2 border-cobalt/40 bg-white dark:bg-slate-900 p-2 shadow-2xl backdrop-blur-xl">
          {q.trim().length < 2 && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-cobalt flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> Popular Flight Hubs
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Click to select</span>
            </div>
          )}

          {/^[a-zA-Z]{3}$/.test(q.trim()) && !list.some((a) => a.code === q.trim().toUpperCase()) && (
            <button 
              type="button" 
              onMouseDown={() => { const code = q.trim().toUpperCase(); onChange({ code, name: code, city: "", country: "" }); setOpen(false); }} 
              className="flex w-full items-center gap-3 rounded-2xl p-3 text-left bg-cobalt/10 hover:bg-cobalt/20 transition-all border border-cobalt/30 my-1"
            >
              <span className="rounded-xl bg-cobalt px-3 py-1 font-mono text-xs font-black text-white shadow-sm">{q.trim().toUpperCase()}</span>
              <div>
                <span className="block text-sm font-black text-slate-900 dark:text-white">Use IATA Code "{q.trim().toUpperCase()}"</span>
                <span className="block text-xs text-slate-500">Press Enter or click to search this specific airport</span>
              </div>
            </button>
          )}

          {err ? (
            <div className="p-4 text-center text-xs font-bold text-destructive">{err}</div>
          ) : !busy && q.trim().length >= 2 && !list.length ? (
            <div className="p-5 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl m-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">No airports match "{q}"</p>
              <p className="text-xs text-slate-500 mt-1">Type any 3-letter IATA code directly (e.g. DOH, FRA, DXB) to select</p>
            </div>
          ) : (
            <div className="space-y-1 mt-1">
              {displayList.map((a) => (
                <button 
                  key={a.code} 
                  type="button" 
                  onMouseDown={() => { onChange(a); setOpen(false); }} 
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <span className="rounded-xl bg-cobalt/15 group-hover:bg-cobalt px-2.5 py-1.5 font-mono text-xs font-black text-cobalt group-hover:text-white transition-colors flex items-center gap-1.5 shrink-0 shadow-xs">
                    {"flag" in a ? <span className="text-sm">{(a as any).flag}</span> : null}
                    {a.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-cobalt transition-colors">
                      {a.city || a.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {a.name}{a.country ? ` · ${a.country}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OfferCard({ 
  o, 
  onSelect, 
  currency, 
  fx 
}: { 
  o: FlightOffer; 
  onSelect: () => void; 
  currency: SupportedCurrency; 
  fx: FxRates | null;
}) {
  const isDirect = o.slices.every((s) => s.stops === 0);
  const converted = convertCurrency(o.amount, o.currency, currency, fx);
  const displayPrice = formatPriceWithSymbol(converted.amount, currency);
  const originalPrice = `${o.currency} ${o.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isConverted = currency.toUpperCase() !== o.currency.toUpperCase();

  return (
    <article className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm transition hover:border-cobalt hover:shadow-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Carrier Info */}
        <div className="flex items-center gap-3 lg:w-48">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cobalt via-navy-light to-cyan font-mono text-xs font-black text-white shadow-md">
            {o.airlineCode || <Plane className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-extrabold text-foreground text-sm sm:text-base">{o.airline || "Airline Partner"}</p>
            <p className="truncate text-xs font-mono text-muted-foreground">
              {o.slices[0]!.segments.map((s) => s.flightNumber).filter(Boolean).join(" · ") || "NDC Wholesale"}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Wifi className="h-2.5 w-2.5 text-cyan" /> Wi-Fi
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Utensils className="h-2.5 w-2.5 text-amber-500" /> Meal
              </span>
            </div>
          </div>
        </div>

        {/* Flight Segments / Timetable */}
        <div className="flex-1 space-y-3">
          {o.slices.map((s, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5">
              <div>
                <p className="text-lg sm:text-2xl font-black text-foreground">{time(s.departAt)}</p>
                <p className="font-mono text-xs font-bold text-muted-foreground">{s.from} {s.fromCity ? `(${s.fromCity})` : ""}</p>
              </div>
              <div className="text-center px-2">
                <p className="text-[11px] font-bold text-muted-foreground">{prettyDuration(s.duration) ?? "Direct"}</p>
                <div className="relative my-1.5 h-0.5 bg-border">
                  <Plane className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-cobalt transition-transform hover:scale-125" />
                </div>
                <p className={`text-[11px] font-black ${s.stops ? "text-magenta" : "text-emerald-500"}`}>
                  {s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""} · ${s.segments.slice(0, -1).map((g) => g.to).join(", ")}` : "Non-stop direct"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg sm:text-2xl font-black text-foreground">{time(s.arriveAt)}</p>
                <p className="font-mono text-xs font-bold text-muted-foreground">{s.to} {s.toCity ? `(${s.toCity})` : ""}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic Multi-Currency Price & Book Action */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 lg:w-56 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="lg:text-right">
            <p className="text-xl sm:text-2xl font-black text-cobalt tracking-tight">{displayPrice}</p>
            {isConverted && (
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Base fare: {originalPrice}
              </p>
            )}
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground lg:justify-end mt-1">
              <Luggage className="h-3 w-3 text-cyan" />
              {o.baggage ? o.baggage : "Standard baggage included"}
            </p>
            {isDirect && (
              <span className="hidden sm:inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-500 mt-1">
                ⚡ Fastest Choice
              </span>
            )}
          </div>
          <Button onClick={onSelect} className="shadow-md hover:shadow-lg transition-all font-black px-5 py-2.5 rounded-xl">
            Select Flight
          </Button>
        </div>
      </div>
    </article>
  );
}

export function FlightBooking({ role = "merchant" }: { role?: "merchant" | "personal" }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  const { rates: liveRates } = useLivePricing();

  const health = useServerFn(getFlightHealth);
  const search = useServerFn(searchFlights);
  const poll = useServerFn(pollFlights);
  const book = useServerFn(bookFlight);
  const trips = useServerFn(getFlightTrips);

  const [tab, setTab] = useState<"search" | "trips">("search");
  const [online, setOnline] = useState<boolean | null>(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [from, setFrom] = useState<Airport | null>(POPULAR_AIRPORTS[0]); // default Lagos
  const [to, setTo] = useState<Airport | null>(POPULAR_AIRPORTS[2]);     // default London
  const [depart, setDepart] = useState(inDays(14)), [ret, setRet] = useState(inDays(21));
  const [adults, setAdults] = useState(1), [cabin, setCabin] = useState<Cabin>("economy");
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("NGN");
  const [paymentWalletCurrency, setPaymentWalletCurrency] = useState<SupportedCurrency>("NGN");
  const [searchLatencyMs, setSearchLatencyMs] = useState<number | null>(null);

  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ searchId: string | null; offers: FlightOffer[] } | null>(null);
  const [sort, setSort] = useState<"cheapest" | "fastest" | "earliest">("cheapest");
  const [nonstop, setNonstop] = useState(false);
  const [picked, setPicked] = useState<FlightOffer | null>(null);
  const [pax, setPax] = useState<Passenger[]>([blankPax()]);
  const [pin, setPin] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState("");
  const [viewTicket, setViewTicket] = useState<Trip | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const key = useRef(""); 
  const seq = useRef(0);
  const [tripList, setTripList] = useState<Trip[] | null>(null);
  const [tripErr, setTripErr] = useState("");

  useEffect(() => { 
    health().then((h) => setOnline(h.online)).catch(() => setOnline(false)); 
  }, [health]);

  const loadTrips = () => { 
    setTripErr(""); 
    trips().then(setTripList).catch(() => setTripErr("Your trips could not be loaded.")); 
  };
  
  useEffect(() => { 
    if (tab === "trips") loadTrips(); 
  }, [tab]);

  // Millisecond Flight Search Execution consuming PaddleBaas
  const runSearch = async () => {
    const parsed = flightSearch.safeParse({ 
      origin: from?.code ?? "", 
      destination: to?.code ?? "", 
      departureDate: depart, 
      returnDate: roundTrip ? ret : undefined, 
      adults, 
      cabinClass: cabin 
    });
    if (!parsed.success) { 
      setError(parsed.error.issues[0]?.message ?? "Check your search"); 
      return; 
    }
    const n = ++seq.current; 
    setBusy(true); 
    setError(""); 
    setResult(null);
    setSearchLatencyMs(null);
    const startTime = performance.now();

    try {
      // First round-trip directly queries PaddleBaas flight engine
      let r = await search({ data: parsed.data });
      const elapsed = Math.round(performance.now() - startTime);

      // Instant Pop: if offers returned directly, populate immediately in milliseconds!
      if (r.offers && r.offers.length > 0) {
        if (n === seq.current) {
          setResult({ searchId: r.searchId, offers: r.offers });
          setSearchLatencyMs(elapsed);
          setBusy(false);
        }
        return;
      }

      // Fast polling only if initial response is awaiting NDC aggregation
      for (let i = 0; i < 4 && !r.complete && r.searchId && n === seq.current; i++) { 
        await new Promise((ok) => setTimeout(ok, 600)); 
        r = await poll({ data: r.searchId }); 
        if (r.offers && r.offers.length > 0) {
          if (n === seq.current) {
            setResult({ searchId: r.searchId, offers: r.offers });
            setSearchLatencyMs(Math.round(performance.now() - startTime));
            setBusy(false);
          }
          return;
        }
      }
      if (n === seq.current) {
        setResult({ searchId: r.searchId, offers: r.offers });
        setSearchLatencyMs(Math.round(performance.now() - startTime));
      }
    } catch (e) { 
      if (n === seq.current) setError(e instanceof Error ? e.message : "Flight search is unavailable."); 
    } finally { 
      if (n === seq.current) setBusy(false); 
    }
  };

  const shown = useMemo(() => {
    const list = (result?.offers ?? []).filter((o) => !nonstop || o.slices.every((s) => s.stops === 0));
    return [...list].sort((a, b) => {
      if (sort === "cheapest") {
        const aConv = convertCurrency(a.amount, a.currency, selectedCurrency, liveRates).amount;
        const bConv = convertCurrency(b.amount, b.currency, selectedCurrency, liveRates).amount;
        return aConv - bConv;
      }
      if (sort === "fastest") return minutes(a) - minutes(b);
      return Date.parse(a.slices[0]!.departAt) - Date.parse(b.slices[0]!.departAt);
    });
  }, [result, sort, nonstop, selectedCurrency, liveRates]);

  const choose = (o: FlightOffer) => { 
    setPicked(o); 
    setBookErr(""); 
    setPin(""); 
    setPaymentWalletCurrency(selectedCurrency);
    key.current = `FLT-${crypto.randomUUID()}`; 
    setPax(Array.from({ length: adults }, (_, i) => pax[i] ?? blankPax())); 
  };

  const autofillPrimaryTraveller = () => {
    if (!profile) return;
    const parts = (profile.companyName || "").split(" ");
    setPax((all) => all.map((x, j) => j === 0 ? {
      ...x,
      givenName: x.givenName || parts[0] || "",
      familyName: x.familyName || parts.slice(1).join(" ") || "",
      email: x.email || profile.email || "",
      phone: x.phone || profile.phone || "",
    } : x));
    toast.info("Autofilled traveller 1 with profile credentials");
  };

  const confirm = async () => {
    if (!picked || !result?.searchId || booking) return;
    for (const p of pax) { 
      const v = passenger.safeParse({ ...p, passport: p.passport || undefined }); 
      if (!v.success) { 
        setBookErr(v.error.issues[0]?.message ?? "Check traveller details"); 
        return; 
      } 
    }
    if (live && !/^\d{4}$/.test(pin)) { 
      setBookErr("Enter your 4-digit transaction PIN to authorize debit from your wallet."); 
      return; 
    }

    const debitQuote = convertCurrency(picked.amount, picked.currency, paymentWalletCurrency, liveRates);
    const expectedDebit = Math.round(debitQuote.amount * 100) / 100;

    setBooking(true); 
    setBookErr("");
    try {
      const r = await book({ 
        data: { 
          searchId: result.searchId, 
          offerId: picked.id, 
          expectedAmount: picked.amount, 
          expectedCurrency: picked.currency, 
          paymentCurrency: paymentWalletCurrency,
          expectedDebitAmount: expectedDebit,
          passengers: pax.map((p) => ({ ...p, passport: p.passport || undefined })), 
          pin: pin || undefined, 
          idempotencyKey: key.current 
        } 
      });
      setPin("");
      if (r.status === "succeeded") {
        toast.success(`E-Ticket issued successfully! Booking reference (PNR): ${r.pnr}`);
      } else if (r.status === "failed") {
        toast.error("The airline declined this booking. Your reserved funds were immediately released.");
      } else {
        toast.message("Booking submitted — awaiting airline confirmation. Funds stay reserved until confirmed.");
      }
      setPicked(null); 
      setTab("trips");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setBookErr(/fare|no longer|expired|verification/i.test(msg) ? msg : paymentFeedback(e, "transfer").replace("Transfer", "Booking"));
    } finally { 
      setBooking(false); 
    }
  };

  const downloadTextReceipt = (t: Trip) => {
    const text = [
      `======================================================`,
      `          SLIKPAY GLOBAL NDC TRAVEL RECEIPT           `,
      `======================================================`,
      `PNR (Booking Ref): ${t.pnr ?? "PENDING AIRLINE"}`,
      `Ticket Status:    ${t.status.toUpperCase()}`,
      `Airline:          ${t.airline}`,
      `Flight Route:     ${t.route}`,
      `Departure Date:   ${date(t.departAt)} at ${time(t.departAt)}`,
      `Travellers:       ${t.passengers.join(", ")}`,
      `E-Ticket Numbers: ${t.tickets.join(", ") || "PENDING ISSUANCE"}`,
      `Total Paid:       ${money(t.amount, t.currency)}`,
      `Settled From:     ${t.currency} Multi-Rail Balance`,
      `System Ref:       ${t.key}`,
      `Issued via:       Slikpay Global Aviation & NDC Engine`,
      `======================================================`,
      `IATA 24H Rule: Voidable within 24 hours of ticketing.`,
      `24/7 Global Support: support@slikpay.online`,
      `======================================================`,
    ].join("\n");
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); 
    a.download = `slikpay-ticket-${t.pnr ?? t.key}.txt`; 
    a.click(); 
    URL.revokeObjectURL(a.href);
  };

  const copyPNR = (pnr: string) => {
    navigator.clipboard.writeText(pnr);
    setCopiedKey(pnr);
    toast.success(`PNR ${pnr} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const field = "mt-1.5 w-full rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-cobalt focus:ring-4 focus:ring-cobalt/15 transition-all";

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="bg-navy-rail relative overflow-hidden rounded-3xl p-6 text-foreground shadow-xl sm:p-8 border border-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-magenta/15 blur-3xl" />
        
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 rounded-full bg-cyan/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan border border-cyan/30">
                <Plane className="h-3.5 w-3.5" />
                {role === "personal" ? "Global Flights" : "Corporate Air Travel"}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-magenta/15 px-2.5 py-1 text-[11px] font-bold text-magenta border border-magenta/25">
                <Sparkles className="h-3 w-3" /> Real-Time PaddleBaas NDC Engine
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/25">
                <Coins className="h-3 w-3" /> Multi-Currency: Naira · Fiat · Crypto
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl text-white">
              Fly Anywhere, Pay With Any Balance
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Live NDC airline inventory with wholesale pricing. Pay seamlessly from your Nigerian Naira, International Fiat (USD, GBP, EUR), or Crypto vaults (USDT, USDC) with zero foreign transaction fees.
            </p>
          </div>

          <span className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold border ${
            online ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : 
            online === false ? "bg-destructive/20 text-red-200 border-destructive/40" : 
            "bg-foreground/10 text-slate-300 border-white/10"
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : online === false ? "bg-destructive" : "bg-muted-foreground"}`} />
            {online === null ? "Connecting to NDC Rail…" : online ? "500+ Airlines Online" : "Service Offline"}
            {profile ? ` · ${profile.mode.toUpperCase()}` : ""}
          </span>
        </div>

        {/* Tab switcher */}
        <div className="relative mt-6 inline-flex rounded-2xl bg-white/10 p-1 backdrop-blur-md border border-white/10">
          {(["search", "trips"] as const).map((t) => (
            <button 
              key={t} 
              onClick={() => setTab(t)} 
              className={`rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                tab === t ? "bg-white text-navy shadow-md font-extrabold" : "text-slate-300 hover:text-white"
              }`}
            >
              {t === "search" ? "Search & Book Flights" : "My Trips & Boarding Passes"}
            </button>
          ))}
        </div>
      </section>

      {tab === "search" ? (
        <>
          {/* Currency Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-cobalt flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-cobalt" /> View Fares In:
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                (Live rates from PaddleBaas FX)
              </span>
            </div>

            {/* Currency Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCurrency(c.code as SupportedCurrency)}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCurrency === c.code
                      ? "bg-cobalt text-white shadow-sm font-black scale-105"
                      : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.code}</span>
                  <span className="opacity-75 font-normal">({c.symbol})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Route Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Popular:
            </span>
            {POPULAR_ROUTES.map((route, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFrom(route.from);
                  setTo(route.to);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  from?.code === route.from.code && to?.code === route.to.code
                    ? "border-cobalt bg-cobalt/15 text-cobalt font-bold"
                    : "border-border bg-card hover:border-cobalt/50 text-foreground"
                }`}
              >
                <span>{route.label}</span>
              </button>
            ))}
          </div>

          {/* Search Controls */}
          <section className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex flex-wrap gap-2">
                {[false, true].map((r) => (
                  <button 
                    key={String(r)} 
                    onClick={() => setRoundTrip(r)} 
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                      roundTrip === r ? "border-cobalt bg-cobalt/10 text-cobalt" : "border-border text-muted-foreground hover:border-muted"
                    }`}
                  >
                    {r ? "Round Trip" : "One Way"}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Live PaddleBaas Wholesale Fares (Guaranteed Zero Slippage)
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
              <AirportField label="Departure Airport" value={from} onChange={setFrom} icon={PlaneTakeoff} />
              <button 
                aria-label="Swap airports" 
                onClick={() => { const temp = from; setFrom(to); setTo(temp); }} 
                className="mx-auto grid h-11 w-11 place-items-center self-end rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cobalt hover:bg-cobalt/10 transition-all shadow-sm"
              >
                <ArrowLeftRight className="h-5 w-5 text-cobalt" />
              </button>
              <AirportField label="Destination Airport" value={to} onChange={setTo} icon={PlaneLanding} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Departure Date
                </label>
                <input 
                  type="date" 
                  min={inDays(0)} 
                  value={depart} 
                  onChange={(e) => setDepart(e.target.value)} 
                  className={field} 
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Return Date
                </label>
                <input 
                  type="date" 
                  disabled={!roundTrip} 
                  min={depart} 
                  value={ret} 
                  onChange={(e) => setRet(e.target.value)} 
                  className={`${field} disabled:opacity-40 disabled:cursor-not-allowed`} 
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Passengers
                </label>
                <select 
                  value={adults} 
                  onChange={(e) => setAdults(Number(e.target.value))} 
                  className={field}
                >
                  {Array.from({ length: 9 }, (_, i) => (
                    <option key={i} value={i + 1}>{i + 1} Adult{i ? "s" : ""} (Age 12+)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Cabin Class
                </label>
                <select 
                  value={cabin} 
                  onChange={(e) => setCabin(e.target.value as Cabin)} 
                  className={field}
                >
                  {CABINS.map((c) => (
                    <option key={c} value={c}>{CABIN_LABEL[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button 
              className="mt-2 w-full sm:w-auto px-8 py-6 text-base font-black shadow-md hover:shadow-xl transition-all rounded-2xl" 
              size="lg" 
              onClick={runSearch} 
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
              {busy ? "Aggregating 500+ Airlines via PaddleBaas…" : "Search Available Flights"}
            </Button>
          </section>

          {/* Skeleton Loaders */}
          {busy && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-cobalt font-extrabold">
                <Loader2 className="h-5 w-5 animate-spin text-cobalt" />
                Fetching live NDC flight offers from British Airways, Emirates, Qatar, Air Peace, Ethiopian Airlines...
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted/60 border border-border" />
              ))}
            </div>
          )}

          {/* Offer Results */}
          {result && !busy && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-2xl border border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">
                    <span className="text-cobalt font-black">{shown.length} live offers</span> · {from?.code} → {to?.code}
                  </p>
                  {searchLatencyMs !== null && (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black text-emerald-500 border border-emerald-500/20">
                      ⚡ Populated in {searchLatencyMs}ms
                    </span>
                  )}
                  <span className="rounded-md bg-cobalt/10 px-2 py-0.5 text-[11px] font-bold text-cobalt">
                    Priced in {selectedCurrency}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Sort:</span>
                  {(["cheapest", "fastest", "earliest"] as const).map((s) => (
                    <button 
                      key={s} 
                      onClick={() => setSort(s)} 
                      className={`rounded-full border px-3.5 py-1 text-xs font-bold capitalize transition-colors ${
                        sort === s ? "border-cobalt bg-cobalt text-white shadow-xs font-black" : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button 
                    onClick={() => setNonstop((v) => !v)} 
                    className={`rounded-full border px-3.5 py-1 text-xs font-bold transition-colors ${
                      nonstop ? "border-magenta bg-magenta/15 text-magenta" : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    Direct Only
                  </button>
                </div>
              </div>

              {shown.length ? (
                shown.map((o) => (
                  <OfferCard 
                    key={o.id} 
                    o={o} 
                    onSelect={() => choose(o)} 
                    currency={selectedCurrency}
                    fx={liveRates}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <Plane className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 font-extrabold text-lg text-foreground">No flights found for this search</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                    Try adjusting your dates, unchecking "Direct Only", or searching alternative regional airports.
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        /* Trips Tab */
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Your Confirmed Bookings</h2>
              <p className="text-xs text-muted-foreground">Access your e-tickets, check-in PNR codes, and download official receipts.</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadTrips} className="rounded-xl font-bold">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh Trips
            </Button>
          </div>

          {tripErr ? (
            <div className="rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive">
              {tripErr}
            </div>
          ) : !tripList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-cobalt" />
            </div>
          ) : !tripList.length ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <Ticket className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 font-extrabold text-lg text-foreground">No booked trips yet</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                When you book flights on Slikpay, your ticket numbers and 6-letter airline PNR codes appear here instantly.
              </p>
              <Button onClick={() => setTab("search")} className="mt-4 rounded-xl font-bold">
                Book a Flight Now
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tripList.map((t) => (
                <article 
                  key={t.key} 
                  className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-xs transition hover:border-cobalt/40 sm:flex-row sm:items-center"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cobalt/10 text-cobalt shrink-0">
                    <Ticket className="h-6 w-6" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-foreground text-base">{t.route || "Flight"} · {t.airline}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        t.status === "succeeded" ? "bg-emerald-500/15 text-emerald-500" : 
                        t.status === "failed" ? "bg-destructive/15 text-destructive" : 
                        "bg-magenta/15 text-magenta"
                      }`}>
                        {t.status === "succeeded" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {t.status === "succeeded" ? "Ticket Confirmed" : t.status === "failed" ? "Declined" : "Pending Confirmation"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Departure: <span className="font-semibold text-foreground">{date(t.departAt)} at {time(t.departAt)}</span> · Passengers: <span className="font-semibold text-foreground">{t.passengers.join(", ")}</span>
                    </p>

                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-muted/80 px-2.5 py-1 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">PNR:</span>
                        <span className="font-mono text-xs font-black text-cobalt">{t.pnr ?? "Awaiting Airline"}</span>
                        {t.pnr && (
                          <button 
                            type="button" 
                            onClick={() => copyPNR(t.pnr!)} 
                            className="text-muted-foreground hover:text-foreground ml-1"
                            title="Copy PNR"
                          >
                            {copiedKey === t.pnr ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>

                      {t.tickets.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-muted/80 px-2.5 py-1 rounded-xl">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">E-Ticket:</span>
                          <span className="font-mono text-xs font-bold text-foreground">{t.tickets.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <p className="text-lg font-black text-foreground sm:text-xl">{formatPriceWithSymbol(t.amount, t.currency)}</p>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setViewTicket(t)} 
                        className="rounded-xl font-bold text-xs"
                      >
                        <QrCode className="mr-1.5 h-3.5 w-3.5 text-cobalt" /> Boarding Pass
                      </Button>
                      <button 
                        type="button" 
                        onClick={() => downloadTextReceipt(t)} 
                        className="flex items-center gap-1 text-xs font-bold text-cobalt hover:underline p-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Receipt
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-2xl border border-border">
            🛡️ <strong>Slikpay IATA Guarantee:</strong> Under 24-hour IATA rules, changes or cancellations can be processed by contacting support at <code className="font-semibold text-cobalt">support@slikpay.online</code> quoting your 6-letter PNR.
          </p>
        </section>
      )}

      {/* Booking Checkout Modal with Multi-Wallet Payment Selection */}
      {picked && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6 border border-border">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cobalt flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Multi-Rail Wallet Checkout
                </p>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">
                  {picked.slices.map((s) => `${s.from} → ${s.to}`).join(" · ")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {picked.airline} · {date(picked.slices[0]!.departAt)} · {CABIN_LABEL[cabin]} · {adults} Passenger{adults > 1 ? "s" : ""}
                </p>
              </div>
              <button 
                aria-label="Close" 
                onClick={() => !booking && setPicked(null)} 
                className="rounded-full p-2 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Wallet Payment Source Selector */}
            <div className="mt-4 p-4 rounded-2xl bg-muted/40 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-cobalt" /> Select Debit Wallet Balance
                </span>
                <span className="text-[11px] text-emerald-500 font-bold">Zero FX Surcharge</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { code: "NGN", name: "Naira Wallet", flag: "🇳🇬" },
                  { code: "USDT", name: "USDT Vault", flag: "🪙" },
                  { code: "USD", name: "USD Domiciliary", flag: "🇺🇸" },
                  { code: "GBP", name: "GBP Account", flag: "🇬🇧" },
                ].map((w) => (
                  <button
                    key={w.code}
                    type="button"
                    onClick={() => setPaymentWalletCurrency(w.code as SupportedCurrency)}
                    className={`rounded-xl p-2.5 text-left border transition-all ${
                      paymentWalletCurrency === w.code
                        ? "border-cobalt bg-cobalt/15 text-foreground shadow-sm font-black"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-base">{w.flag}</span>
                    <p className="text-xs font-extrabold text-foreground mt-0.5">{w.code}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{w.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Passenger Information</span>
              {profile && (
                <button
                  type="button"
                  onClick={autofillPrimaryTraveller}
                  className="text-xs font-bold text-cobalt hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Autofill with my profile
                </button>
              )}
            </div>

            <div className="mt-2 space-y-4">
              {pax.map((p, i) => {
                const set = (patch: Partial<Passenger>) => setPax((all) => all.map((x, j) => j === i ? { ...x, ...patch } : x));
                return (
                  <fieldset key={i} className="rounded-2xl border border-border p-4 bg-muted/20">
                    <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-foreground">
                      <Users className="h-3.5 w-3.5 text-cobalt" />
                      Passenger {i + 1} (Must match International Passport)
                    </legend>
                    <div className="grid gap-2.5 sm:grid-cols-6 mt-1">
                      <div className="sm:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Title</label>
                        <select 
                          aria-label="Title" 
                          value={p.title} 
                          onChange={(e) => set({ title: e.target.value as Passenger["title"] })} 
                          className={field}
                        >
                          {["mr", "ms", "mrs", "miss", "dr"].map((t) => (
                            <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">First Name</label>
                        <input 
                          aria-label="First name" 
                          placeholder="e.g. Chukwudi" 
                          value={p.givenName} 
                          onChange={(e) => set({ givenName: e.target.value })} 
                          className={field} 
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Last Name (Surname)</label>
                        <input 
                          aria-label="Last name" 
                          placeholder="e.g. Adeleke" 
                          value={p.familyName} 
                          onChange={(e) => set({ familyName: e.target.value })} 
                          className={field} 
                        />
                      </div>

                      <label className="text-[10px] font-bold uppercase text-muted-foreground sm:col-span-2">
                        Date of Birth
                        <input 
                          type="date" 
                          value={p.bornOn} 
                          onChange={(e) => set({ bornOn: e.target.value })} 
                          className={field} 
                        />
                      </label>

                      <label className="text-[10px] font-bold uppercase text-muted-foreground sm:col-span-1">
                        Gender
                        <select 
                          value={p.gender} 
                          onChange={(e) => set({ gender: e.target.value as "m" | "f" })} 
                          className={field}
                        >
                          <option value="m">Male</option>
                          <option value="f">Female</option>
                        </select>
                      </label>

                      <label className="text-[10px] font-bold uppercase text-muted-foreground sm:col-span-3">
                        Passport No. (Recommended)
                        <input 
                          value={p.passport} 
                          placeholder="e.g. A12345678" 
                          onChange={(e) => set({ passport: e.target.value.toUpperCase() })} 
                          className={field} 
                        />
                      </label>

                      <label className="text-[10px] font-bold uppercase text-muted-foreground sm:col-span-3">
                        Email Address (For E-Ticket)
                        <input 
                          aria-label="Email" 
                          type="email" 
                          placeholder="ticket@recipient.com" 
                          value={p.email} 
                          onChange={(e) => set({ email: e.target.value })} 
                          className={field} 
                        />
                      </label>

                      <label className="text-[10px] font-bold uppercase text-muted-foreground sm:col-span-3">
                        Phone (International)
                        <input 
                          aria-label="Phone" 
                          placeholder="+2348012345678" 
                          value={p.phone} 
                          onChange={(e) => set({ phone: e.target.value.replace(/[^\d+]/g, "") })} 
                          className={field} 
                        />
                      </label>
                    </div>
                  </fieldset>
                );
              })}
            </div>

            {/* Wallet Summary */}
            {(() => {
              const debitQuote = convertCurrency(picked.amount, picked.currency, paymentWalletCurrency, liveRates);
              const formattedDebit = formatPriceWithSymbol(debitQuote.amount, paymentWalletCurrency);
              return (
                <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm border border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-foreground">Total to Debit ({adults} Passenger{adults > 1 ? "s" : ""})</span>
                      <p className="text-[11px] text-muted-foreground">
                        From your {paymentWalletCurrency} Balance (Live Rate: 1 {picked.currency} = {debitQuote.rate.toFixed(4)} {paymentWalletCurrency})
                      </p>
                    </div>
                    <span className="text-2xl font-black text-cobalt">{formattedDebit}</span>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    Wholesale rate guaranteed. If the airline rate changes before confirmation, 100% of reserved funds are released.
                  </p>
                </div>
              );
            })()}

            {live && (
              <label className="mt-4 block text-sm font-bold text-foreground">
                Transaction PIN (4-Digits)
                <input 
                  type="password" 
                  inputMode="numeric" 
                  maxLength={4} 
                  placeholder="••••" 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} 
                  className={`${field} font-mono tracking-[0.6em] text-center text-lg`} 
                />
              </label>
            )}

            {bookErr && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {bookErr}
              </div>
            )}

            <Button 
              className="mt-4 w-full py-6 text-base font-extrabold shadow-lg rounded-2xl" 
              size="lg" 
              onClick={confirm} 
              disabled={booking}
            >
              {booking ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Locking Seat & Issuing E-Ticket…
                </>
              ) : (
                <>
                  Authorize Debit & Issue Ticket ({formatPriceWithSymbol(convertCurrency(picked.amount, picked.currency, paymentWalletCurrency, liveRates).amount, paymentWalletCurrency)})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Boarding Pass / E-Ticket Modal */}
      {viewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 print:p-0 print:bg-white" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden print:border-none print:shadow-none">
            {/* Header */}
            <div className="bg-navy p-6 text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan">Official Electronic Boarding Pass</p>
                <h3 className="text-xl font-black mt-1">{viewTicket.airline}</h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">{viewTicket.route}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setViewTicket(null)} 
                className="rounded-full p-2 bg-white/10 hover:bg-white/20 text-white print:hidden transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Boarding Pass Body */}
            <div className="p-6 space-y-5 bg-card">
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Passenger(s)</p>
                  <p className="font-extrabold text-foreground text-sm mt-0.5">{viewTicket.passengers.join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Booking Reference (PNR)</p>
                  <p className="font-mono text-base font-black text-cobalt mt-0.5">{viewTicket.pnr ?? "PENDING"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Departure</p>
                  <p className="font-bold text-foreground text-sm mt-0.5">{date(viewTicket.departAt)}</p>
                  <p className="text-xs text-muted-foreground">{time(viewTicket.departAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Class</p>
                  <p className="font-bold text-foreground text-sm mt-0.5">Confirmed (OK)</p>
                  <p className="text-xs text-emerald-500 font-semibold">Seat Assigned</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Amount Paid</p>
                  <p className="font-bold text-foreground text-sm mt-0.5">{formatPriceWithSymbol(viewTicket.amount, viewTicket.currency)}</p>
                  <p className="text-[11px] text-muted-foreground">Wallet Settled</p>
                </div>
              </div>

              {/* Barcode / QR Simulation */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-muted/40 border border-border">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">E-Ticket Identifier</p>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {viewTicket.tickets.join(", ") || viewTicket.key}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Scan at airport biometric / security gate</p>
                </div>
                <div className="h-16 w-16 bg-white p-1 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center">
                  <QrCode className="h-14 w-14 text-slate-900" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 print:hidden">
                <Button 
                  onClick={() => window.print()} 
                  className="flex-1 font-bold rounded-xl"
                >
                  <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => downloadTextReceipt(viewTicket)} 
                  className="font-bold rounded-xl"
                >
                  <Download className="mr-2 h-4 w-4" /> Text Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
