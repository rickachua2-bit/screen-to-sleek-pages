import { describe, expect, it } from "vitest";
import { parseFlightOrder, parseSearch } from "@/lib/flights";

const offer = { id: "off_1", total_amount: "439.62", total_currency: "USD", owner: { name: "Air X", iata_code: "AX" }, slices: [{ origin: { iata_code: "LOS" }, destination: { iata_code: "LHR" }, duration: "PT6H30M", segments: [{ origin: { iata_code: "LOS" }, destination: { iata_code: "LHR" }, departing_at: "2026-11-20T23:00:00", arriving_at: "2026-11-21T05:30:00", marketing_carrier: { iata_code: "AX" }, marketing_carrier_flight_number: "101" }] }] };

describe("flight parsing", () => {
  it("keeps only offers with a real provider price", () => {
    const r = parseSearch({ offers: [offer, { ...offer, id: "off_2", total_amount: null }] });
    expect(r.offers.map((o) => o.id)).toEqual(["off_1"]);
    expect(r.offers[0]!.amount).toBe(439.62);
  });
  it("never invents fares when the provider returns none", () => {
    expect(parseSearch({ offers: [] }).offers).toEqual([]);
  });
  it("settles a ticket only with confirmation, PNR and matching fare", () => {
    expect(parseFlightOrder({ status: "confirmed", booking_reference: "ABC123", total_amount: "439.62", total_currency: "USD" }, 439.62, "USD").status).toBe("succeeded");
    expect(parseFlightOrder({ status: "confirmed", booking_reference: "ABC123", total_amount: "500", total_currency: "USD" }, 439.62, "USD").status).toBe("pending");
    expect(parseFlightOrder({ status: "confirmed" }, 439.62, "USD").status).toBe("pending");
    expect(parseFlightOrder({ status: "failed" }, 439.62, "USD").status).toBe("failed");
  });
});
