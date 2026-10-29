import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { 
  AlertCircle, ArrowLeftRight, Briefcase, Check, CheckCircle2, ChevronRight, Clock, 
  Coins, Copy, DollarSign, Download, Filter, Globe, Info, Loader2, 
  Luggage, Plane, PlaneLanding, PlaneTakeoff, Printer, QrCode, 
  RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Ticket, Users, 
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

function AirlineLogo({ 
  code, 
  name, 
  logoUrl, 
  className = "h-12 w-12" 
}: { 
  code: string; 
  name: string; 
  logoUrl?: string | null; 
  className?: string 
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const cleanCode = (code || "").trim().toUpperCase();

  const sources = useMemo(() => {
    const list: string[] = [];
    if (logoUrl) list.push(logoUrl);
    if (cleanCode && cleanCode.length === 2) {
      list.push(`https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${cleanCode}.svg`);
      list.push(`https://pics.avs.io/100/100/${cleanCode}.png`);
      list.push(`https://images.kiwi.com/airlines/64/${cleanCode}.png`);
    }
    return list;
  }, [logoUrl, cleanCode]);

  if (srcIndex < sources.length && sources[srcIndex]) {
    return (
      <div className={`relative flex items-center justify-center rounded-2xl bg-white p-2 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 ${className}`}>
        <img
          src={sources[srcIndex]}
          alt={name || cleanCode || "Airline"}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          onError={() => setSrcIndex((prev) => prev + 1)}
        />
      </div>
    );
  }

  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cobalt via-navy-light to-cyan font-mono text-xs font-black text-white shadow-md ${className}`}>
      {cleanCode || <Plane className="h-5 w-5" />}
    </span>
  );
}

const formatLayoverDuration = (minutes: number | null | undefined): string => {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

function OfferCard({ 
  o, 
  onSelect, 
  onDetails,
  currency, 
  fx 
}: { 
  o: FlightOffer; 
  onSelect: () => void; 
  onDetails: () => void;
  currency: SupportedCurrency; 
  fx: FxRates | null;
}) {
  const isDirect = o.slices.every((s) => s.stops === 0);
  const converted = convertCurrency(o.amount, o.currency, currency, fx);
  const displayPrice = formatPriceWithSymbol(converted.amount, currency);
  const originalPrice = `${o.currency} ${o.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isConverted = currency.toUpperCase() !== o.currency.toUpperCase();
  const flex = o.fareFlexibility;

  return (
    <article className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm transition hover:border-cobalt hover:shadow-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Carrier Info with Real Airline Image/Logo */}
        <div className="flex items-center gap-3.5 lg:w-56">
          <AirlineLogo 
            code={o.airlineCode} 
            name={o.airline} 
            logoUrl={o.logoUrl} 
            className="h-14 w-14"
          />
          <div className="min-w-0">
            <p className="truncate font-black text-foreground text-sm sm:text-base">{o.airline || "Airline Partner"}</p>
            <p className="truncate text-xs font-mono font-bold text-cobalt flex items-center gap-1">
              <span className="rounded bg-cobalt/10 px-1 py-0.2">{o.airlineCode}</span>
              <span className="text-muted-foreground font-normal">·</span>
              <span className="text-muted-foreground">{o.slices[0]!.segments.map((s) => s.flightNumber).filter(Boolean).join(" · ") || "Direct NDC"}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {flex?.isRefundable ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-2.5 w-2.5" /> Refundable
                </span>
              ) : flex?.isChangeable ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Changeable
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                  Non-refundable
                </span>
              )}
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Wifi className="h-2.5 w-2.5 text-cyan" /> Wi-Fi
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
                <button
                  type="button"
                  onClick={onDetails}
                  className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-cobalt hover:underline cursor-pointer"
                >
                  <span>View stops & baggage</span>
                  <ChevronRight className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-lg sm:text-2xl font-black text-foreground">{time(s.arriveAt)}</p>
                <p className="font-mono text-xs font-bold text-muted-foreground">{s.to} {s.toCity ? `(${s.toCity})` : ""}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic Multi-Currency Price & Book Action */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 lg:w-64 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
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
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={onDetails} 
              className="h-10 px-3.5 rounded-xl font-bold border-border hover:border-cobalt/60 hover:bg-cobalt/5 transition-all text-xs"
            >
              <Info className="h-3.5 w-3.5 mr-1 text-cobalt" />
              Flight Details
            </Button>
            <Button 
              type="button"
              onClick={onSelect} 
              className="h-10 px-4 rounded-xl font-black shadow-md hover:shadow-lg transition-all text-xs"
            >
              Select Flight
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FlightDetailsModal({
  offer,
  onClose,
  onBook,
  currency,
  fx,
  cabinClass,
}: {
  offer: FlightOffer;
  onClose: () => void;
  onBook: () => void;
  currency: SupportedCurrency;
  fx: FxRates | null;
  cabinClass: Cabin;
}) {
  const converted = convertCurrency(offer.amount, offer.currency, currency, fx);
  const displayPrice = formatPriceWithSymbol(converted.amount, currency);
  const originalPrice = `${offer.currency} ${offer.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isConverted = currency.toUpperCase() !== offer.currency.toUpperCase();
  const flex = offer.fareFlexibility;
  const bag = offer.baggageDetails;
  const amen = offer.amenities;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flight-details-title"
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-5 sm:px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AirlineLogo 
              code={offer.airlineCode} 
              name={offer.airline} 
              logoUrl={offer.logoUrl} 
              className="h-11 w-11"
            />
            <div>
              <h2 id="flight-details-title" className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <span>{offer.airline}</span>
                <span className="rounded-md bg-cobalt/10 px-2 py-0.5 text-xs font-mono font-bold text-cobalt">
                  {offer.airlineCode}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {offer.slices[0]?.from} → {offer.slices[0]?.to} · {CABIN_LABEL[cabinClass] || "Economy"} · Verified BaaS Fare
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Top Price & Flexibility Banner */}
          <div className="rounded-2xl border border-cobalt/20 bg-gradient-to-br from-cobalt/5 via-navy-light/10 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {flex?.isRefundable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Refundable Ticket
                  </span>
                ) : flex?.isChangeable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Changeable with Airline Fee
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 border border-slate-500/30 px-2.5 py-0.5 text-xs font-extrabold text-slate-600 dark:text-slate-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Non-Refundable Restricted Fare
                  </span>
                )}
                <span className="rounded-full bg-cyan/15 border border-cyan/30 px-2.5 py-0.5 text-xs font-bold text-cyan">
                  {offer.slices.every(s => s.stops === 0) ? "Non-stop Direct" : `${offer.slices[0]?.stops || 1} Stop Transfer`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                All taxes, airport passenger service charges & ticketing fees included.
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-black text-cobalt tracking-tight">
                {displayPrice}
              </p>
              {isConverted && (
                <p className="text-xs font-medium text-muted-foreground">
                  Original base fare: {originalPrice}
                </p>
              )}
            </div>
          </div>

          {/* Detailed Flight Segments & Stoppage Times */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                <Plane className="h-4 w-4 text-cobalt" />
                Complete Flight Route & Layovers
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                Total duration: {prettyDuration(offer.slices[0]?.duration) || "Direct"}
              </span>
            </div>

            {offer.slices.map((slice, sliceIdx) => (
              <div key={sliceIdx} className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5 space-y-4">
                {offer.slices.length > 1 && (
                  <div className="border-b border-border pb-2.5 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cobalt">
                      {sliceIdx === 0 ? "Outbound Flight" : "Return Flight"}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {date(slice.departAt)}
                    </span>
                  </div>
                )}

                {slice.segments.map((seg, segIdx) => (
                  <div key={segIdx} className="space-y-3">
                    {/* Segment Leg Box */}
                    <div className="relative pl-6 sm:pl-8 border-l-2 border-cobalt/30 space-y-4 py-1">
                      {/* Departure Point */}
                      <div className="relative">
                        <span className="absolute -left-[31px] sm:-left-[39px] top-1 grid h-5 w-5 place-items-center rounded-full bg-cobalt text-white shadow-sm ring-4 ring-card">
                          <PlaneTakeoff className="h-3 w-3" />
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-foreground">{time(seg.departAt)}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-black text-foreground">{seg.from}</span>
                            <span className="text-sm font-semibold text-foreground">
                              {seg.fromName || (seg.fromCity ? `${seg.fromCity} Airport` : seg.from)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">
                            {date(seg.departAt)}
                            {seg.fromTerminal ? ` · Terminal ${seg.fromTerminal}` : ""}
                          </span>
                        </div>
                      </div>

                      {/* In-Flight Details */}
                      <div className="rounded-xl bg-card border border-border/70 p-3 sm:p-3.5 space-y-1.5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <span className="text-cobalt font-mono">{seg.flightNumber}</span>
                            <span>·</span>
                            <span>{seg.carrier}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground font-medium">
                            {seg.aircraft && <span>Aircraft: {seg.aircraft}</span>}
                            {seg.aircraft && seg.duration && <span>·</span>}
                            {seg.duration && <span>Flight time: {prettyDuration(seg.duration)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <span className="capitalize">{seg.cabin || CABIN_LABEL[cabinClass] || "Economy Class"}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Electronic Ticket (Instant PNR)
                          </span>
                        </div>
                      </div>

                      {/* Arrival Point */}
                      <div className="relative">
                        <span className="absolute -left-[31px] sm:-left-[39px] top-1 grid h-5 w-5 place-items-center rounded-full bg-cyan text-slate-950 shadow-sm ring-4 ring-card">
                          <PlaneLanding className="h-3 w-3" />
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-foreground">{time(seg.arriveAt)}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-black text-foreground">{seg.to}</span>
                            <span className="text-sm font-semibold text-foreground">
                              {seg.toName || (seg.toCity ? `${seg.toCity} Airport` : seg.to)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">
                            {date(seg.arriveAt)}
                            {seg.toTerminal ? ` · Terminal ${seg.toTerminal}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* STOPPAGE / LAYOVER BANNER IF APPLICABLE */}
                    {seg.layoverAfterMinutes != null && seg.layoverAfterMinutes > 0 && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5 p-3.5 sm:p-4 my-2 flex items-start sm:items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-foreground text-xs sm:text-sm">
                            {formatLayoverDuration(seg.layoverAfterMinutes)} Stoppage / Layover in {seg.layoverAirport || seg.to}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Connecting flight · Checked baggage transferred directly to your final destination · Plane change required
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Baggage Allowance Grid */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
              <Luggage className="h-4 w-4 text-cyan" />
              Baggage Allowance Included
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Checked baggage */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-foreground font-extrabold text-sm">
                  <Luggage className="h-4 w-4 text-cobalt" />
                  <h4>Checked Baggage</h4>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  {bag?.checkedBagsText || offer.baggage || "1 Checked bag (23kg standard allowance) included"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Standard weight limit: 23 kg (50 lbs) per bag. Max dimension sum: 158 cm (62 inches). Additional bags can be added during airline web check-in.
                </p>
              </div>

              {/* Cabin carry-on */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-foreground font-extrabold text-sm">
                  <Briefcase className="h-4 w-4 text-cyan" />
                  <h4>Cabin Carry-On</h4>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  {bag?.cabinBagsText || "1 Cabin bag (up to 7kg - 10kg) + 1 Personal item"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Fits in overhead cabin storage. Personal item (laptop backpack or handbag) must fit under the seat in front of you.
                </p>
              </div>
            </div>
          </div>

          {/* Fare Flexibility, Refund Policy & Rules */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-sm">
            <h3 className="font-extrabold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Ticket Refundability & Fare Conditions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="font-extrabold text-foreground flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${flex?.isRefundable ? "bg-emerald-500" : "bg-slate-400"}`} />
                  Cancellation & Refunds
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {flex?.isRefundable 
                    ? `Eligible for cancellation refund before scheduled departure. ${flex.refundPenalty || "Subject to airline cancellation fee"}.`
                    : "Non-refundable ticket. Once issued, base fare cannot be refunded in the event of passenger cancellation."}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-foreground flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${flex?.isChangeable ? "bg-amber-500" : "bg-slate-400"}`} />
                  Date Changes & Reissues
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {flex?.isChangeable
                    ? `Date changes permitted prior to departure. ${flex.changePenalty || "Fare difference and airline reissue fees apply"}.`
                    : "Flight changes are restricted on this promotional fare."}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 text-cobalt" />
              <span>International travel requires valid passport (min. 6 months validity) and appropriate destination/transit visas.</span>
            </div>
          </div>

          {/* In-Flight Amenities & Comfort */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-sm">
            <h3 className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              In-Flight Amenities & Specifications
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2.5">
                <Wifi className="h-4 w-4 text-cyan shrink-0" />
                <div>
                  <p className="font-bold text-foreground">{amen?.hasWifi ? "Wi-Fi Enabled" : "Wi-Fi on Board"}</p>
                  <p className="text-[10px] text-muted-foreground">Messaging & stream</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2.5">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Power Outlets</p>
                  <p className="text-[10px] text-muted-foreground">USB & In-seat AC</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2.5">
                <Utensils className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Complimentary Meals</p>
                  <p className="text-[10px] text-muted-foreground">Dietary choices</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2.5">
                <Globe className="h-4 w-4 text-cobalt shrink-0" />
                <div>
                  <p className="font-bold text-foreground">CO₂ Impact</p>
                  <p className="text-[10px] text-muted-foreground">~{amen?.carbonCo2Kg || 240} kg / pax</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-card/95 px-5 sm:px-6 py-4 backdrop-blur-md">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Final price for {CABIN_LABEL[cabinClass] || "Flight"}</p>
            <p className="text-xl sm:text-2xl font-black text-cobalt tracking-tight">{displayPrice}</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-xl font-bold px-4"
            >
              Back to results
            </Button>
            <Button 
              type="button"
              onClick={onBook}
              className="flex-1 sm:flex-initial rounded-xl font-black px-6 shadow-md hover:shadow-lg transition-all"
            >
              Proceed to Book Flight
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlightBooking({ role = "merchant" }: { role?: "merchant" | "personal" }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  const livePricing = useLivePricing();
  const liveRates = livePricing?.rates ?? null;

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
  const [stopsFilter, setStopsFilter] = useState<"all" | "direct" | "1stop">("all");
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [departureWindow, setDepartureWindow] = useState<"all" | "morning" | "afternoon" | "evening">("all");
  const [maxPriceCap, setMaxPriceCap] = useState<number | null>(null);
  const [detailOffer, setDetailOffer] = useState<FlightOffer | null>(null);
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
      let attempts = 0;
      const maxAttempts = 12;
      while ((!r.complete || !r.offers?.length) && r.searchId && n === seq.current && attempts < maxAttempts) { 
        attempts++;
        await new Promise((ok) => setTimeout(ok, 1200)); 
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

  const availableAirlines = useMemo(() => {
    if (!result?.offers) return [];
    const map = new Map<string, number>();
    for (const o of result.offers) {
      const name = o.airline || "Unknown Carrier";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [result?.offers]);

  const priceStats = useMemo(() => {
    if (!result?.offers || !result.offers.length) return { min: 0, max: 0 };
    let min = Infinity, max = -Infinity;
    for (const o of result.offers) {
      const val = convertCurrency(o.amount, o.currency, selectedCurrency, liveRates).amount;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [result?.offers, selectedCurrency, liveRates]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (stopsFilter !== "all") count++;
    if (selectedAirline !== "all") count++;
    if (departureWindow !== "all") count++;
    if (maxPriceCap !== null && priceStats.max > 0 && maxPriceCap < priceStats.max) count++;
    return count;
  }, [stopsFilter, selectedAirline, departureWindow, maxPriceCap, priceStats.max]);

  const resetAllFilters = () => {
    setStopsFilter("all");
    setSelectedAirline("all");
    setDepartureWindow("all");
    setMaxPriceCap(null);
  };

  const shown = useMemo(() => {
    if (!result?.offers) return [];
    let list = result.offers;

    if (stopsFilter === "direct") {
      list = list.filter((o) => o.slices.every((s) => s.stops === 0));
    } else if (stopsFilter === "1stop") {
      list = list.filter((o) => o.slices.every((s) => s.stops <= 1));
    }

    if (selectedAirline !== "all") {
      list = list.filter((o) => (o.airline || "Unknown Carrier") === selectedAirline);
    }

    if (departureWindow !== "all") {
      list = list.filter((o) => {
        const d = new Date(o.slices[0]!.departAt);
        const hrs = d.getHours();
        if (departureWindow === "morning") return hrs >= 0 && hrs < 12;
        if (departureWindow === "afternoon") return hrs >= 12 && hrs < 18;
        if (departureWindow === "evening") return hrs >= 18 && hrs <= 23;
        return true;
      });
    }

    if (maxPriceCap !== null && maxPriceCap > 0 && priceStats.max > 0 && maxPriceCap < priceStats.max) {
      list = list.filter((o) => {
        const val = convertCurrency(o.amount, o.currency, selectedCurrency, liveRates).amount;
        return val <= maxPriceCap;
      });
    }

    return [...list].sort((a, b) => {
      if (sort === "cheapest") {
        const aConv = convertCurrency(a.amount, a.currency, selectedCurrency, liveRates).amount;
        const bConv = convertCurrency(b.amount, b.currency, selectedCurrency, liveRates).amount;
        return aConv - bConv;
      }
      if (sort === "fastest") return minutes(a) - minutes(b);
      return Date.parse(a.slices[0]!.departAt) - Date.parse(b.slices[0]!.departAt);
    });
  }, [result, sort, stopsFilter, selectedAirline, departureWindow, maxPriceCap, priceStats.max, selectedCurrency, liveRates]);

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
                <Sparkles className="h-3 w-3" /> Real-Time Slikpay Global NDC Engine
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
                (Live Mid-Market Interbank FX Rates)
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
                Guaranteed Wholesale NDC Fares (Zero Slippage)
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
              {busy ? "Aggregating 500+ Airlines via Slikpay Global Rail…" : "Search Available Flights"}
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

          {/* Offer Results & Comprehensive Search Filters */}
          {result && !busy && (
            <section className="space-y-4">
              {/* Summary Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 rounded-3xl shadow-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-sm font-extrabold text-foreground">
                    <span className="text-cobalt font-black text-base">{shown.length}</span> of {result.offers.length} flight{result.offers.length === 1 ? "" : "s"}
                  </p>
                  <span className="text-xs font-mono font-bold text-muted-foreground">·</span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {from?.code} → {to?.code}
                  </span>
                  {searchLatencyMs !== null && (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ⚡ {searchLatencyMs}ms
                    </span>
                  )}
                  <span className="rounded-full bg-cobalt/10 px-2.5 py-0.5 text-[11px] font-bold text-cobalt border border-cobalt/20">
                    {selectedCurrency} Pricing
                  </span>
                </div>

                {/* Sort Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Sort:</span>
                  {(["cheapest", "fastest", "earliest"] as const).map((s) => (
                    <button 
                      key={s} 
                      type="button"
                      onClick={() => setSort(s)} 
                      className={`rounded-xl border px-3.5 py-1 text-xs font-bold capitalize transition-all ${
                        sort === s 
                          ? "border-cobalt bg-cobalt text-white shadow-xs font-black scale-102" 
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {s === "cheapest" ? "💰 Cheapest" : s === "fastest" ? "⚡ Fastest" : "🕒 Earliest"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Deck */}
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-cobalt" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      Filter Flight Results
                    </span>
                    {activeFiltersCount > 0 && (
                      <span className="rounded-full bg-magenta/20 px-2 py-0.5 text-[10px] font-black text-magenta border border-magenta/30">
                        {activeFiltersCount} active
                      </span>
                    )}
                  </div>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="flex items-center gap-1 text-xs font-bold text-magenta hover:underline transition-all"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stops Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Stops
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "all", label: "All Flights" },
                        { id: "direct", label: "Non-stop (0)" },
                        { id: "1stop", label: "Max 1 Stop" }
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setStopsFilter(st.id as typeof stopsFilter)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                            stopsFilter === st.id
                              ? "border-cobalt bg-cobalt text-white shadow-xs font-black"
                              : "border-border bg-muted/40 text-foreground hover:bg-muted"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Departure Window Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Departure Window
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "all", label: "Any" },
                        { id: "morning", label: "🌅 Morning" },
                        { id: "afternoon", label: "☀️ Aft" },
                        { id: "evening", label: "🌙 Eve" },
                      ].map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setDepartureWindow(w.id as typeof departureWindow)}
                          className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                            departureWindow === w.id
                              ? "border-cobalt bg-cobalt text-white shadow-xs font-black"
                              : "border-border bg-muted/40 text-foreground hover:bg-muted"
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Airline Selector Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Airline Carrier
                    </label>
                    <select
                      value={selectedAirline}
                      onChange={(e) => setSelectedAirline(e.target.value)}
                      className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
                    >
                      <option value="all">All Airlines ({result.offers.length} offers)</option>
                      {availableAirlines.map((air) => (
                        <option key={air.name} value={air.name}>
                          {air.name} ({air.count} {air.count === 1 ? "flight" : "flights"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price Range Slider */}
                {priceStats.max > priceStats.min && (
                  <div className="pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-muted-foreground uppercase tracking-wider text-[11px]">
                        Max Fare Budget
                      </span>
                      <span className="font-black text-cobalt text-sm">
                        Up to {formatPriceWithSymbol(maxPriceCap ?? priceStats.max, selectedCurrency)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                        {formatPriceWithSymbol(priceStats.min, selectedCurrency)}
                      </span>
                      <input
                        type="range"
                        min={priceStats.min}
                        max={priceStats.max}
                        step={Math.max(1, Math.round((priceStats.max - priceStats.min) / 100))}
                        value={maxPriceCap ?? priceStats.max}
                        onChange={(e) => setMaxPriceCap(Number(e.target.value))}
                        className="flex-1 accent-cobalt h-2 bg-muted rounded-lg cursor-pointer"
                      />
                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                        {formatPriceWithSymbol(priceStats.max, selectedCurrency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Offer Cards List or Empty state */}
              {shown.length ? (
                shown.map((o) => (
                  <OfferCard 
                    key={o.id} 
                    o={o} 
                    onSelect={() => choose(o)} 
                    onDetails={() => setDetailOffer(o)}
                    currency={selectedCurrency}
                    fx={liveRates}
                  />
                ))
              ) : result.offers.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <Plane className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 font-extrabold text-lg text-foreground">No flights found for this search</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                    No available flights were returned for {from?.code} → {to?.code} on {date(depart)}. Try selecting different dates or alternative hubs.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={runSearch} 
                    className="mt-4 rounded-xl font-bold"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Try Searching Again
                  </Button>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <SlidersHorizontal className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 font-extrabold text-lg text-foreground">No flights match your active filters</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                    {result.offers.length} flight{result.offers.length === 1 ? " is" : "s are"} available, but excluded by your current stops, airline, departure time, or budget filters.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetAllFilters} 
                    className="mt-4 rounded-xl font-bold"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset all filters ({activeFiltersCount} active)
                  </Button>
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
                  <AirlineLogo 
                    code={t.airline.slice(0, 2)} 
                    name={t.airline} 
                    className="h-12 w-12"
                  />

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

      {/* Comprehensive Flight Details, Baggage, Stoppage & Refund Rules Modal */}
      {detailOffer && (
        <FlightDetailsModal 
          offer={detailOffer}
          cabinClass={cabin}
          currency={selectedCurrency}
          fx={liveRates}
          onClose={() => setDetailOffer(null)}
          onBook={() => {
            const selected = detailOffer;
            setDetailOffer(null);
            choose(selected);
          }}
        />
      )}

      {/* Booking Checkout Modal with Multi-Wallet Payment Selection */}
      {picked && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6 border border-border">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3.5">
                <AirlineLogo 
                  code={picked.airlineCode} 
                  name={picked.airline} 
                  logoUrl={picked.logoUrl} 
                  className="h-14 w-14"
                />
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
