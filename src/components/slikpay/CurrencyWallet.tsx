import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpDown, ArrowUpRight, Banknote, Copy, Download, FileText, Gauge, Link2, Loader2, Lock, MoreHorizontal, Plus, Repeat, Share2, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { getWalletExtras, getWallets, issueCurrencyWallet, savePayoutAccount, swapCurrency, withdrawFunds, type PayoutAccount, type WalletView } from "@/lib/wallets.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { CURRENCIES, currencyDef, NOT_ACTIVE } from "@/lib/wallets";
import { nairaValue, walletActions, type WalletAction } from "@/lib/wallet-actions";
import { useHideAmounts, mask, relativeTime } from "@/lib/insights";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PrivacyToggle } from "./DashboardPlus";
import { useBankingProfile } from "./PaddleConsole";

type Extras = Awaited<ReturnType<typeof getWalletExtras>>;
const uuid = () => globalThis.crypto.randomUUID();
const dec = (code: string) => (currencyDef(code)?.kind === "crypto" ? 6 : 2);
export const fmt = (code: string, n: number) => `${currencyDef(code)?.symbol ?? ""}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: dec(code) })}`;
const ICONS: Record<WalletAction, LucideIcon> = { receive: ArrowDownLeft, send: ArrowUpRight, withdraw: Banknote, swap: ArrowLeftRight, request: Link2, more: MoreHorizontal };
const LIMITS: Record<string, { daily: string; fee: string; speed: string }> = {
  NGN: { daily: "₦5,000,000", fee: "Free to your settlement account", speed: "Instant" },
  GHS: { daily: "GH₵100,000", fee: "Shown before you confirm", speed: "Same day" },
  KES: { daily: "KSh 1,000,000", fee: "Shown before you confirm", speed: "Same day" },
  ZAR: { daily: "R150,000", fee: "Shown before you confirm", speed: "1 business day" },
  USD: { daily: "$25,000", fee: "Shown before you confirm", speed: "1–2 business days" },
  EUR: { daily: "€20,000", fee: "Shown before you confirm", speed: "Same day (SEPA)" },
  GBP: { daily: "£20,000", fee: "Shown before you confirm", speed: "Minutes (Faster Payments)" },
  USDT: { daily: "₮50,000 swaps", fee: "1.5% swap spread", speed: "Instant" },
  USDC: { daily: "$50,000 swaps", fee: "1.5% swap spread", speed: "Instant" },
};

export function CurrencyWallet({ code, mode, onNavigate, compact }: { code: string; mode?: string | undefined; onNavigate?: ((module: string) => void) | undefined; compact?: boolean }) {
  const def = currencyDef(code)!;
  const load = useServerFn(getWallets);
  const loadExtras = useServerFn(getWalletExtras);
  const issue = useServerFn(issueCurrencyWallet);
  const { profile: banking } = useBankingProfile();
  const hidden = useHideAmounts();
  const [wallets, setWallets] = useState<WalletView[] | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<WalletAction | "limits" | null>(null);
  const refresh = useCallback(async () => {
    try { setError(null); const [w, x] = await Promise.all([load(), loadExtras()]); setWallets(w.wallets); setExtras(x); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load wallets."); }
  }, [load, loadExtras]);
  useEffect(() => { void refresh(); }, [refresh]);

  const ngnWallet: WalletView = { code: "NGN", status: "active", balance: banking?.balances["NGN"] ?? extras?.ngnBalance ?? 0, accountNumber: banking?.virtualAccount ?? null, accountName: banking?.accountDetails?.accountName ?? null, bankName: banking?.accountDetails?.bankName ?? null, routing: null, network: null, note: null };
  const w = code === "NGN" ? ngnWallet : wallets?.find((x) => x.code === code);
  const balanceOf = (c: string) => (c === "NGN" ? ngnWallet.balance : wallets?.find((x) => x.code === c)?.balance ?? 0);
  const balance = w?.balance ?? 0;
  const live = mode === "live";
  const actions = walletActions(code, w?.status ?? "not_issued", balance);
  const ngnEq = extras ? nairaValue(code, balance, extras.rates) : null;
  const pending = extras?.pending[code] ?? 0;

  const doIssue = async () => {
    setBusy(true);
    try { const r = await issue({ data: { currency: code as "GHS" } }); if (r.ok) toast.success(`${code} ${def.kind === "crypto" ? "wallet" : "account"} issued`); else toast.error(r.note ?? NOT_ACTIVE); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not issue account"); }
    finally { setBusy(false); }
  };
  const onAction = (a: WalletAction) => { if (a === "request") { onNavigate?.("links"); toast.message(`Create a ${code} payment link`, { description: "Set the currency to " + code + " on the link." }); return; } setDialog(a); };
  const exportCsv = () => {
    const rows = (extras?.ledger ?? []).filter((e) => e.currency === code);
    const csv = ["date,operation,amount,currency,status,reference", ...rows.map((e) => [e.created_at, e.operation, e.amount, e.currency, e.status, e.reference].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = `slikpay-${code}-statement.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success(rows.length ? `${rows.length} entries exported` : "Statement exported (no entries yet)");
  };
  const share = w ? [w.accountName, w.bankName, w.accountNumber, w.routing, w.network && `${w.network} network`].filter(Boolean).join(" · ") : "";
  const copyAll = async () => { try { await navigator.clipboard.writeText(share); } catch { /* clipboard unavailable */ } toast.success("Details copied"); };

  const actionGrid = (
      <div className="relative mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {actions.map((a) => { const Icon = ICONS[a.id]; const btn = <button key={a.id} disabled={!a.enabled} title={a.reason} onClick={() => onAction(a.id)} className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/50 text-foreground transition-all group-enabled:group-hover:scale-105 group-enabled:group-hover:bg-gradient-tri group-enabled:group-hover:text-primary-foreground">{a.enabled ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span><span className="text-[11px] font-bold">{a.label}</span></button>;
          return a.id === "more" ? <DropdownMenu key="more"><DropdownMenuTrigger asChild>{btn}</DropdownMenuTrigger><DropdownMenuContent align="end" className="theme-flame"><DropdownMenuItem onSelect={exportCsv}><Download />Download {code} statement</DropdownMenuItem><DropdownMenuItem onSelect={() => setDialog("limits")}><Gauge />Limits & fees</DropdownMenuItem><DropdownMenuItem disabled={!w?.accountNumber} onSelect={copyAll}><Copy />Copy all details</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : btn; })}
      </div>
  );
  return <section className="space-y-4">
    {compact && <div className="panel p-5"><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-extrabold">Naira wallet actions</h3><span className="text-[10px] text-muted-foreground">Swap · withdraw · statements</span></div>{actionGrid}</div>}
    {!compact && <div className="hero-surface p-6 md:p-8">
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold text-foreground/85"><span className="text-xl">{def.flag}</span>{def.name} wallet{!live && <span className="rounded-full bg-chart-4/20 px-2 py-0.5 text-[10px] text-chart-4">Sandbox</span>}</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/70">Available balance<PrivacyToggle className="h-7 w-7" /></div>
          <div className="font-mono text-4xl font-bold tracking-tight md:text-5xl">{wallets ? mask(fmt(code, balance), hidden) : <Loader2 className="h-8 w-8 animate-spin" />}</div>
          <p className="mt-1 text-xs font-semibold text-foreground/75">{code !== "NGN" && (ngnEq !== null ? <>≈ {mask(naira(ngnEq), hidden)} <span className="opacity-70">· last rate</span></> : "Naira value appears after your first swap")}{pending > 0 && <> · Pending {mask(fmt(code, pending), hidden)}</>}</p>
        </div>
        <StatusPill status={w?.status} />
      </div>
      {error && <p className="relative mt-3 text-xs font-semibold text-destructive">{error}</p>}
      {w && w.status !== "active" && code !== "NGN" && <div className="relative mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
        <p className="flex-1 text-xs text-foreground/85">{w.status === "not_active" ? <><Lock className="mr-1 inline h-3.5 w-3.5" />{NOT_ACTIVE}. You can still swap into {code} and hold a balance.</> : `No ${code} ${def.kind === "crypto" ? "wallet" : "account"} yet. Issue one to receive ${code}, or swap into it right now.`}</p>
        <Button variant="brand" size="sm" className="rounded-full" disabled={busy || w.status === "not_active"} onClick={doIssue}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}{w.status === "not_active" ? NOT_ACTIVE : "Issue account"}</Button>
      </div>}
      {actionGrid}
    </div>}

    {!compact && <div className="grid gap-4 lg:grid-cols-5">
      <div className="panel p-5 lg:col-span-2">
        <h3 className="mb-3 text-sm font-extrabold">{def.kind === "crypto" ? "Deposit address" : "Account details"}</h3>
        {w?.accountNumber ? <><dl className="space-y-3 text-sm">{[["Account name", w.accountName], ["Bank", w.bankName], [def.kind === "crypto" ? "Address" : "Account number", w.accountNumber], ["Routing / sort code", w.routing], ["Network", w.network]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[10px] font-bold uppercase text-muted-foreground">{k}</dt><dd className="break-all font-mono text-sm font-bold">{v}</dd></div>)}</dl>
          <div className="mt-4 flex gap-2"><Button variant="crisp" size="sm" className="rounded-full" onClick={copyAll}><Copy />Copy</Button>{typeof navigator !== "undefined" && "share" in navigator && <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigator.share({ title: `My ${code} details`, text: share }).catch(() => undefined)}><Share2 />Share</Button>}</div>
          {def.kind === "crypto" && <p className="mt-3 text-[11px] text-chart-4">Send only {code} on the {w.network ?? def.network} network. Other coins or networks will be lost.</p>}</>
          : <p className="text-xs text-muted-foreground">{w?.status === "not_active" ? NOT_ACTIVE : "Issue an account to see details here."}</p>}
        <div className="mt-5 border-t border-border pt-4"><h4 className="mb-2 flex items-center gap-2 text-xs font-extrabold"><Gauge className="h-3.5 w-3.5 text-cyan" />Limits & fees</h4><LimitsList code={code} /></div>
      </div>
      <div className="lg:col-span-3"><WalletActivity code={code} extras={extras} /></div>
    </div>}

    {dialog === "receive" && w && <Dialog open onOpenChange={(o) => !o && setDialog(null)}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Receive {code}</DialogTitle></DialogHeader><p className="break-all font-mono text-lg font-bold">{w.accountNumber}</p><p className="text-xs text-muted-foreground">{share}</p><Button variant="brand" onClick={copyAll}><Copy />Copy details</Button></DialogContent></Dialog>}
    {dialog === "limits" && <Dialog open onOpenChange={(o) => !o && setDialog(null)}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>{code} limits & fees</DialogTitle></DialogHeader><LimitsList code={code} /></DialogContent></Dialog>}
    {dialog === "swap" && <SwapDialog from={code} live={live} balanceOf={balanceOf} onClose={() => setDialog(null)} onDone={refresh} />}
    {dialog === "withdraw" && <WithdrawDialog code={code} live={live} balance={balance} payout={extras?.payouts[code] ?? null} holder={extras?.holder ?? ""} onNavigate={onNavigate} onClose={() => setDialog(null)} onDone={refresh} />}
    {dialog === "send" && <SendDialog code={code} live={live} balance={balance} onClose={() => setDialog(null)} onDone={refresh} />}
  </section>;
}

function StatusPill({ status }: { status?: string | undefined }) {
  const s = status === "active" ? ["Account active", "bg-success-soft text-success"] : status === "not_active" ? [NOT_ACTIVE, "bg-chart-4/20 text-chart-4"] : ["Not issued", "bg-background/40 text-foreground/80"];
  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${s[1]}`}>● {s[0]}</span>;
}
function LimitsList({ code }: { code: string }) {
  const l = LIMITS[code]!;
  return <dl className="grid grid-cols-3 gap-2 text-xs">{[["Daily limit", l.daily], ["Fees", l.fee], ["Speed", l.speed]].map(([k, v]) => <div key={k} className="rounded-lg bg-muted/50 p-2"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>)}</dl>;
}

const FILTERS = ["All", "In", "Out", "Swaps"] as const;
function WalletActivity({ code, extras }: { code: string; extras: Extras | null }) {
  const hidden = useHideAmounts();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const rows = useMemo(() => (extras?.ledger ?? []).filter((e) => e.currency === code && e.status !== "released").filter((e) => f === "All" || (f === "In" && e.amount > 0) || (f === "Out" && e.amount < 0) || (f === "Swaps" && e.operation.startsWith("SWAP"))).slice(0, 8), [extras, code, f]);
  const label = (op: string) => op.startsWith("SWAP") ? `Swap ${op.slice(5).replace("->", " → ")}` : op.startsWith("WITHDRAW") ? "Withdrawal" : op.includes("payouts") ? "Transfer out" : "Payment";
  return <div className="panel p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">{code} activity</h3><div className="flex gap-1">{FILTERS.map((x) => <button key={x} aria-pressed={f === x} onClick={() => setF(x)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${f === x ? "bg-gradient-tri text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{x}</button>)}</div></div>
    {!extras ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <div className="py-8 text-center"><FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-xs text-muted-foreground">No {code} activity yet.</p></div> :
      <ul className="space-y-1">{rows.map((e, i) => <li key={e.reference} className="feed-in flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50" style={{ animationDelay: `${i * 50}ms` }}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${e.operation.startsWith("SWAP") ? "bg-cyan/15 text-cyan" : e.amount > 0 ? "bg-success-soft text-success" : "bg-magenta/15 text-magenta"}`}>{e.operation.startsWith("SWAP") ? <Repeat className="h-4 w-4" /> : e.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{label(e.operation)}</p><p className="text-[11px] text-muted-foreground">{relativeTime(e.created_at)}{e.status === "held" ? " · Pending" : ""}</p></div>
        <p className={`font-mono text-sm font-bold ${e.amount > 0 ? "text-success" : ""}`}>{hidden ? "••••" : `${e.amount > 0 ? "+" : "−"}${fmt(code, Math.abs(e.amount))}`}</p>
      </li>)}</ul>}
  </div>;
}

/* ---------- money dialogs with a review step ---------- */
function Review({ rows, live, pin, setPin, busy, onBack, onConfirm }: { rows: [string, string][]; live: boolean; pin: string; setPin: (v: string) => void; busy: boolean; onBack: () => void; onConfirm: () => void }) {
  return <div className="space-y-3">
    <dl className="space-y-2 rounded-xl border border-border p-4 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono font-bold">{v}</dd></div>)}</dl>
    {live ? <label className="block text-xs font-bold">Transaction PIN<input autoFocus className="field mt-1 h-10 font-mono" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label> : <p className="text-[11px] text-chart-4">Sandbox · test money only.</p>}
    <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={onBack} disabled={busy}>Back</Button><Button variant="brand" className="flex-1" disabled={busy || (live && pin.length !== 4)} onClick={onConfirm}>{busy && <Loader2 className="animate-spin" />}Confirm</Button></div>
  </div>;
}
function Receipt({ rows, onClose }: { rows: [string, string][]; onClose: () => void }) {
  return <div className="space-y-3 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground shadow-cobalt"><Wallet /></span><p className="text-sm font-extrabold">Completed</p><dl className="space-y-2 rounded-xl border border-border p-4 text-left text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-mono font-bold">{v}</dd></div>)}</dl><Button variant="brand" className="w-full" onClick={onClose}>Done</Button></div>;
}
const amt = (s: string) => Number(s) || 0;
const AmountInput = ({ code, value, onChange, max }: { code: string; value: string; onChange: (v: string) => void; max?: number }) => <label className="block text-xs font-bold">Amount ({code})<div className="relative mt-1"><input className="field h-11 pr-16 font-mono text-base" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />{max !== undefined && max > 0 && <button type="button" onClick={() => onChange(String(max))} className="absolute right-2 top-2 rounded-md bg-muted px-2 py-1 text-[10px] font-bold text-cyan">MAX</button>}</div>{max !== undefined && <span className="mt-1 block font-normal text-muted-foreground">Available {fmt(code, max)}</span>}</label>;

function SwapDialog({ from: initial, live, balanceOf, onClose, onDone }: { from: string; live: boolean; balanceOf: (c: string) => number; onClose: () => void; onDone: () => Promise<void> }) {
  const swap = useServerFn(swapCurrency);
  const [from, setFrom] = useState(initial);
  const [to, setTo] = useState(initial === "NGN" ? "USDT" : "NGN");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof swap>> | null>(null);
  const [key] = useState(uuid);
  const avail = balanceOf(from);
  const confirm = async () => { setBusy(true); try { const r = await swap({ data: { from: from as "NGN", to: to as "NGN", amount: amt(amount), idempotencyKey: key, ...(pin ? { pin } : {}) } }); setResult(r); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Swap failed"); } finally { setBusy(false); } };
  const sel = (v: string, set: (c: string) => void, exclude: string) => <select className="field h-11" value={v} onChange={(e) => set(e.target.value)}>{CURRENCIES.filter((c) => c.code !== exclude).map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}</select>;
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Swap currencies</DialogTitle></DialogHeader>
    {step === "form" && <div className="space-y-3">
      <div className="rounded-xl border border-border p-3"><p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">You pay</p>{sel(from, setFrom, to)}<div className="mt-2"><AmountInput code={from} value={amount} onChange={setAmount} max={avail} /></div></div>
      <div className="flex justify-center"><Button variant="crisp" size="icon" className="rounded-full" aria-label="Flip currencies" onClick={() => { setFrom(to); setTo(from); }}><ArrowUpDown /></Button></div>
      <div className="rounded-xl border border-border p-3"><p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">You receive</p>{sel(to, setTo, from)}<p className="mt-2 text-[11px] text-muted-foreground">Held as your {to} balance, even if no {to} account is issued yet.</p></div>
      <Button variant="brand" className="w-full" disabled={!(amt(amount) > 0) || (live && amt(amount) > avail)} onClick={() => setStep("review")}>Review swap</Button>
    </div>}
    {step === "review" && <Review rows={[["You pay", fmt(from, amt(amount))], ["You receive", `${to} · rate set at confirmation`], ["Fee", "1.5% spread, shown on receipt"]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />}
    {step === "done" && result && <Receipt rows={[["Paid", fmt(from, result.fromAmount)], ["Received", fmt(to, result.toAmount)], ["Rate", `1 ${from} = ${result.rate} ${to}`], ["Fee", `${result.fee} ${result.feeCurrency}`], ["Reference", result.reference ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

function WithdrawDialog({ code, live, balance, payout, holder, onNavigate, onClose, onDone }: { code: string; live: boolean; balance: number; payout: PayoutAccount | null; holder: string; onNavigate?: ((m: string) => void) | undefined; onClose: () => void; onDone: () => Promise<void> }) {
  const withdraw = useServerFn(withdrawFunds); const save = useServerFn(savePayoutAccount);
  const [acct, setAcct] = useState<PayoutAccount | null>(payout);
  const [form, setForm] = useState({ accountNumber: "", accountName: holder, bankName: "" });
  const [amount, setAmount] = useState(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<{ reference: string | null; to: string } | null>(null); const [key] = useState(uuid);
  const addAccount = async () => { setBusy(true); try { await save({ data: { currency: code as "GHS", ...form } }); setAcct(form); toast.success("Payout account saved"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save account"); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); try { setRef(await withdraw({ data: { currency: code as "NGN", amount: amt(amount), idempotencyKey: key, ...(pin ? { pin } : {}) } })); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Withdrawal failed"); } finally { setBusy(false); } };
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Withdraw {code}</DialogTitle></DialogHeader>
    {!acct ? (code === "NGN" ? <div className="space-y-3"><p className="text-xs text-muted-foreground">Withdrawals go to your verified settlement account. Add it in KYB first.</p><Button variant="brand" onClick={() => { onClose(); onNavigate?.("golive"); }}>Open KYB</Button></div> :
      <div className="space-y-3"><p className="text-xs text-muted-foreground">Add your own {code} bank account once. It must be in your business name ({holder}).</p>
        {(["accountName", "accountNumber", "bankName"] as const).map((f) => <label key={f} className="block text-xs font-bold">{{ accountName: "Account name", accountNumber: "Account number / IBAN", bankName: "Bank name" }[f]}<input className="field mt-1 h-10" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></label>)}
        <Button variant="brand" className="w-full" disabled={busy || form.accountNumber.length < 4 || form.bankName.length < 2} onClick={addAccount}>{busy && <Loader2 className="animate-spin" />}Save payout account</Button></div>)
    : step === "form" ? <div className="space-y-3"><div className="rounded-xl border border-border p-3 text-xs"><p className="text-[10px] font-bold uppercase text-muted-foreground">To your account</p><p className="mt-1 font-bold">{acct.accountName}</p><p className="font-mono text-muted-foreground">{acct.bankName} · {acct.accountNumber}</p></div><AmountInput code={code} value={amount} onChange={setAmount} max={balance} /><Button variant="brand" className="w-full" disabled={!(amt(amount) > 0) || amt(amount) > balance} onClick={() => setStep("review")}>Review withdrawal</Button></div>
    : step === "review" ? <Review rows={[["Amount", fmt(code, amt(amount))], ["To", `${acct.accountName}`], ["Account", `${acct.bankName} · ${acct.accountNumber}`], ["Fee", LIMITS[code]!.fee], ["Arrives", LIMITS[code]!.speed]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />
    : ref && <Receipt rows={[["Amount", fmt(code, amt(amount))], ["To", ref.to], ["Reference", ref.reference ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

function SendDialog({ code, live, balance, onClose, onDone }: { code: string; live: boolean; balance: number; onClose: () => void; onDone: () => Promise<void> }) {
  const run = useServerFn(runPaddleOperation);
  const def = currencyDef(code)!;
  const [v, setV] = useState({ accountName: "", accountNumber: "", bankName: "", narration: "" });
  const [amount, setAmount] = useState(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<string | null>(null); const [key] = useState(uuid);
  const confirm = async () => { setBusy(true); try { const r = await run({ data: { id: "post-payouts-global", params: {}, body: { amount: amt(amount), currency: code, destinationCurrency: code, narration: v.narration || undefined, beneficiary: { accountNumber: v.accountNumber, accountName: v.accountName, bankName: v.bankName, country: def.country } }, idempotencyKey: key, currency: code, ...(pin ? { pin } : {}) } }); setRef(r.receipt?.reference ?? null); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer failed"); } finally { setBusy(false); } };
  const ok = v.accountName.trim().length > 1 && v.accountNumber.trim().length > 3 && v.bankName.trim().length > 1 && amt(amount) > 0 && amt(amount) <= balance;
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Send {code}</DialogTitle></DialogHeader>
    {step === "form" ? <div className="space-y-3">{(["accountName", "accountNumber", "bankName", "narration"] as const).map((f) => <label key={f} className="block text-xs font-bold">{{ accountName: "Recipient name", accountNumber: "Account number / IBAN", bankName: "Bank name", narration: "Note (optional)" }[f]}<input className="field mt-1 h-10" value={v[f]} onChange={(e) => setV({ ...v, [f]: e.target.value })} /></label>)}<AmountInput code={code} value={amount} onChange={setAmount} max={balance} /><Button variant="brand" className="w-full" disabled={!ok} onClick={() => setStep("review")}>Review transfer</Button></div>
    : step === "review" ? <Review rows={[["Amount", fmt(code, amt(amount))], ["Recipient", v.accountName], ["Account", `${v.bankName} · ${v.accountNumber}`], ["Fee", LIMITS[code]!.fee], ["Arrives", LIMITS[code]!.speed]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />
    : <Receipt rows={[["Amount", fmt(code, amt(amount))], ["Recipient", v.accountName], ["Reference", ref ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

/** Always-visible one-tap currency switcher shown at the top of every dashboard page. */
export function CurrencyBar({ current, onPick }: { current: string; onPick: (code: string) => void }) {
  return <nav aria-label="Choose wallet currency" className="dropdown-list -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    {CURRENCIES.map((c) => { const on = c.code === current; return <button key={c.code} onClick={() => onPick(c.code)} aria-pressed={on} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${on ? "border-transparent bg-gradient-tri text-primary-foreground shadow-cobalt" : "border-border bg-background/40 text-muted-foreground hover:border-cyan hover:text-foreground"}`}><span className="text-sm">{c.flag}</span>{c.code}</button>; })}
  </nav>;
}
