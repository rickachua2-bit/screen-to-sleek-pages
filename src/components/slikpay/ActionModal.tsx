import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Copy, Loader2, Lock, Search, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { baasService } from "@/lib/baas.functions";
import { listBanks } from "@/lib/transfers.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { RecipientBankPicker } from "./RecipientBankPicker";
import { validTransferAmount } from "@/lib/transfer-validation";
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
    const svc = SERVICES.find((s) => s.id === (kind === "airtime" ? "airtime" : "power"));
    if (!svc) return null;
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

export type TransferPreview = { amount: number; name: string; bank: string; account: string; fee: string; step: "form" | "review" | "done" };

export function SendNip({ live, onClose, balance, onPreviewChange }: { live: boolean; onClose: () => void; balance?: number | undefined; onPreviewChange?: (preview: TransferPreview) => void }) {
  const banksFn = useServerFn(listBanks); const resolve = useServerFn(baasService); const run = useServerFn(runPaddleOperation); const feeFn = useServerFn(quoteFee);
  const [banks, setBanks] = useState<{ code: string; name: string }[] | null>(null);
  const [bank, setBank] = useState<{ code: string; name: string } | null>(null);
  const [acct, setAcct] = useState(""); const [name, setName] = useState(""); const [lookup, setLookup] = useState("");
  const [amount, setAmount] = useState(""); const [narration, setNarration] = useState("");
  const [fee, setFee] = useState<string>(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<string | null>(null);
  const sending = useRef(false);
  const [bankError, setBankError] = useState("");
  const [feeValue, setFeeValue] = useState<number | null>(null);
  const [feeBusy, setFeeBusy] = useState(false);
  // Live fee shown while the user types, before they reach the review step.
  const [formFee, setFormFee] = useState<{ fee: number; description: string } | null>(null);
  const [formFeeBusy, setFormFeeBusy] = useState(false);
  // A flat fee confirmed by the provider is reused for every amount until the modal closes.
  const flatFee = useRef<number | null>(null);
  const [resultStatus, setResultStatus] = useState("pending");
  const [key] = useState(() => crypto.randomUUID());
  const [recents, setRecents] = useState<Recipient[]>([]);
  useEffect(() => { setRecents(loadRecents()); }, []);
  const pick = (r: Recipient) => { setBank({ code: r.bankCode, name: r.bankName }); setAcct(r.account); };
  const loadBanks = () => { setBankError(""); setBanks(null); banksFn().then((rows) => { setBanks(rows); if (!rows.length) setBankError("No supported banks returned. Retry loading."); }).catch(() => { setBanks([]); setBankError("Could not load banks. Please retry."); }); };
  useEffect(() => { loadBanks(); }, [banksFn]);
  useEffect(() => {
    let on = true; setName(""); setLookup("");
    if (!bank || acct.length !== 10) return;
    setLookup("Checking account…");
    resolve({ data: { operation: "resolve-account", bankCode: bank.code, accountNumber: acct } }).then((r) => { if (on) { setName(r.accountName); setLookup(""); } }).catch((e) => on && setLookup(e instanceof Error ? e.message : "Account lookup failed."));
    return () => { on = false; };
  }, [bank, acct, resolve]);
  const amt = Number(amount);
  useEffect(() => { onPreviewChange?.({ amount: Number.isFinite(amt) ? amt : 0, name, bank: bank?.name ?? "", account: acct, fee, step }); }, [amt, name, bank, acct, fee, step, onPreviewChange]);
  const review = async () => {
    if (!bank || !name || !validTransferAmount(amount)) return;
    setStep("review"); setFeeBusy(true);
    // The provider prices NIP payouts flat per transfer, so one confirmed quote stays good for any amount.
    if (flatFee.current !== null) { setFee(naira(flatFee.current)); setFeeValue(flatFee.current); setFeeBusy(false); return; }
    setFee("Calculating…"); setFeeValue(null);
    try { const r = await feeFn({ data: { rail: "payouts", amount: amt } }); if (!r || !Number.isFinite(r.fee) || r.fee < 0) throw new Error(); if (r.flat) flatFee.current = r.fee; setFee(naira(r.fee)); setFeeValue(r.fee); }
    catch { setFee("Unavailable — retry before sending"); } finally { setFeeBusy(false); }
  };
  const send = async () => {
    if (live && !/^\d{4}$/.test(pin)) { toast.error("Enter your 4-digit transaction PIN."); return; }
    if (!bank || !name || !validTransferAmount(amount) || feeValue === null || sending.current || (balance !== undefined && amt + feeValue > balance)) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await run({ data: { id: "post-payouts-transfer", params: {}, body: { amount: amt, destinationBankCode: bank?.code, destinationAccountNumber: acct, destinationAccountName: name, narration: narration || undefined, reference: key }, idempotencyKey: key, currency: "NGN", ...(pin ? { pin } : {}) } });
      if (!r.receipt) throw new Error("Transfer response is unavailable. Check your ledger before retrying.");
      setRef(r.receipt.reference ?? null); setResultStatus(r.receipt.status ?? "pending"); setStep("done");
      const next = rememberRecipient(recents, { bankCode: bank?.code, bankName: bank?.name, account: acct, name, amount: amt, at: Date.now() });
      setRecents(next); try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* storage full */ }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer status is unavailable. Check your ledger before retrying."); } finally { sending.current = false; setBusy(false); }
  };
  if (step === "done") {
    const text = `Slikpay transfer receipt\n${naira(amt)} to ${name}\n${bank?.name} · ${acct}${ref ? `\nReference ${ref}` : ""}`;
    return <div className="print-area py-2 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" /><p className="mt-3 text-lg font-bold text-foreground">{naira(amt)} {resultStatus === "succeeded" ? "sent to" : resultStatus === "failed" ? "not sent to" : "submitted for"} {name}</p>
      <p role="status" className="mt-3 text-sm text-muted-foreground">{resultStatus === "succeeded" ? "The bank confirmed this transfer." : resultStatus === "failed" ? "The bank declined this transfer. Check your ledger for the final balance." : "Awaiting bank confirmation. Check your ledger before sending again."}</p>
      {ref && <p className="mt-3 text-xs text-muted-foreground">Reference <span className="font-mono">{ref}</span></p>}
      <div className="mt-5 flex gap-2"><Button variant="crisp" className="flex-1" onClick={async () => { try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); } } catch { /* cancelled */ } }}>Share</Button><Button variant="crisp" className="flex-1" onClick={() => window.print()}>Print</Button></div>
      <Button variant="brand" className="mt-2 w-full" onClick={onClose}>Done</Button></div>;
  }
  if (step === "review") return <div className="space-y-4">
    <dl className="space-y-2 rounded-xl border border-border p-4 text-sm">{[["To", name], ["Bank", bank?.name], ["Account", acct], ["Amount", naira(amt)], ["Fee", fee], ...(feeValue !== null ? [["Total debit", naira(amt + feeValue)]] : []), ...(narration ? [["Note", narration]] : [])].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-bold">{v}</dd></div>)}</dl>
    {live && <input className="field text-center font-mono tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} placeholder="PIN" aria-label="Transaction PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />}
    {feeValue !== null && balance !== undefined && amt + feeValue > balance && <p role="alert" className="text-sm text-destructive">Insufficient balance including the transfer fee.</p>}
    {feeValue === null && !feeBusy && <Button variant="outline" onClick={review}>Retry fee quote</Button>}
    <div className="flex gap-2"><Button variant="crisp" disabled={busy} onClick={() => setStep("form")}>Edit</Button><Button variant="brand" className="flex-1" disabled={busy || feeBusy || feeValue === null || (live && !/^\d{4}$/.test(pin)) || (balance !== undefined && amt + (feeValue ?? 0) > balance)} onClick={send}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Send {naira(amt)}</Button></div>
  </div>;
  const short = balance !== undefined && amt > balance;
  const dup = name && amt > 0 && isDuplicate(recents, { account: acct, amount: amt });
  return <div className="transfer-fields space-y-4">
    {recents.length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent recipients</p><div className="flex gap-3 overflow-x-auto pb-1">{recents.map((r) => <Button variant="ghost" key={r.account} type="button" onClick={() => pick(r)} className="h-auto w-16 shrink-0 flex-col gap-1 p-0 text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan text-sm font-bold text-primary-foreground">{r.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}</span><span className="w-full truncate text-[11px] font-semibold text-foreground">{r.name.split(" ")[0]}</span></Button>)}</div></div>}
    <RecipientBankPicker banks={banks} bank={bank} error={bankError} onRetry={loadBanks} onSelect={setBank} />
    <Field label="Account number"><input className="field font-mono" inputMode="numeric" maxLength={10} placeholder="0123456789" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} /></Field>
    {name ? <div className="transfer-verified" role="status"><CheckCircle2 className="h-4 w-4 shrink-0" /><span>{name}</span><span className="ml-auto text-xs">Verified</span></div> : lookup && <p role="status" className="text-xs text-muted-foreground">{lookup}</p>}
    <Field label="Amount (NGN)"><div className="transfer-amount-input"><input className="field" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /><span>NGN</span></div><div className="mt-2 flex flex-wrap gap-2">{QUICK.map((v) => <Button variant="outline" key={v} type="button" onClick={() => setAmount(String(v))} aria-pressed={amount === String(v)} className="transfer-quick-amount">{naira(v)}</Button>)}</div></Field>
    <Field label="Note (optional)"><input className="field" maxLength={60} value={narration} onChange={(e) => setNarration(e.target.value)} /></Field>
    {balance !== undefined && <p className="text-xs text-muted-foreground">Available: <span className="font-bold text-foreground">{naira(balance)}</span></p>}
    {short && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">This is more than your available balance.</p>}
    {dup && <p role="alert" className="rounded-lg bg-warning/15 px-3 py-2 text-xs font-semibold text-foreground">You sent this exact amount to this account a few minutes ago. Check before sending again.</p>}
    <Button variant="brand" className="transfer-submit h-12 w-full" disabled={!name || !validTransferAmount(amount) || short} onClick={review}><Send />Review transfer</Button>
    <p className="transfer-secure"><ShieldCheck className="h-3.5 w-3.5" />{live ? "Protected by your transaction PIN" : "Sandbox · test transfers only"}</p>
  </div>;
}
