import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cableCustomer, CABLE_PROVIDERS, type CableCustomer } from "@/lib/cable-tv";

type Request = (body: { provider: string; smartcardNumber: string }) => Promise<unknown>;
export function useCableCustomer(provider: string, number: string, request: Request) {
  const key = CABLE_PROVIDERS.some((p) => p.value === provider) && /^\d{10,11}$/.test(number) ? JSON.stringify([provider, number]) : "";
  const [result, setResult] = useState<{ key: string; customer: CableCustomer | null; status: "loading" | "verified" | "invalid" | "failed" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const immediate = useRef(false);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setResult({ key, customer: null, status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const customer = cableCustomer(await request({ provider: provider.toUpperCase(), smartcardNumber: number }));
        if (!cancelled) setResult({ key, customer, status: customer ? "verified" : "invalid" });
      } catch {
        if (!cancelled) setResult({ key, customer: null, status: "failed" });
      }
    }, immediate.current ? 0 : 400);
    immediate.current = false;
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, provider, number, request, attempt]);
  const current = key && result?.key === key ? result : null;
  const status = current?.status ?? (key ? "loading" : "idle");
  const retry = () => { immediate.current = true; setAttempt((n) => n + 1); };
  return { customer: current?.customer ?? null, status, retry, onBlur: () => { if (key && !current) retry(); } };
}

export function CableProviderPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <fieldset className="space-y-2"><legend className="text-xs font-bold">Provider</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {CABLE_PROVIDERS.map((provider) => <Button key={provider.value} type="button" variant={value === provider.value ? "brand" : "outline"} aria-pressed={value === provider.value} onClick={() => onChange(provider.value)} className="h-auto min-h-20 min-w-0 flex-col gap-2 rounded-lg px-2 py-3"><span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold ${provider.tint}`}>{provider.monogram}</span><span className="text-xs">{provider.label}</span></Button>)}
  </div></fieldset>;
}

export function CableCustomerLookup({ number, onChange, lookup }: { number: string; onChange: (value: string) => void; lookup: ReturnType<typeof useCableCustomer> }) {
  return <div className="space-y-3"><div className="space-y-1.5"><label htmlFor="cable-smartcard" className="text-xs font-bold">Smartcard / IUC number</label><Input id="cable-smartcard" inputMode="numeric" autoComplete="off" maxLength={11} value={number} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))} onBlur={lookup.onBlur} placeholder="10–11 digit number" className="h-11 rounded-lg" /></div>
    <div aria-live="polite">
      {lookup.status === "loading" && <div role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Verifying account…</div>}
      {(lookup.status === "invalid" || lookup.status === "failed") && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><p>{lookup.status === "invalid" ? "Invalid smartcard or IUC number. Please verify provider and number." : "Customer verification is unavailable. Please try again."}</p><Button type="button" variant="outline" size="sm" onClick={lookup.retry}>Retry verification</Button></div>}
      {lookup.customer && <div className="space-y-3 rounded-lg border border-chart-2/40 bg-chart-2/10 p-4"><p className="flex items-start gap-2 break-words text-sm font-bold text-chart-2"><Check className="mt-0.5 h-4 w-4 shrink-0" />Verified Account: {lookup.customer.customerName}</p><dl className="space-y-2 text-sm">{lookup.customer.currentPlan && <div className="flex items-start gap-2"><Tv className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Current bouquet</dt><dd className="break-words font-semibold">{lookup.customer.currentPlan}</dd></div></div>}{lookup.customer.dueDate && <div><dt className="text-xs text-muted-foreground">Expiry / due date</dt><dd className="break-words font-semibold">{lookup.customer.dueDate}</dd></div>}</dl></div>}
    </div>
  </div>;
}