import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Globe2, GraduationCap, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInternationalAvailability } from "@/lib/international.functions";
import { isInternationalReceipt } from "@/lib/international";
import { useBankingProfile } from "./PaddleConsole";
import { CryptoBankFunding } from "./CryptoBankFunding";

export function InternationalServices({ initial = "cross-border" }: { initial?: "cross-border" | "remittance" }) {
  const check = useServerFn(getInternationalAvailability);
  const { profile, error: profileError } = useBankingProfile();
  const [tab, setTab] = useState<"cross-border" | "remittance" | "crypto">(initial);
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof getInternationalAvailability>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError(""); setAvailability(null);
    try { setAvailability(await check()); }
    catch { setError("Could not check international services. Please retry."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [check]);
  const history = profile?.receipts.filter((r) => isInternationalReceipt(r.operation)) ?? [];
  return <section className="space-y-5" aria-label="International services">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">Cross-border & remittances</h2><p className="mt-1 text-xs text-muted-foreground">{profile ? profile.mode === "live" ? "Live account" : "Sandbox account" : "Checking account…"}</p></div>
      <Button variant="outline" size="icon" aria-label="Refresh international availability" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border pb-4" role="group" aria-label="International payment services">
      <Button variant={tab === "cross-border" ? "default" : "outline"} aria-pressed={tab === "cross-border"} onClick={() => setTab("cross-border")}><Globe2 />Cross-border</Button>
      <Button variant={tab === "remittance" ? "default" : "outline"} aria-pressed={tab === "remittance"} onClick={() => setTab("remittance")}><ArrowRight />Remittances</Button>
      <Button variant={tab === "crypto" ? "default" : "outline"} aria-pressed={tab === "crypto"} onClick={() => setTab("crypto")}><ArrowRight />Crypto to NGN bank</Button>
    </div>
    {tab === "crypto" ? <CryptoBankFunding balances={profileError ? undefined : profile?.balances} /> : <>
      <div className="flex items-start gap-4 border-l-4 border-cobalt bg-cobalt/5 p-5">
        <Globe2 className="mt-1 h-8 w-8 shrink-0 text-cobalt" />
        <div className="min-w-0"><h3 className="text-lg font-bold">{tab === "cross-border" ? "International bank payments" : "Send money abroad"}</h3>
          <p className="mt-2 font-semibold text-cobalt">Account not active yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Destinations, bank details, exchange rates, fees and payment tracking are awaiting service confirmation. No international payment will be submitted or funds reserved here.</p>
        </div>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking service availability…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {availability && <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-b border-border py-3"><Globe2 className="mb-2 h-5 w-5 text-cobalt" /><h4 className="font-bold">Global bank payouts</h4><p className="mt-1 text-xs text-muted-foreground">{availability.crossBorderListed ? "Service listed · activation pending" : "Service not listed"}</p></div>
        <div className="border-b border-border py-3"><GraduationCap className="mb-2 h-5 w-5 text-magenta" /><h4 className="font-bold">International tuition</h4><p className="mt-1 text-xs text-muted-foreground">{availability.tuitionListed ? "Service listed · activation pending" : "Service not listed"}</p></div>
      </div>}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" />Crypto cash-out is limited to USDT / USDC → NGN → Nigerian bank accounts.</p>
      <section className="border-t border-border pt-5"><h3 className="mb-3 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-cobalt" />International payment history</h3>
        {profileError ? <p role="alert" className="text-sm text-destructive">Payment history could not be confirmed. Please refresh your account.</p> : !profile ? <p className="text-sm text-muted-foreground">Loading payment history…</p> : !history.length ? <p className="text-sm text-muted-foreground">No international payments recorded.</p> : <ul className="divide-y divide-border">{history.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0 break-all font-mono">{r.provider_reference ?? r.id}</span><span>{Number(r.amount).toLocaleString()} {r.currency}</span><span className={r.status === "succeeded" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{r.status === "succeeded" ? "Completed" : r.status === "failed" ? "Failed" : "Awaiting confirmation"}</span></li>)}</ul>}
      </section>
    </>}
  </section>;
}