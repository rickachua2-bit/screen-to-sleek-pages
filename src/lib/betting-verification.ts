import { useEffect, useState } from "react";
import { bettingCustomer, bettingCustomerBody } from "./betting";

type Body = { operator: string; customerId: string };
type Customer = NonNullable<ReturnType<typeof bettingCustomer>>;
export function useBettingCustomer(operator: string, customerId: string, request: (body: Body) => Promise<unknown>) {
  const parsed = bettingCustomerBody.safeParse({ operator, customerId });
  const body = parsed.success ? parsed.data : null;
  const key = body ? JSON.stringify(body) : "";
  const [result, setResult] = useState<{ key: string; customer: Customer | null; status: "loading" | "verified" | "failed" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return;
    const input: Body = JSON.parse(key);
    let cancelled = false;
    setResult({ key, customer: null, status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const customer = bettingCustomer(await request(input), input);
        if (!cancelled) setResult({ key, customer, status: customer ? "verified" : "failed" });
      } catch { if (!cancelled) setResult({ key, customer: null, status: "failed" }); }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, request, attempt]);
  const current = result?.key === key ? result : null;
  return { customer: current?.customer ?? null, status: current?.status ?? (key ? "loading" : "idle"), retry: () => setAttempt((n) => n + 1) };
}