import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { flightSearch } from "./flights";

export const getFlightHealth = createServerFn({ method: "GET" }).handler(async () => (await import("./flights.server")).flightHealth());
export const searchAirports = createServerFn({ method: "POST" }).inputValidator((d: unknown) => z.string().trim().min(2).max(60).parse(d)).handler(async ({ data }) => (await import("./flights.server")).flightAirports(data));
export const searchFlights = createServerFn({ method: "POST" }).inputValidator((d: unknown) => flightSearch.parse(d)).handler(async ({ data }) => (await import("./flights.server")).flightSearchRun(data));
export const pollFlights = createServerFn({ method: "POST" }).inputValidator((d: unknown) => z.string().min(1).max(200).parse(d)).handler(async ({ data }) => (await import("./flights.server")).flightSearchPoll(data));
export const bookFlight = createServerFn({ method: "POST" }).inputValidator((d: unknown) => d).handler(async ({ data }) => (await import("./flights.server")).flightBook(data));
export const getFlightTrips = createServerFn({ method: "GET" }).handler(async () => (await import("./flights.server")).flightTrips());
