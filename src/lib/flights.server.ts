import { bankingUser, callPaddle } from "./paddle.server";
import { guardMoney, settleMoney } from "./wallets.server";
import { FLIGHT_ORDER_OP, flightBooking, flightSearch, parseAirports, parseFlightOrder, parseSearch } from "./flights";
import { liveFxRates } from "./global-payout.server";
import { quoteSwap } from "./pricing";
import type { z } from "zod";

async function travelUser() {
  const ctx = await bankingUser();
  if (ctx.mode === "live" && ctx.review !== "approved") throw new Error("Complete verification before booking live flights.");
  return ctx;
}

export async function flightHealth() {
  const ctx = await bankingUser();
  try { const r = await callPaddle(ctx.mode, "GET", "/v1/flights/health"); const s = String((r.data as Record<string, unknown> | null)?.["status"] ?? "").toLowerCase(); return { online: !s || ["ok", "online", "healthy", "up", "operational"].includes(s), mode: ctx.mode }; }
  catch { return { online: false, mode: ctx.mode }; }
}

export async function flightAirports(search: string) {
  const ctx = await bankingUser();
  const r = await callPaddle(ctx.mode, "GET", "/v1/flights/airports", { search, limit: 15 });
  return parseAirports(r.data);
}

export async function flightSearchRun(input: z.infer<typeof flightSearch>) {
  const ctx = await bankingUser();
  const r = await callPaddle(ctx.mode, "POST", "/v1/flights/search", { ...input, waitForResults: true, timeoutMs: 25000 });
  return parseSearch(r.data);
}

export async function flightSearchPoll(searchId: string) {
  const ctx = await bankingUser();
  const r = await callPaddle(ctx.mode, "GET", `/v1/flights/search/${encodeURIComponent(searchId)}`);
  const res = parseSearch(r.data);
  return { ...res, searchId: res.searchId ?? searchId };
}

export async function flightBook(raw: unknown) {
  const input = flightBooking.parse(raw);
  const ctx = await travelUser();
  // Re-read the provider's fare: the displayed price must still be the price charged.
  const poll = await callPaddle(ctx.mode, "GET", `/v1/flights/search/${encodeURIComponent(input.searchId)}`);
  const offer = parseSearch(poll.data).offers.find((o) => o.id === input.offerId);
  if (!offer) throw new Error("This fare is no longer available. Search again.");
  if (offer.amount !== input.expectedAmount || offer.currency !== input.expectedCurrency) throw new Error("The fare has changed. Review the new price before booking.");
  if (offer.expiresAt && Date.parse(offer.expiresAt) < Date.now()) throw new Error("This fare has expired. Search again.");

  // Multi-currency wallet payment:
  const payCur = (input.paymentCurrency || offer.currency).toUpperCase();
  let debitAmount = offer.amount;
  if (payCur !== offer.currency) {
    const fx = await liveFxRates(ctx.mode).catch(() => null);
    if (fx) {
      const q = quoteSwap(offer.currency, payCur, offer.amount, fx);
      if (q && q.amount > 0) {
        debitAmount = Math.round(q.amount * 100) / 100;
      }
    }
  }

  await guardMoney(ctx, payCur, debitAmount, input.pin, FLIGHT_ORDER_OP, input.idempotencyKey);
  const s0 = offer.slices[0]!;
  const summary = { 
    offerId: offer.id, 
    principal: offer.amount, 
    currency: offer.currency, 
    paymentCurrency: payCur, 
    paymentAmount: debitAmount, 
    airline: offer.airline, 
    route: offer.slices.map((s) => `${s.from}-${s.to}`).join(" / "), 
    departAt: s0.departAt, 
    passengers: input.passengers.map((p) => `${p.givenName} ${p.familyName}`) 
  };
  const saved = await ctx.db.from("payment_receipts").update({ summary }).eq("user_id", ctx.user.id).eq("idempotency_key", input.idempotencyKey);
  if (saved.error) { await settleMoney(ctx, input.idempotencyKey, "failed", null, summary); throw new Error("Booking could not be prepared. You were not charged."); }
  const passengers = input.passengers.map((p, i) => ({
    ...(offer.passengerIds[i] ? { id: offer.passengerIds[i] } : {}),
    type: "adult", title: p.title, given_name: p.givenName, family_name: p.familyName, born_on: p.bornOn, gender: p.gender, email: p.email, phone_number: p.phone,
    ...(p.passport ? { identity_documents: [{ type: "passport", unique_identifier: p.passport }] } : {}),
  }));
  try {
    const r = await callPaddle(ctx.mode, "POST", "/v1/flights/orders", { offer_id: offer.id, amount: offer.amount, currency: offer.currency, clientReference: input.idempotencyKey, passengers }, input.idempotencyKey);
    const res = parseFlightOrder(r.data, offer.amount, offer.currency);
    const full = { ...summary, pnr: res.pnr, orderId: res.orderId, tickets: res.tickets };
    await settleMoney(ctx, input.idempotencyKey, res.status, res.orderId ?? res.pnr, full);
    return { status: res.status, ...full };
  } catch { throw new Error("Ticket status could not be confirmed. Funds remain reserved. Check My trips; do not book again."); }
}

export async function flightTrips() {
  const { db, user, mode } = await bankingUser();
  const r = await db.from("payment_receipts").select("idempotency_key, status, amount, provider_reference, created_at, summary").eq("user_id", user.id).eq("mode", mode).eq("operation", FLIGHT_ORDER_OP).order("created_at", { ascending: false }).limit(50);
  if (r.error) throw new Error("Your trips are unavailable right now.");
  return (r.data ?? []).map((row) => {
    const s = (row.summary ?? {}) as Record<string, unknown>;
    return { 
      key: String(row.idempotency_key), 
      status: String(row.status), 
      amount: Number(s["paymentAmount"] ?? s["principal"] ?? row.amount), 
      currency: String(s["paymentCurrency"] ?? s["currency"] ?? "NGN"), 
      createdAt: String(row.created_at), 
      airline: String(s["airline"] ?? ""), 
      route: String(s["route"] ?? ""), 
      departAt: String(s["departAt"] ?? ""), 
      pnr: typeof s["pnr"] === "string" ? s["pnr"] : null, 
      tickets: Array.isArray(s["tickets"]) ? (s["tickets"] as string[]) : [], 
      passengers: Array.isArray(s["passengers"]) ? (s["passengers"] as string[]) : [] 
    };
  });
}
