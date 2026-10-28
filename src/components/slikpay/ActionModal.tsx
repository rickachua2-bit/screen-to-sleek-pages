import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Copy, Loader2, Lock, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { baasService } from "@/lib/baas.functions";
import { listBanks } from "@/lib/transfers.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { quoteFee } from "@/lib/pricing.functions";
import { SERVICES } from "@/lib/services-registry";
import { useBankingProfile } from "./PaddleConsole";
import { GuidedService } from "./ServicesHub";
import { isDuplicate, rememberRecipient, type Recipient } from "@/lib/transfer-rules";

const RECENTS_KEY = "slikpay.recentRecipients";
const loadRecents = (): Recipient[] => { try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); } catch { return []; } };
const QUICK = [1000, 5000, 10000, 50000];

export type ActionKind = "send" | "bills" | "airtime" | "fund" | "swap" | "add" | "softpos";

const TITLES: Record<ActionKind, string> = {
  send: "Bank transfer", bills: "Pay utilities", airtime: "Buy airtime", fund: "Fund card", swap: "Swap currencies", add: "Add money", softpos: "Accept a card payment",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-foreground">{label}</span>{children}</label>;
}

export function ActionModal({ kind, onClose }: { kind: ActionKind; onClose: () => void }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  // Bills and airtime use the same guided, provider-backed flow as the Services hub.
  if (kind === "bills" || kind === "airtime") {
    const svc = SERVICES.find((s) => s.id === (kind === "airtime" ? "airtime" : "power"))!;
    return <GuidedService service={svc} live={live} onClose={onClose} onDone={() => undefined} />;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
      <div role="dialog" aria-label={TITLES[kind]} className="slik-popup panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">{TITLES[kind]}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        {kind === "add" ? <AddMoney /> : kind === "send" ? <SendNip live={live} onClose={onClose} balance={profile?.balances?.["NGN"]} /> : kind === "softpos" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-cyan text-sm font-bold text-body">Tap card here</div>
            <p className="text-sm font-semibold text-body">Card acceptance on this device turns on once your terminal is paired.</p>
            <Button variant="crisp" className="w-full" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="font-semibold text-body">{kind === "swap" ? "Pick a currency at the top of your dashboard and tap Swap to convert at the live rate." : "Card funding opens once a card has been issued to your account."}</p>
            <Button variant="brand" className="w-full" onClick={onClose}>Got it</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddMoney() {
  const { profile } = useBankingProfile();
  const n = profile?.virtualAccount ?? null; const d = profile?.accountDetails;
  if (!profile) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />;
  if (!n) return <p className="text-sm font-semibold text-body">Your account number is issued automatically once verification is complete.</p>;
  const share = [d?.accountName, d?.bankName, n].filter(Boolean).join(" · ");
  return <div className="space-y-3 text-sm">
    <p className="font-semibold text-body">Transfer to your dedicated account from any bank:</p>
    <div className="rounded-xl border-2 border-border p-4">
      <div className="font-mono text-2xl font-bold text-foreground">{n.slice(0, 4)} {n.slice(4, 8)} {n.slice(8)}</div>
      {d?.accountName && <div className="font-semibold text-foreground">{d.accountName}</div>}
      {d?.bankName && <div className="font-semibold text-muted-foreground">{d.bankName}</div>}
    </div>
    <Button variant="brand" className="w-full" onClick={async () => { try { await navigator.clipboard.writeText(share); toast.success("Account details copied"); } catch { toast.error("Copy unavailable"); } }}><Copy />Copy details</Button>
  </div>;
}

export function SendNip({ live, onClose, balance }: { live: boolean; onClose: () => void; balance?: number | undefined }) {
  const banksFn = useServerFn(listBanks); const resolve = useServerFn(baasService); const run = useServerFn(runPaddleOperation); const feeFn = useServerFn(quoteFee);
  const [banks, setBanks] = useState<{ code: string; name: string }[] | null>(null);
  const [q, setQ] = useState(""); const [bank, setBank] = useState<{ code: string; name: string } | null>(null);
  const [acct, setAcct] = useState(""); const [name, setName] = useState(""); const [lookup, setLookup] = useState("");
  const [amount, setAmount] = useState(""); const [narration, setNarration] = useState("");
  const [fee, setFee] = useState<string>(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const [recents, setRecents] = useState<Recipient[]>([]);
  useEffect(() => { setRecents(loadRecents()); }, []);
  const pick = (r: Recipient) => { setBank({ code: r.bankCode, name: r.bankName }); setAcct(r.account); };
  useEffect(() => { banksFn().then(setBanks).catch(() => setBanks([])); }, [banksFn]);
  useEffect(() => {
    let on = true; setName(""); setLookup("");
    if (!bank || acct.length !== 10) return;
    setLookup("Checking account…");
    resolve({ data: { operation: "resolve-account", bankCode: bank.code, accountNumber: acct } }).then((r) => { if (on) { setName(r.accountName); setLookup(""); } }).catch((e) => on && setLookup(e instanceof Error ? e.message : "Account lookup failed."));
    return () => { on = false; };
  }, [bank, acct, resolve]);
  const amt = Number(amount);
  const filtered = useMemo(() => (banks ?? []).filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8), [banks, q]);
  const review = async () => { setStep("review"); setFee("Calculating…"); try { const r = await feeFn({ data: { rail: "payouts", amount: amt } }); setFee(r ? naira(r.fee) : "Shown on receipt"); } catch { setFee("Shown on receipt"); } };
  const send = async () => {
    if (live && !/^\d{4}$/.test(pin)) { toast.error("Enter your 4-digit transaction PIN."); return; }
    setBusy(true);
    try {
      const r = await run({ data: { id: "post-payouts-transfer", params: {}, body: { amount: amt, destinationBankCode: bank!.code, destinationAccountNumber: acct, destinationAccountName: name, narration: narration || undefined, reference: key }, idempotencyKey: key, currency: "NGN", ...(pin ? { pin } : {}) } });
      setRef(r.receipt?.reference ?? null); setStep("done");
      const next = rememberRecipient(recents, { bankCode: bank!.code, bankName: bank!.name, account: acct, name, amount: amt, at: Date.now() });
      setRecents(next); try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* storage full */ }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer failed. No money was taken."); } finally { setBusy(false); }
  };
  if (step === "done") {
    const text = `Slikpay transfer receipt\n${naira(amt)} to ${name}\n${bank!.name} · ${acct}${ref ? `\nReference ${ref}` : ""}`;
    return <div className="py-2 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" /><p className="mt-3 text-lg font-bold text-foreground">{naira(amt)} sent to {name}</p>
      <ol className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm">{[["Payment authorised", true], ["Sent to " + bank!.name, true], ["Arrival confirmed by bank", false]].map(([l, ok]) => <li key={String(l)} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : "animate-pulse bg-cyan"}`} /><span className={ok ? "font-semibold text-foreground" : "text-muted-foreground"}>{l}</span></li>)}</ol>
      {ref && <p className="mt-3 text-xs text-muted-foreground">Reference <span className="font-mono">{ref}</span></p>}
      <div className="mt-5 flex gap-2"><Button variant="crisp" className="flex-1" onClick={async () => { try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); } } catch { /* cancelled */ } }}>Share</Button><Button variant="crisp" className="flex-1" onClick={() => window.print()}>Print</Button></div>
      <Button variant="brand" className="mt-2 w-full" onClick={onClose}>Done</Button></div>;
  }
  if (step === "review") return <div className="space-y-4">
    <dl className="space-y-2 rounded-xl border border-border p-4 text-sm">{[["To", name], ["Bank", bank!.name], ["Account", acct], ["Amount", naira(amt)], ["Fee", fee], ...(narration ? [["Note", narration]] : [])].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-bold">{v}</dd></div>)}</dl>
    {live && <input className="field text-center font-mono tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} placeholder="PIN" aria-label="Transaction PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />}
    <div className="flex gap-2"><Button variant="crisp" onClick={() => setStep("form")}>Edit</Button><Button variant="brand" className="flex-1" disabled={busy} onClick={send}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Send {naira(amt)}</Button></div>
  </div>;
  const short = balance !== undefined && amt > balance;
  const dup = name && amt > 0 && isDuplicate(recents, { account: acct, amount: amt });
  return <div className="space-y-4">
    {recents.length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent recipients</p><div className="flex gap-3 overflow-x-auto pb-1">{recents.map((r) => <button key={r.account} type="button" onClick={() => pick(r)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan text-sm font-bold text-primary-foreground">{r.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}</span><span className="w-full truncate text-[11px] font-semibold text-foreground">{r.name.split(" ")[0]}</span></button>)}</div></div>}
    <Field label="Recipient bank">
      {bank ? <button type="button" onClick={() => setBank(null)} className="field flex items-center justify-between text-left"><span className="font-bold">{bank.name}</span><span className="text-xs text-cyan">Change</span></button> : <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input className="field pl-9" placeholder={banks ? `Search ${banks.length} banks` : "Loading banks…"} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <ul className="mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-popover">{filtered.map((b) => <li key={b.code}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setBank(b); setQ(""); }}>{b.name}</button></li>)}{!filtered.length && <li className="px-3 py-2 text-xs text-muted-foreground">No bank matches.</li>}</ul>}
      </div>}
    </Field>
    <Field label="Account number"><input className="field font-mono" inputMode="numeric" maxLength={10} placeholder="0123456789" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} /></Field>
    {name ? <div className="rounded-lg bg-success-soft px-3 py-2 text-sm font-bold text-success">{name}</div> : lookup && <p role="status" className="text-xs text-muted-foreground">{lookup}</p>}
    <Field label="Amount (NGN)"><input className="field" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /><div className="mt-2 flex flex-wrap gap-2">{QUICK.map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-border px-3 py-1 text-xs font-bold text-foreground hover:border-primary">{naira(v)}</button>)}</div></Field>
    <Field label="Note (optional)"><input className="field" maxLength={60} value={narration} onChange={(e) => setNarration(e.target.value)} /></Field>
    {balance !== undefined && <p className="text-xs text-muted-foreground">Available: <span className="font-bold text-foreground">{naira(balance)}</span></p>}
    {short && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">This is more than your available balance.</p>}
    {dup && <p role="alert" className="rounded-lg bg-warning/15 px-3 py-2 text-xs font-semibold text-foreground">You sent this exact amount to this account a few minutes ago. Check before sending again.</p>}
    <Button variant="brand" className="h-11 w-full" disabled={!name || !(amt > 0) || short} onClick={review}>Review transfer</Button>
  </div>;
}
