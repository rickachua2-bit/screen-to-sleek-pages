import { useEffect, useState } from "react";

type Details = Record<string, unknown> & { customerName: string; address: string };
type Request = (body: { meterNumber: string; billerCode: string; itemCode: string }) => Promise<unknown>;
type Result = { key: string; status: "loading" | "verified" | "failed"; details: Details | null };

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (...values: unknown[]) => values.find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim() ?? "";

export function meterCustomer(payload: unknown): Details | null {
  const outer = record(payload);
  const data = "data" in outer ? record(outer["data"]) : outer;
  const customer = record(data["customer"]);
  if (outer["success"] === false || outer["valid"] === false || data["valid"] === false || data["success"] === false) return null;
  const customerName = text(data["customerName"], data["customer_name"], customer["name"], customer["customerName"]);
  const address = text(data["address"], data["customerAddress"], data["customer_address"], customer["address"]);
  return customerName && address ? { ...data, customerName, address } : null;
}

/** Discard responses when either the meter or electricity company changes. */
export function useMeterCustomer(meterNumber: string, billerCode: string, itemCode: string, request: Request) {
  const key = /^\d{10,13}$/.test(meterNumber) && billerCode ? JSON.stringify([meterNumber, billerCode, itemCode]) : "";
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setResult({ key, status: "loading", details: null });
    const timer = setTimeout(async () => {
      try {
        const details = meterCustomer(await request({ meterNumber, billerCode, itemCode }));
        if (!cancelled) setResult({ key, status: details ? "verified" : "failed", details });
      } catch {
        if (!cancelled) setResult({ key, status: "failed", details: null });
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, meterNumber, billerCode, itemCode, request, attempt]);
  const current = key && result?.key === key ? result : null;
  return { status: current?.status ?? (key ? "loading" : "idle"), details: current?.details ?? null, retry: () => setAttempt((n) => n + 1) };
}