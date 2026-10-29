import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Clock, Download, FileCheck2, Landmark, Loader2, LockKeyhole, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { naira } from "@/lib/api";
import { getGovernmentAssessment, getGovernmentHistory } from "@/lib/government-payments.functions";
import { governmentLookup, type GovernmentAssessment, type GovernmentService } from "@/lib/government-payments";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { paymentFailureReason, paymentFeedback } from "@/lib/payment-feedback";
import { useBankingProfile } from "./PaddleConsole";
import taxArt from "@/assets/tax-payments.jpg";

type History = Awaited<ReturnType<typeof getGovernmentHistory>>;
export function GovernmentPayments({ service }: { service: GovernmentService }) {
  const lookup = useServerFn(getGovernmentAssessment);
  const historyCall = useServerFn(getGovernmentHistory);
  const run = useServerFn(runPaddleOperation);
  const { profile, refresh } = useBankingProfile();
  const [identifier, setIdentifier] = useState("");
  const [verified, setVerified] = useState<{ key: string; data: GovernmentAssessment } | null>(null);
  const [lookupState, setLookupState] = useState("idle");
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<History>([]);
  const [historyError, setHistoryError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [step, setStep] = useState<"details" | "review" | "done">("details");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const [receipt, setReceipt] = useState<{ status: string; reference: string | null } | null>(null);
  const title = service === "firs" ? "Federal tax" : "Remita payments";
  const fieldLabel = service === "firs" ? "TIN / assessment number" : "Remita Retrieval Reference (RRR)";
  const valid = governmentLookup.safeParse({ service, identifier }).success;
  const lookupKey = JSON.stringify([service, identifier.trim(), profile?.mode]);
  const assessment = verified?.key === lookupKey ? verified.data : null;
  const balance = profile?.balances["NGN"];
  const insufficient = assessment?.total != null && balance !== undefined && assessment.total > balance;
  const pending = history.some((h) => h.identifier === identifier.trim() && ["pending", "succeeded"].includes(h.status));
  const loadHistory = async () => {
    setLoadingHistory(true); setHistoryError("");
    try { setHistory(await historyCall({ data: service })); }
    catch { setHistoryError("Payment history could not be loaded. Refresh before paying."); }
    finally { setLoadingHistory(false); }
  };
  useEffect(() => { void loadHistory(); }, [service, profile?.mode]);
  useEffect(() => {
    if (!valid || !profile) { setLookupState("idle"); return; }
    let cancelled = false; setLookupState("loading");
    const timer = setTimeout(async () => {
      try {
        const data = await lookup({ data: { service, identifier: identifier.trim() } });
        if (!cancelled) { setVerified({ key: lookupKey, data }); setLookupState("verified"); }
      } catch { if (!cancelled) setLookupState("failed"); }
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [lookupKey, valid, lookup, attempt, Boolean(profile)]);

  const pay = async () => {
    if (submitting.current || locked || !assessment?.ready || assessment.amount === null || assessment.fee === null) return;
    if (profile?.mode === "live" && !/^\d{4}$/.test(pin)) { setError("Enter your 4-digit transaction PIN."); return; }
    submitting.current = true; setBusy(true); setError("");
    key.current ??= crypto.randomUUID();
    try {
      const r = await run({ data: { id: `post-bills-${service}-pay`, body: { identifier: assessment.identifier, expectedAmount: assessment.amount, expectedFee: assessment.fee }, params: {}, currency: "NGN", pin: pin || undefined, idempotencyKey: key.current } });
      const status = r.receipt?.status ?? "pending";
      setReceipt({ status, reference: r.receipt?.reference ?? key.current }); setLocked(status === "pending"); setStep("done");
      void loadHistory(); void refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (/amount or fee has changed/.test(message)) { setError("The amount or fee changed. Verify the assessment again."); setVerified(null); setStep("details"); setAttempt((n) => n + 1); }
      else if (/assessed amount and fee/.test(message)) setError("The service hasn’t confirmed the amount and fee. Payment is unavailable.");
      else { setError(paymentFeedback(e, "transfer")); if (["uncertain", "used_reference"].includes(paymentFailureReason(e))) setLocked(true); }
      void loadHistory();
    } finally { submitting.current = false; setBusy(false); }
  };

  const download = (row: History[number]) => {
    const lines = ["SLIKPAY PAYMENT RECORD", title, `Status: ${row.status}`, `Date: ${row.createdAt}`, `Identifier: ${row.identifier}`, `Customer: ${row.name}`, `Amount: ${naira(row.amount)}`, `Fee: ${row.fee === null ? "Not recorded" : naira(row.fee)}`, `Reference: ${row.reference ?? row.key}`, ...(row.receiptNumber ? [`Service receipt number: ${row.receiptNumber}`] : []), "This is a Slikpay payment record, not an official tax clearance certificate."];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `slikpay-${service}-${row.key}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  return <section className="min-w-0 space-y-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
      <aside className="min-w-0 border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pr-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary"><Landmark className="h-4 w-4" />Government & tax</div>
        <h2 className="mt-4 text-3xl font-extrabold text-foreground">{title}</h2>
        <img src={taxArt} alt="Verified payment document and security shield" width={1024} height={768} className="mt-5 aspect-[4/3] max-h-52 w-full object-contain lg:max-h-64" />
        <ol className="mt-5 space-y-4">{["Verify assessment", "Review amount & fees", "Authorize payment"].map((s, i) => <li key={s} className="flex items-center gap-3 text-sm"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${i === (step === "details" ? 0 : step === "review" ? 1 : 2) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{i + 1}</span><span className="font-semibold text-foreground">{s}</span></li>)}</ol>
        <div className="mt-7 border-t border-border pt-5"><p className="text-xs text-muted-foreground">Available NGN balance</p><p className="mt-2 font-mono text-2xl font-bold">{balance === undefined ? "—" : naira(balance)}</p><p className="mt-2 text-xs font-semibold text-muted-foreground">{profile?.mode === "live" ? "Live wallet" : "Sandbox"}</p></div>
      </aside>
      <div className="min-w-0 py-1">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-4"><h3 className="text-lg font-bold">{step === "details" ? "Payment details" : step === "review" ? "Review payment" : "Payment record"}</h3><ShieldCheck className="h-5 w-5 text-success" /></div>
        {step !== "done" && <div className="space-y-5">
          <div><label htmlFor="government-id" className="text-xs font-bold">{fieldLabel}</label><Input id="government-id" className="mt-2 h-12 font-mono" inputMode={service === "remita" ? "numeric" : "text"} maxLength={service === "remita" ? 12 : 80} placeholder={service === "remita" ? "12-digit RRR" : "Enter your assessment identifier"} value={identifier} disabled={step === "review" || busy || locked} onChange={(e) => { setIdentifier(service === "remita" ? e.target.value.replace(/\D/g, "") : e.target.value.trim()); setError(""); }} /></div>
          <div aria-live="polite">
            {lookupState === "loading" && !assessment && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verifying customer and assessment…</p>}
            {lookupState === "failed" && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">Couldn’t verify these details. Check your identifier.</p><Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}><RefreshCw />Retry</Button></div>}
            {assessment && <div className="rounded-lg border border-success/30 bg-success-soft p-4"><p className="flex items-center gap-2 text-xs font-bold text-success"><Check className="h-4 w-4" />Customer confirmed</p><p className="mt-2 break-words font-bold text-foreground">{assessment.name}</p>{assessment.organisation && <p className="mt-1 text-sm text-body">{assessment.organisation}</p>}{assessment.dueDate && <p className="mt-2 text-xs text-body">Due {assessment.dueDate}</p>}</div>}
          </div>
          {assessment && <dl className="space-y-4 border-y border-border py-5 text-sm">{[["Assessed amount", assessment.amount === null ? "Not confirmed" : naira(assessment.amount)], ["Service fee", assessment.fee === null ? "Not confirmed" : naira(assessment.fee)], ["Total debit", assessment.total === null ? "Unavailable" : naira(assessment.total)]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono font-bold">{value}</dd></div>)}</dl>}
          {assessment && !assessment.ready && <p className="text-sm text-destructive">Payment is unavailable until the service confirms the assessed amount and exact fee.</p>}
          {insufficient && <p role="alert" className="text-sm text-destructive">Insufficient funds to cover the amount and fee.</p>}
          {pending && <p role="alert" className="text-sm text-muted-foreground">This identifier already has a submitted payment. Check its record below before paying again.</p>}
          {step === "review" && profile?.mode === "live" && <div><label htmlFor="government-pin" className="text-xs font-bold">Transaction PIN</label><Input id="government-pin" className="mt-2 h-12 font-mono" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="off" /></div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {locked && <p className="text-sm text-muted-foreground">Do not submit another payment. Refresh payment records to check for confirmation.</p>}
          <div className="flex gap-3">{step === "review" && <Button variant="outline" disabled={busy || locked} onClick={() => { setStep("details"); setPin(""); }}>Edit</Button>}<Button variant="brand" className="h-12 flex-1" disabled={busy || locked || pending || loadingHistory || Boolean(historyError) || !assessment?.ready || insufficient || balance === undefined} onClick={step === "details" ? () => setStep("review") : pay}>{busy ? <Loader2 className="animate-spin" /> : step === "details" ? <ArrowRight /> : <LockKeyhole />}{step === "details" ? "Review payment" : "Authorize payment"}</Button></div>
        </div>}
        {step === "done" && receipt && <div className="space-y-5 py-8 text-center">{receipt.status === "succeeded" ? <Check className="mx-auto h-12 w-12 text-success" /> : receipt.status === "failed" ? <X className="mx-auto h-12 w-12 text-destructive" /> : <Clock className="mx-auto h-12 w-12 text-muted-foreground" />}<h3 className="text-xl font-bold">{receipt.status === "succeeded" ? "Payment confirmed" : receipt.status === "failed" ? "Payment declined" : "Awaiting payment confirmation"}</h3><p className="font-mono text-2xl font-bold">{assessment?.total != null ? naira(assessment.total) : "—"}</p><p className="break-all text-xs text-muted-foreground">Reference: {receipt.reference}</p>{locked && <p className="text-sm text-muted-foreground">Funds remain reserved until the result is confirmed. Do not pay this obligation again.</p>}<Button variant="outline" disabled={locked} onClick={() => { setStep("details"); setIdentifier(""); setVerified(null); setPin(""); setReceipt(null); key.current = null; }}>New payment</Button></div>}
      </div>
    </div>
    <div className="border-t border-border pt-6"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><FileCheck2 className="h-5 w-5 text-primary" />Payment records</h3><Button variant="ghost" size="icon" aria-label="Refresh payment records" disabled={loadingHistory} onClick={loadHistory}><RefreshCw className={loadingHistory ? "animate-spin" : ""} /></Button></div>{historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p> : history.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{loadingHistory ? "Loading payment records…" : "No recorded payments yet."}</p> : <ul className="divide-y divide-border">{history.map((h) => <li key={h.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{h.name || h.identifier || "Payment"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()} · {h.status}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{h.reference ?? h.key}</p></div><p className="font-mono text-sm font-bold">{naira(h.amount)}</p><Button variant="outline" size="icon" aria-label={`Download payment record ${h.reference ?? h.key}`} onClick={() => download(h)}><Download /></Button></li>)}</ul>}</div>
  </section>;
}