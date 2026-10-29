import { z } from "zod";

/** Shared flight types and strict parsers. Never invent fares, carriers or tickets. */
export const FLIGHT_ORDER_OP = "POST /v1/flights/orders";
export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export type Cabin = (typeof CABINS)[number];

export type Airport = { code: string; name: string; city: string; country: string };
export type FlightSegment = { from: string; to: string; departAt: string; arriveAt: string; carrier: string; flightNumber: string };
export type FlightSlice = { from: string; fromCity: string; to: string; toCity: string; departAt: string; arriveAt: string; duration: string | null; stops: number; segments: FlightSegment[] };
export type FlightOffer = { id: string; amount: number; currency: string; airline: string; airlineCode: string; slices: FlightSlice[]; baggage: string | null; expiresAt: string | null; passengerIds: string[] };
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

function place(v: unknown) { const p = obj(v); return { code: str(p["iata_code"], p["code"], typeof v === "string" ? v : "").toUpperCase(), city: str(p["city_name"], p["city"], p["name"]) }; }

function parseSlice(raw: unknown): FlightSlice | null {
  const s = obj(raw);
  const segs = (Array.isArray(s["segments"]) ? s["segments"] : []).map((x): FlightSegment => {
    const g = obj(x); const c = obj(g["marketing_carrier"] ?? g["operating_carrier"]);
    const code = str(c["iata_code"], g["carrierCode"]);
    return { from: place(g["origin"]).code, to: place(g["destination"]).code, departAt: str(g["departing_at"], g["departureTime"]), arriveAt: str(g["arriving_at"], g["arrivalTime"]), carrier: str(c["name"], g["carrier"]) || code, flightNumber: `${code}${str(g["marketing_carrier_flight_number"], g["flightNumber"])}` };
  });
  const o = place(s["origin"]), d = place(s["destination"]);
  const departAt = str(segs[0]?.departAt, s["departing_at"]), arriveAt = str(segs[segs.length - 1]?.arriveAt, s["arriving_at"]);
  if (!o.code || !d.code || !departAt || !arriveAt) return null;
  return { from: o.code, fromCity: o.city, to: d.code, toCity: d.city, departAt, arriveAt, duration: str(s["duration"]) || null, stops: Math.max(0, segs.length - 1), segments: segs };
}

export function parseOffer(raw: unknown): FlightOffer | null {
  const f = obj(raw);
  const id = str(f["id"], f["offer_id"], f["offerId"]);
  const price = obj(f["price"]);
  const amount = num(f["total_amount"], f["totalAmount"], f["amount"], price["total"]);
  const currency = str(f["total_currency"], f["totalCurrency"], f["currency"], price["currency"]).toUpperCase();
  if (!id || !(amount > 0) || !/^[A-Z]{3,4}$/.test(currency)) return null;
  const slices = (Array.isArray(f["slices"]) ? f["slices"] : []).map(parseSlice);
  if (!slices.length || slices.some((s) => !s)) return null;
  const owner = obj(f["owner"]);
  const bags = (obj(obj((obj(slices[0] && (f["slices"] as unknown[])[0])["segments"] as unknown[] | undefined)?.[0] ?? {})["passengers"] as unknown[] | undefined)?.[0]) ?? {})["baggages"];
  const bagCount = Array.isArray(bags) ? bags.reduce((n: number, b) => n + (num(obj(b)["quantity"]) || 0), 0) : NaN;
  return {
    id, amount, currency,
    airline: str(owner["name"], f["airlineName"], f["airline"]) || (slices[0]!.segments[0]?.carrier ?? ""),
    airlineCode: str(owner["iata_code"], f["airlineCode"]),
    slices: slices as FlightSlice[],
    baggage: Number.isFinite(bagCount) ? (bagCount > 0 ? `${bagCount} bag${bagCount > 1 ? "s" : ""} included` : "No checked bag") : null,
    expiresAt: str(f["expires_at"], f["expiresAt"]) || null,
    passengerIds: (Array.isArray(f["passengers"]) ? f["passengers"] : []).map((p) => str(obj(p)["id"])).filter(Boolean),
  };
}

export function parseSearch(data: unknown): FlightSearchResult {
  const d = obj(data);
  const list = Array.isArray(d["offers"]) ? d["offers"] : Array.isArray(d["flights"]) ? d["flights"] : Array.isArray(data) ? data : [];
  const offers = (list as unknown[]).map(parseOffer).filter((o): o is FlightOffer => !!o).sort((a, b) => a.amount - b.amount);
  const status = str(d["status"]).toLowerCase();
  const searchId = str(d["searchId"], d["search_id"], d["offer_request_id"], d["id"]) || null;
  const complete = ["complete", "completed", "done", "finished", "success", "succeeded"].includes(status) || (!status && (list as unknown[]).length > 0) || (!searchId);
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
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`; }
}
export function prettyDuration(iso: string | null) {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return iso;
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  return `${h ? `${h}h ` : ""}${m[3] ?? 0}m`.trim();
}
