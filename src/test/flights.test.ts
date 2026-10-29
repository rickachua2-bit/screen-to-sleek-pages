import { describe, expect, it } from "vitest";
import { parseFlightOrder, parseSearch } from "@/lib/flights";

const legacyOffer = {
  id: "off_1",
  total_amount: "439.62",
  total_currency: "USD",
  owner: { name: "Air X", iata_code: "AX" },
  slices: [{
    origin: { iata_code: "LOS" },
    destination: { iata_code: "LHR" },
    duration: "PT6H30M",
    segments: [{
      origin: { iata_code: "LOS" },
      destination: { iata_code: "LHR" },
      departing_at: "2026-11-20T23:00:00",
      arriving_at: "2026-11-21T05:30:00",
      marketing_carrier: { iata_code: "AX" },
      marketing_carrier_flight_number: "101"
    }]
  }]
};

// Real upstream BaaS/Duffel response structure (string carriers, slice destination derived from last segment)
const upstreamBaaSResponse = {
  success: true,
  data: {
    searchId: "a92ae398-3e1d-4955-8a70-bf342c8bb80f",
    status: "succeeded",
    flightsCount: 2,
    flights: [
      {
        id: "off_034n2YBUkNUPtjJ0UOIYqm",
        owner: "Royal Air Maroc",
        total_amount: "372.60",
        total_currency: "EUR",
        slices: [
          {
            origin: "LOS",
            duration: "PT22H55M",
            segments: [
              {
                origin: "LOS",
                destination: "CMN",
                departing_at: "2026-11-20T19:05:00",
                arriving_at: "2026-11-20T22:50:00",
                flight_number: "0556",
                marketing_carrier: "AT",
                cabin: "economy"
              },
              {
                origin: "CMN",
                destination: "LHR",
                departing_at: "2026-11-21T14:40:00",
                arriving_at: "2026-11-21T18:00:00",
                flight_number: "0502",
                marketing_carrier: "AT",
                cabin: "economy"
              }
            ]
          }
        ]
      },
      {
        id: "off_direct_ba_123",
        owner: "British Airways",
        total_amount: "890.00",
        total_currency: "GBP",
        slices: [
          {
            origin: "LOS",
            destination: "LHR",
            duration: "PT6H30M",
            segments: [
              {
                origin: "LOS",
                destination: "LHR",
                departing_at: "2026-11-20T22:30:00",
                arriving_at: "2026-11-21T05:00:00",
                flight_number: "0074",
                marketing_carrier: "BA",
                cabin: "economy"
              }
            ]
          }
        ]
      }
    ]
  }
};

describe("flight parsing", () => {
  it("keeps only offers with a real provider price", () => {
    const r = parseSearch({ offers: [legacyOffer, { ...legacyOffer, id: "off_2", total_amount: null }] });
    expect(r.offers.map((o) => o.id)).toEqual(["off_1"]);
    expect(r.offers[0]!.amount).toBe(439.62);
  });

  it("never invents fares when the provider returns none", () => {
    expect(parseSearch({ offers: [] }).offers).toEqual([]);
  });

  it("robustly parses real-world upstream BaaS flight payloads with string owners and multi-leg slices", () => {
    const r = parseSearch(upstreamBaaSResponse);
    expect(r.complete).toBe(true);
    expect(r.searchId).toBe("a92ae398-3e1d-4955-8a70-bf342c8bb80f");
    expect(r.offers.length).toBe(2);

    const first = r.offers[0]!;
    expect(first.id).toBe("off_034n2YBUkNUPtjJ0UOIYqm");
    expect(first.airline).toBe("Royal Air Maroc");
    expect(first.airlineCode).toBe("AT");
    expect(first.currency).toBe("EUR");
    expect(first.amount).toBe(372.60);
    expect(first.slices.length).toBe(1);
    expect(first.slices[0]!.from).toBe("LOS");
    expect(first.slices[0]!.to).toBe("LHR");
    expect(first.slices[0]!.stops).toBe(1);
    expect(first.slices[0]!.segments.length).toBe(2);
    expect(first.slices[0]!.segments[0]!.flightNumber).toBe("AT0556");
    expect(first.slices[0]!.segments[0]!.layoverAfterMinutes).toBe(950);
    expect(first.slices[0]!.segments[0]!.layoverAirport).toBe("CMN");
    expect(first.slices[0]!.segments[1]!.flightNumber).toBe("AT0502");
    expect(first.baggageDetails).toBeDefined();
    expect(first.fareFlexibility).toBeDefined();

    const direct = r.offers[1]!;
    expect(direct.id).toBe("off_direct_ba_123");
    expect(direct.airline).toBe("British Airways");
    expect(direct.airlineCode).toBe("BA");
    expect(direct.amount).toBe(890.00);
    expect(direct.currency).toBe("GBP");
    expect(direct.slices[0]!.stops).toBe(0);
  });

  it("settles a ticket only with confirmation, PNR and matching fare", () => {
    expect(parseFlightOrder({ status: "confirmed", booking_reference: "ABC123", total_amount: "439.62", total_currency: "USD" }, 439.62, "USD").status).toBe("succeeded");
    expect(parseFlightOrder({ status: "confirmed", booking_reference: "ABC123", total_amount: "500", total_currency: "USD" }, 439.62, "USD").status).toBe("pending");
    expect(parseFlightOrder({ status: "confirmed" }, 439.62, "USD").status).toBe("pending");
    expect(parseFlightOrder({ status: "failed" }, 439.62, "USD").status).toBe("failed");
  });
});
