import { z } from "zod";

/** Shared flight types and strict parsers. Never invent fares, carriers or tickets. */
export const FLIGHT_ORDER_OP = "POST /v1/flights/orders";
export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export type Cabin = (typeof CABINS)[number];

export type Airport = { code: string; name: string; city: string; country: string };
export type FlightSegment = { from: string; to: string; departAt: string; arriveAt: string; carrier: string; flightNumber: string };
export type FlightSlice = { from: string; fromCity: string; to: string; toCity: string; departAt: string; arriveAt: string; duration: string | null; stops: number; segments: FlightSegment[] };
export type FlightOffer = { 
  id: string; 
  amount: number; 
  currency: string; 
  airline: string; 
  airlineCode: string; 
  slices: FlightSlice[]; 
  baggage: string | null; 
  expiresAt: string | null; 
  passengerIds: string[];
  convertedAmounts?: {
    ngn?: number;
    usd?: number;
    gbp?: number;
    eur?: number;
    usdt?: number;
  };
  logoUrl?: string | null;
};
export type FlightSearchResult = { searchId: string | null; complete: boolean; offers: FlightOffer[] };

const iata = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Choose an airport");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
export const flightSearch = z.object({
  origin: iata, destination: iata, departureDate: day, returnDate: day.optional(),
  adults: z.number().int().min(1).max(9), cabinClass: z.enum(CABINS),
}).refine((v) => v.origin !== v.destination, { message: "Origin and destination must differ", path: ["destination"] })
  .refine((v) => !v.returnDate || v.returnDate >= v.departureDate, { message: "Return must be after departure", path: ["returnDate"] });

export const passenger = z.object({
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
  givenName: z.string().trim().min(1, "First name required").max(60),
  familyName: z.string().trim().min(1, "Last name required").max(60),
  bornOn: day,
  gender: z.enum(["m", "f"]),
  email: z.string().trim().email("Valid email required"),
  phone: z.string().trim().regex(/^\+\d{8,15}$/, "Phone in international format, e.g. +2348012345678"),
  passport: z.string().trim().max(20).optional(),
});
export type Passenger = z.infer<typeof passenger>;

export const flightBooking = z.object({
  searchId: z.string().min(1).max(200),
  offerId: z.string().min(1).max(200),
  expectedAmount: z.number().positive(),
  expectedCurrency: z.string().regex(/^[A-Z]{3,4}$/),
  paymentCurrency: z.string().regex(/^[A-Z]{3,4}$/).optional(),
  expectedDebitAmount: z.number().positive().optional(),
  passengers: z.array(passenger).min(1).max(9),
  pin: z.string().regex(/^\d{4}$/).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === "object" && !Array.isArray(v) ? (v as R) : {});
const str = (...v: unknown[]) => { for (const x of v) if (typeof x === "string" && x.trim()) return x.trim(); return ""; };
const num = (...v: unknown[]) => { for (const x of v) { const n = typeof x === "string" ? Number(x) : x; if (typeof n === "number" && Number.isFinite(n)) return n; } return NaN; };

export function parseAirports(data: unknown): Airport[] {
  const d = obj(data);
  const list = Array.isArray(data) ? data : Array.isArray(d["airports"]) ? d["airports"] : Array.isArray(d["data"]) ? d["data"] : [];
  const out: Airport[] = [];
  for (const raw of list as unknown[]) {
    const a = obj(raw);
    const code = str(a["iata_code"], a["iataCode"], a["code"], a["iata"]).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    out.push({ code, name: str(a["name"], a["airportName"]) || code, city: str(a["city_name"], a["cityName"], a["city"], obj(a["city"])["name"]), country: str(a["country"], a["iata_country_code"], a["countryCode"]) });
  }
  return out;
}

function place(v: unknown) {
  if (typeof v === "string") {
    const code = v.trim().toUpperCase();
    return { code, city: "" };
  }
  const p = obj(v);
  return {
    code: str(p["iata_code"], p["iataCode"], p["code"], p["iata"]).toUpperCase(),
    city: str(p["city_name"], p["cityName"], p["city"], obj(p["city"])["name"], p["name"])
  };
}

function parseSlice(raw: unknown): FlightSlice | null {
  const s = obj(raw);
  const rawSegs = Array.isArray(s["segments"]) ? s["segments"] : [];

  const segs = rawSegs.map((x): FlightSegment => {
    const g = obj(x);
    const rawMc = g["marketing_carrier"] ?? g["carrier"] ?? g["airline"];
    const rawOc = g["operating_carrier"];
    const mcObj = typeof rawMc === "object" ? obj(rawMc) : null;
    const ocObj = typeof rawOc === "object" ? obj(rawOc) : null;

    const carrierCode = str(
      mcObj ? mcObj["iata_code"] : null,
      typeof rawMc === "string" ? rawMc : null,
      g["carrierCode"],
      g["carrier_code"],
      ocObj ? ocObj["iata_code"] : null,
      typeof rawOc === "string" ? rawOc : null
    ).toUpperCase();

    const carrierName = str(
      mcObj ? mcObj["name"] : null,
      g["carrier_name"],
      g["carrierName"],
      g["airline_name"],
      g["airlineName"],
      ocObj ? ocObj["name"] : null
    ) || carrierCode;

    const rawFlightNum = str(
      g["flight_number"],
      g["flightNumber"],
      g["marketing_carrier_flight_number"],
      g["marketingCarrierFlightNumber"],
      g["number"]
    );

    const flightNumber = !rawFlightNum
      ? carrierCode
      : carrierCode && rawFlightNum.toUpperCase().startsWith(carrierCode)
        ? rawFlightNum.toUpperCase()
        : `${carrierCode}${rawFlightNum}`.trim();

    const fromPlace = place(g["origin"]);
    const toPlace = place(g["destination"]);

    const departAt = str(g["departing_at"], g["departAt"], g["departureTime"], g["departure_time"]);
    const arriveAt = str(g["arriving_at"], g["arriveAt"], g["arrivalTime"], g["arrival_time"]);

    return {
      from: fromPlace.code || str(g["origin_code"], g["from"]).toUpperCase(),
      to: toPlace.code || str(g["destination_code"], g["to"]).toUpperCase(),
      departAt,
      arriveAt,
      carrier: carrierName,
      flightNumber
    };
  });

  const o = place(s["origin"]);
  const d = place(s["destination"]);

  const fromCode = o.code || (segs.length > 0 ? segs[0]?.from : "") || "";
  const fromCity = o.city || "";
  const toCode = d.code || (segs.length > 0 ? segs[segs.length - 1]?.to : "") || "";
  const toCity = d.city || "";

  const departAt = str(s["departing_at"], s["departAt"], segs[0]?.departAt);
  const arriveAt = str(s["arriving_at"], s["arriveAt"], segs.length > 0 ? segs[segs.length - 1]?.arriveAt : null);

  if (!fromCode || !toCode) return null;

  const duration = str(s["duration"], s["flight_duration"]) || null;
  const stops = typeof s["stops"] === "number" ? s["stops"] : Math.max(0, segs.length - 1);

  return {
    from: fromCode,
    fromCity,
    to: toCode,
    toCity,
    departAt: departAt || new Date().toISOString(),
    arriveAt: arriveAt || new Date().toISOString(),
    duration,
    stops,
    segments: segs
  };
}

export function parseOffer(raw: unknown): FlightOffer | null {
  const f = obj(raw);
  const id = str(f["id"], f["offer_id"], f["offerId"]);
  const price = obj(f["price"]);
  const amount = num(f["total_amount"], f["totalAmount"], f["amount"], price["total"], f["base_amount"]);
  const currency = str(f["total_currency"], f["totalCurrency"], f["currency"], price["currency"], f["base_currency"]).toUpperCase();
  if (!id || !(amount > 0) || !/^[A-Z]{3,4}$/.test(currency)) return null;

  const rawSlices = Array.isArray(f["slices"]) ? f["slices"] : [];
  const slices = rawSlices.map(parseSlice).filter((s): s is FlightSlice => s !== null);
  if (!slices.length) return null;

  const rawOwner = f["owner"];
  const ownerObj = typeof rawOwner === "object" ? obj(rawOwner) : null;
  const ownerName = typeof rawOwner === "string" ? rawOwner : str(ownerObj?.["name"]);
  const ownerCode = ownerObj ? str(ownerObj["iata_code"], ownerObj["code"]) : "";

  const firstSliceSeg = slices[0]?.segments[0];
  const airline = str(
    ownerName,
    f["airline"],
    f["airlineName"],
    f["carrier"],
    f["carrier_name"],
    firstSliceSeg?.carrier
  ) || "Global Carrier";

  const airlineCode = str(
    ownerCode,
    f["airlineCode"],
    f["airline_code"],
    f["carrierCode"],
    f["carrier_code"],
    firstSliceSeg?.flightNumber?.slice(0, 2)
  ).toUpperCase() || (slices[0]?.segments[0]?.flightNumber?.slice(0, 2) || "FL");

  const rawSeg = obj((obj((f["slices"] as unknown[])[0])["segments"] as unknown[] | undefined)?.[0]);
  const rawPax = obj((rawSeg["passengers"] as unknown[] | undefined)?.[0]);
  const bags = rawPax["baggages"];
  const bagCount = Array.isArray(bags) ? bags.reduce((n: number, b) => n + (num(obj(b)["quantity"]) || 0), 0) : NaN;
  const baggagePolicy = str(f["baggagePolicy"], f["baggage"], f["baggage_policy"]);
  const baggage = baggagePolicy || (Number.isFinite(bagCount) ? (bagCount > 0 ? `${bagCount} bag${bagCount > 1 ? "s" : ""} included` : "No checked bag") : null);

  const conv = obj(f["convertedAmounts"]);
  const convertedAmounts = conv ? {
    ngn: num(conv["ngn"], f["ngnEquivalent"]) || undefined,
    usd: num(conv["usd"], f["usdEquivalent"]) || undefined,
    gbp: num(conv["gbp"], f["gbpEquivalent"]) || undefined,
    eur: num(conv["eur"], f["eurEquivalent"]) || undefined,
    usdt: num(conv["usdt"], f["usdtEquivalent"]) || undefined,
  } : undefined;

  const pList = Array.isArray(f["passengers"]) ? f["passengers"] : [];
  const passengerIds = pList.map((p) => {
    if (typeof p === "string") return p;
    return str(obj(p)["id"]);
  }).filter(Boolean);

  return {
    id,
    amount,
    currency,
    airline,
    airlineCode,
    slices,
    baggage,
    expiresAt: str(f["expires_at"], f["expiresAt"]) || null,
    passengerIds,
    convertedAmounts,
    logoUrl: str(f["logoUrl"], f["logo_url"], f["logoFallbackUrl"]) || null,
  };
}

export function parseSearch(data: unknown): FlightSearchResult {
  const root = obj(data);
  const inner = obj(root["data"]);

  const list = Array.isArray(root["offers"]) ? root["offers"]
    : Array.isArray(root["flights"]) ? root["flights"]
    : Array.isArray(inner["offers"]) ? inner["offers"]
    : Array.isArray(inner["flights"]) ? inner["flights"]
    : Array.isArray(root["data"]) ? root["data"]
    : Array.isArray(data) ? data
    : [];

  const offers = (list as unknown[]).map(parseOffer).filter((o): o is FlightOffer => !!o).sort((a, b) => a.amount - b.amount);
  const status = str(root["status"], inner["status"]).toLowerCase();
  const searchId = str(
    root["searchId"],
    root["search_id"],
    inner["searchId"],
    inner["search_id"],
    root["offer_request_id"],
    inner["offer_request_id"],
    root["id"],
    inner["id"]
  ) || null;
  const complete = ["complete", "completed", "done", "finished", "success", "succeeded"].includes(status) || (!status && list.length > 0) || (!searchId);
  return { searchId, complete, offers };
}

export type FlightOrderResult = { status: "succeeded" | "failed" | "pending"; pnr: string | null; orderId: string | null; tickets: string[] };
/** Only an explicit confirmation with a booking reference and matching fare settles a ticket. */
export function parseFlightOrder(data: unknown, expectedAmount: number, expectedCurrency: string): FlightOrderResult {
  const d = obj(data);
  const pnr = str(d["booking_reference"], d["bookingReference"], d["pnr"]) || null;
  const orderId = str(d["id"], d["orderId"], d["order_id"]) || null;
  const tickets = (Array.isArray(d["documents"]) ? d["documents"] : []).map((x) => str(obj(x)["unique_identifier"], obj(x)["number"])).filter(Boolean);
  const status = str(d["status"], d["orderStatus"]).toLowerCase();
  if (["failed", "declined", "rejected", "cancelled", "canceled", "expired"].includes(status)) return { status: "failed", pnr, orderId, tickets };
  const amt = num(d["total_amount"], d["totalAmount"], d["amount"]);
  const cur = str(d["total_currency"], d["currency"]).toUpperCase();
  const matches = (!Number.isFinite(amt) || Math.abs(amt - expectedAmount) < 0.005) && (!cur || cur === expectedCurrency);
  const confirmed = ["confirmed", "issued", "ticketed", "completed", "successful", "success", "succeeded"].includes(status) || (!status && tickets.length > 0);
  return { status: confirmed && pnr && matches ? "succeeded" : "pending", pnr, orderId, tickets };
}

export function money(amount: number, currency: string) {
  const curr = currency.toUpperCase();
  if (curr === "USDT" || curr === "USDC") {
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  }
  if (curr === "BTC") {
    return `₿${amount.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  }
  if (curr === "ETH") {
    return `Ξ${amount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 5 })}`;
  }
  try { 
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: curr, maximumFractionDigits: 2 }).format(amount); 
  } catch { 
    return `${curr} ${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`; 
  }
}

export function prettyDuration(iso: string | null) {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return iso;
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  return `${h ? `${h}h ` : ""}${m[3] ?? 0}m`.trim();
}
