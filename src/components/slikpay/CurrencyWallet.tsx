import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpDown, ArrowUpRight, Banknote, Copy, Download, FileText, Gauge, Link2, Loader2, Lock, MoreHorizontal, Plus, QrCode, Repeat, Share2, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { getWalletExtras, getWallets, issueCurrencyWallet, savePayoutAccount, swapCurrency, withdrawFunds, type PayoutAccount, type WalletView } from "@/lib/wallets.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { CURRENCIES, currencyDef, NOT_ACTIVE } from "@/lib/wallets";
import { walletActions, type WalletAction } from "@/lib/wallet-actions";
import { nairaValueLive, quoteSwap, railFor } from "@/lib/pricing";
import { useLivePricing } from "@/lib/live-pricing";
import { quoteFee } from "@/lib/pricing.functions";
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
const LOCALE: Record<string, string> = { NGN: "en-NG", GHS: "en-GH", KES: "en-KE", ZAR: "en-ZA", USD: "en-US", EUR: "en-IE", GBP: "en-GB", USDT: "en-US", USDC: "en-US" };
export const fmt = (code: string, n: number) => `${currencyDef(code)?.symbol ?? ""}${n.toLocaleString(LOCALE[code] ?? undefined, { minimumFractionDigits: 2, maximumFractionDigits: dec(code) })}`;
const ICONS: Record<WalletAction, LucideIcon> = { receive: ArrowDownLeft, send: ArrowUpRight, withdraw: Banknote, swap: ArrowLeftRight, request: Link2, more: MoreHorizontal };
const TINTS: Record<WalletAction, string> = { receive: "", send: "", withdraw: "is-accent", swap: "", request: "", more: "" };

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
  const pricing = useLivePricing();
  const ngnEq = nairaValueLive(code, balance, pricing?.rates ?? null);
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
        {actions.map((a) => { const Icon = ICONS[a.id]; const btn = <button key={a.id} disabled={!a.enabled} title={a.reason} onClick={() => onAction(a.id)} className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"><span className={`wallet-action flex h-14 w-14 items-center justify-center rounded-full ${TINTS[a.id]}`}>{a.enabled ? <Icon className="h-5 w-5" strokeWidth={2.2} /> : <Lock className="h-4 w-4" />}</span><span className="text-[11px] font-bold text-body transition-colors group-enabled:group-hover:text-foreground">{a.label}</span></button>;
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
          <div className="balance-figure">{wallets ? mask(fmt(code, balance), hidden) : <Loader2 className="h-8 w-8 animate-spin" />}</div>
          <p className="mt-1 text-xs font-semibold text-foreground/75">{code !== "NGN" && (ngnEq !== null ? <>≈ {mask(naira(ngnEq), hidden)} <span className="opacity-70">· live rate</span></> : (pricing ? "Live rate unavailable right now" : "Loading live rate…"))}{pending > 0 && <> · Pending {mask(fmt(code, pending), hidden)}</>}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusPill status={w?.status} />
          {def.kind === "crypto" && w?.accountNumber && <button type="button" onClick={() => setDialog("receive")} title="Tap Receive to see the full address and QR code" className="group flex max-w-[16rem] items-center gap-3 rounded-2xl border border-border bg-background/40 px-3.5 py-2.5 text-left backdrop-blur-md transition-all hover:border-cyan/60 hover:bg-background/60">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-tri text-primary-foreground"><QrCode className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/70">Deposit address · {w.network ?? def.network}</span>
              <span className="block truncate font-mono text-xs font-bold">{w.accountNumber.slice(0, 6)}…{w.accountNumber.slice(-6)}</span>
            </span>
          </button>}
        </div>
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
        {def.kind === "crypto" ? <>
          <h3 className="mb-2 text-sm font-extrabold">Receiving {code}</h3>
          <p className="text-xs text-muted-foreground">{w?.accountNumber ? <>Your deposit address and QR code open when you tap <b className="text-foreground">Receive</b>.</> : w?.status === "not_active" ? NOT_ACTIVE : "Issue a wallet to get a deposit address."}</p>
          {w?.accountNumber && <Button variant="brand" size="sm" className="mt-3 rounded-full" onClick={() => setDialog("receive")}><QrCode />Receive {code}</Button>}
        </> : <>
        <h3 className="mb-3 text-sm font-extrabold">Account details</h3>
        {w?.accountNumber ? <><dl className="space-y-3 text-sm">{[["Account name", w.accountName], ["Bank", w.bankName], ["Account number", w.accountNumber], ["Routing / sort code", w.routing]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[10px] font-bold uppercase text-muted-foreground">{k}</dt><dd className="break-all font-mono text-sm font-bold">{v}</dd></div>)}</dl>
          <div className="mt-4 flex gap-2"><Button variant="crisp" size="sm" className="rounded-full" onClick={copyAll}><Copy />Copy</Button>{typeof navigator !== "undefined" && "share" in navigator && <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigator.share({ title: `My ${code} details`, text: share }).catch(() => undefined)}><Share2 />Share</Button>}</div></>
          : <p className="text-xs text-muted-foreground">{w?.status === "not_active" ? NOT_ACTIVE : "Issue an account to see details here."}</p>}
        </>}
        <div className="mt-5 border-t border-border pt-4"><h4 className="mb-2 flex items-center gap-2 text-xs font-extrabold"><Gauge className="h-3.5 w-3.5 text-cyan" />Limits & fees</h4><LimitsList code={code} /></div>
      </div>
      <div className="lg:col-span-3"><WalletActivity code={code} extras={extras} /></div>
    </div>}

    {dialog === "receive" && w && <Dialog open onOpenChange={(o) => !o && setDialog(null)}><DialogContent className="theme-flame sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><span className="text-xl">{def.flag}</span>Receive {code}</DialogTitle></DialogHeader>
      {def.kind === "crypto" && w.accountNumber ? <div className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan">{w.network ?? def.network} network</span>
        <div className="rounded-3xl bg-gradient-tri p-[2px] shadow-lg"><div className="rounded-[22px] bg-background p-3"><DepositQr address={w.accountNumber} code={code} network={w.network ?? def.network} size={220} /></div></div>
        <div className="w-full rounded-2xl border border-border bg-background/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deposit address</p><p className="mt-1 break-all font-mono text-sm font-bold">{w.accountNumber}</p></div>
        <p className="text-[11px] text-chart-4">Send only {code} on the {w.network ?? def.network} network. Other coins or networks will be lost.</p>
      </div> : <><p className="break-all font-mono text-lg font-bold">{w.accountNumber}</p><p className="text-xs text-muted-foreground">{share}</p></>}
      <div className="flex gap-2"><Button variant="brand" className="flex-1 rounded-full" onClick={copyAll}><Copy />Copy address</Button>{typeof navigator !== "undefined" && "share" in navigator && <Button variant="crisp" className="rounded-full" onClick={() => navigator.share({ title: `My ${code} details`, text: share }).catch(() => undefined)}><Share2 />Share</Button>}</div>
    </DialogContent></Dialog>}
    {dialog === "limits" && <Dialog open onOpenChange={(o) => !o && setDialog(null)}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>{code} limits & fees</DialogTitle></DialogHeader><LimitsList code={code} /></DialogContent></Dialog>}
    {dialog === "swap" && <SwapDialog from={code} live={live} balanceOf={balanceOf} onClose={() => setDialog(null)} onDone={refresh} />}
    {dialog === "withdraw" && <WithdrawDialog code={code} live={live} balance={balance} payout={(extras?.payouts as Record<string, PayoutAccount> | undefined)?.[code] ?? null} holder={extras?.holder ?? ""} onNavigate={onNavigate} onClose={() => setDialog(null)} onDone={refresh} />}
    {dialog === "send" && <SendDialog code={code} live={live} balance={balance} onClose={() => setDialog(null)} onDone={refresh} />}
  </section>;
}

function StatusPill({ status }: { status?: string | undefined }) {
  const s = status === "active" ? ["Account active", "bg-success-soft text-success"] : status === "not_active" ? [NOT_ACTIVE, "bg-chart-4/20 text-chart-4"] : ["Not issued", "bg-background/40 text-foreground/80"];
  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${s[1]}`}>● {s[0]}</span>;
}
function LimitsList({ code }: { code: string }) {
  const pricing = useLivePricing(); const crypto = currencyDef(code)?.kind === "crypto";
  const rows = (["receive", "send", "swap"] as const).map((a) => { const id = railFor(a, code, crypto); const r = id ? pricing?.rails[id] : undefined; return r ? [{ receive: "Receiving", send: "Sending out", swap: "Swapping" }[a], r.price, r.unit] as const : null; }).filter((x): x is readonly [string, string, string] => Boolean(x));
  if (!pricing) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!rows.length) return <p className="text-[11px] text-muted-foreground">{pricing.error ? "Live pricing is unavailable right now." : "The exact fee is shown before you confirm."}</p>;
  return <dl className="grid gap-2 text-xs sm:grid-cols-3">{rows.map(([k, v, u]) => <div key={k} className="rounded-lg bg-muted/50 p-2"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd><dd className="text-[10px] text-muted-foreground">{u}</dd></div>)}</dl>;
}

/** Exact fee from the provider calculator for this rail and amount. */
function useFee(rail: string | null, amount: number) {
  const calc = useServerFn(quoteFee);
  const [fee, setFee] = useState<{ text: string; loading: boolean }>({ text: "", loading: false });
  // A rail the provider prices flat (e.g. ₦80 per NIP transfer) is quoted once and never changes with the amount.
  const flatRef = useRef<{ rail: string; text: string } | null>(null);
  useEffect(() => {
    if (!rail) { flatRef.current = null; setFee({ text: "Shown on receipt", loading: false }); return; }
    if (!(amount > 0)) { setFee({ text: "", loading: false }); return; }
    if (flatRef.current?.rail === rail) { setFee({ text: flatRef.current.text, loading: false }); return; }
    let on = true; setFee({ text: "", loading: true });
    calc({ data: { rail, amount } }).then((r) => {
      if (!on) return;
      if (r?.flat) flatRef.current = { rail, text: `Flat ${r.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.currency} per transfer` };
      setFee({ text: r ? (r.flat ? flatRef.current!.text : `${r.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.currency} · ${r.description}`) : "Shown on receipt", loading: false });
    }).catch(() => on && setFee({ text: "Live fee unavailable · shown on receipt", loading: false }));
    return () => { on = false; };
  }, [rail, amount, calc]);
  return fee.loading ? "Calculating…" : fee.text;
}

const FILTERS = ["All", "In", "Out", "Swaps"] as const;
function WalletActivity({ code, extras }: { code: string; extras: Extras | null }) {
  const hidden = useHideAmounts();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const rows = useMemo(() => (extras?.ledger ?? []).filter((e) => e.currency === code && e.status !== "released").filter((e) => f === "All" || (f === "In" && e.amount > 0) || (f === "Out" && e.amount < 0) || (f === "Swaps" && e.operation.startsWith("SWAP"))).slice(0, 8), [extras, code, f]);
  const label = (op: string) => op.startsWith("SWAP") ? `Swap ${op.slice(5).replace("->", " → ")}` : op.startsWith("WITHDRAW") ? "Withdrawal" : op.includes("payouts") ? "Transfer out" : "Payment";
  return <div className="panel p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">{code} activity</h3><div className="flex gap-1">{FILTERS.map((x) => <button key={x} aria-pressed={f === x} onClick={() => setF(x)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${f === x ? "bg-gradient-tri text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{x}</button>)}</div></div>
    {!extras ? <div className="space-y-2 py-2" aria-label="Loading">{[0,1,2].map((i) => <div key={i} className="shimmer h-10" />)}</div> : rows.length === 0 ? <div className="py-8 text-center"><FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-xs text-muted-foreground">No {code} activity yet.</p></div> :
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
  const pricing = useLivePricing();
  const q = pricing?.rates ? quoteSwap(from, to, amt(amount), pricing.rates) : null;
  const estimate = q?.amount ?? null;
  const swapFee = useFee(railFor("swap", from, currencyDef(from)?.kind === "crypto" || currencyDef(to)?.kind === "crypto"), amt(amount));
  const confirm = async () => { setBusy(true); try { const r = await swap({ data: { from: from as "NGN", to: to as "NGN", amount: amt(amount), idempotencyKey: key, ...(pin ? { pin } : {}) } }); setResult(r); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Swap failed"); } finally { setBusy(false); } };
  const sel = (v: string, set: (c: string) => void, exclude: string) => <select className="field h-11" value={v} onChange={(e) => set(e.target.value)}>{CURRENCIES.filter((c) => c.code !== exclude).map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}</select>;
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Swap currencies</DialogTitle></DialogHeader>
    {step === "form" && <div className="space-y-3">
      <div className="rounded-xl border border-border p-3"><p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">You pay</p>{sel(from, setFrom, to)}<div className="mt-2"><AmountInput code={from} value={amount} onChange={setAmount} max={avail} /></div></div>
      <div className="flex justify-center"><Button variant="crisp" size="icon" className="rounded-full" aria-label="Flip currencies" onClick={() => { setFrom(to); setTo(from); }}><ArrowUpDown /></Button></div>
      <div className="rounded-xl border border-border p-3"><p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">You receive</p>{sel(to, setTo, from)}{estimate !== null && <p className="mt-2 font-mono text-lg font-bold">≈ {fmt(to, estimate)}</p>}<p className="mt-2 text-[11px] text-muted-foreground">{estimate !== null && q ? `Live rate 1 ${from} = ${q.rate.toLocaleString(undefined, { maximumSignificantDigits: 6 })} ${to}. Final amount is locked when you confirm. ` : pricing ? "Live rate unavailable for this pair; the exact amount is set when you confirm. " : "Loading live rate… "}Held as your {to} balance, even if no {to} account is issued yet.</p></div>
      <Button variant="brand" className="w-full" disabled={!(amt(amount) > 0) || (live && amt(amount) > avail)} onClick={() => setStep("review")}>Review swap</Button>
    </div>}
    {step === "review" && <Review rows={[["You pay", fmt(from, amt(amount))], ["You receive", estimate !== null ? `≈ ${fmt(to, estimate)} (live rate)` : `${to} · rate set at confirmation`], ["Fee", swapFee || "Shown on receipt"]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />}
    {step === "done" && result && <Receipt rows={[["Paid", fmt(from, result.fromAmount)], ["Received", fmt(to, result.toAmount)], ["Rate", `1 ${from} = ${result.rate} ${to}`], ["Fee", result.fee === null ? "Not reported" : `${result.fee} ${result.feeCurrency}`], ["Reference", result.reference ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

function WithdrawDialog({ code, live, balance, payout, holder, onNavigate, onClose, onDone }: { code: string; live: boolean; balance: number; payout: PayoutAccount | null; holder: string; onNavigate?: ((m: string) => void) | undefined; onClose: () => void; onDone: () => Promise<void> }) {
  const withdraw = useServerFn(withdrawFunds); const save = useServerFn(savePayoutAccount);
  const [acct, setAcct] = useState<PayoutAccount | null>(payout);
  const [form, setForm] = useState({ accountNumber: "", accountName: holder, bankName: "" });
  const [amount, setAmount] = useState(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const fee = useFee(railFor("withdraw", code, currencyDef(code)?.kind === "crypto"), amt(amount));
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<{ reference: string | null; to: string } | null>(null); const [key] = useState(uuid);
  const addAccount = async () => { setBusy(true); try { await save({ data: { currency: code as "GHS", ...form } }); setAcct(form); toast.success("Payout account saved"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save account"); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); try { setRef(await withdraw({ data: { currency: code as "NGN", amount: amt(amount), idempotencyKey: key, ...(pin ? { pin } : {}) } })); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Withdrawal failed"); } finally { setBusy(false); } };
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Withdraw {code}</DialogTitle></DialogHeader>
    {!acct ? (code === "NGN" ? <div className="space-y-3"><p className="text-xs text-muted-foreground">Withdrawals go to your verified settlement account. Add it in KYB first.</p><Button variant="brand" onClick={() => { onClose(); onNavigate?.("golive"); }}>Open KYB</Button></div> :
      <div className="space-y-3"><p className="text-xs text-muted-foreground">Add your own {code} bank account once. It must be in your business name ({holder}).</p>
        {(["accountName", "accountNumber", "bankName"] as const).map((f) => <label key={f} className="block text-xs font-bold">{{ accountName: "Account name", accountNumber: "Account number / IBAN", bankName: "Bank name" }[f]}<input className="field mt-1 h-10" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></label>)}
        <Button variant="brand" className="w-full" disabled={busy || form.accountNumber.length < 4 || form.bankName.length < 2} onClick={addAccount}>{busy && <Loader2 className="animate-spin" />}Save payout account</Button></div>)
    : step === "form" ? <div className="space-y-3"><div className="rounded-xl border border-border p-3 text-xs"><p className="text-[10px] font-bold uppercase text-muted-foreground">To your account</p><p className="mt-1 font-bold">{acct.accountName}</p><p className="font-mono text-muted-foreground">{acct.bankName} · {acct.accountNumber}</p></div><AmountInput code={code} value={amount} onChange={setAmount} max={balance} /><Button variant="brand" className="w-full" disabled={!(amt(amount) > 0) || amt(amount) > balance} onClick={() => setStep("review")}>Review withdrawal</Button></div>
    : step === "review" ? <Review rows={[["Amount", fmt(code, amt(amount))], ["To", `${acct.accountName}`], ["Account", `${acct.bankName} · ${acct.accountNumber}`], ["Fee", fee || "Shown on receipt"]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />
    : ref && <Receipt rows={[["Amount", fmt(code, amt(amount))], ["To", ref.to], ["Reference", ref.reference ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

function SendDialog({ code, live, balance, onClose, onDone }: { code: string; live: boolean; balance: number; onClose: () => void; onDone: () => Promise<void> }) {
  const run = useServerFn(runPaddleOperation);
  const def = currencyDef(code)!;
  const [v, setV] = useState({ accountName: "", accountNumber: "", bankName: "", narration: "" });
  const [amount, setAmount] = useState(""); const [step, setStep] = useState<"form" | "review" | "done">("form");
  const fee = useFee(railFor("send", code, def.kind === "crypto"), amt(amount));
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [ref, setRef] = useState<string | null>(null); const [key] = useState(uuid);
  const confirm = async () => { setBusy(true); try { const r = await run({ data: { id: "post-payouts-global", params: {}, body: { amount: amt(amount), currency: code, destinationCurrency: code, narration: v.narration || undefined, beneficiary: { accountNumber: v.accountNumber, accountName: v.accountName, bankName: v.bankName, country: def.country } }, idempotencyKey: key, currency: code, ...(pin ? { pin } : {}) } }); setRef(r.receipt?.reference ?? null); setStep("done"); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer failed"); } finally { setBusy(false); } };
  const ok = v.accountName.trim().length > 1 && v.accountNumber.trim().length > 3 && v.bankName.trim().length > 1 && amt(amount) > 0 && amt(amount) <= balance;
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame"><DialogHeader><DialogTitle>Send {code}</DialogTitle></DialogHeader>
    {step === "form" ? <div className="space-y-3">{(["accountName", "accountNumber", "bankName", "narration"] as const).map((f) => <label key={f} className="block text-xs font-bold">{{ accountName: "Recipient name", accountNumber: "Account number / IBAN", bankName: "Bank name", narration: "Note (optional)" }[f]}<input className="field mt-1 h-10" value={v[f]} onChange={(e) => setV({ ...v, [f]: e.target.value })} /></label>)}<AmountInput code={code} value={amount} onChange={setAmount} max={balance} /><Button variant="brand" className="w-full" disabled={!ok} onClick={() => setStep("review")}>Review transfer</Button></div>
    : step === "review" ? <Review rows={[["Amount", fmt(code, amt(amount))], ["Recipient", v.accountName], ["Account", `${v.bankName} · ${v.accountNumber}`], ["Fee", fee || "Shown on receipt"]]} live={live} pin={pin} setPin={setPin} busy={busy} onBack={() => setStep("form")} onConfirm={confirm} />
    : <Receipt rows={[["Amount", fmt(code, amt(amount))], ["Recipient", v.accountName], ["Reference", ref ?? "—"]]} onClose={onClose} />}
  </DialogContent></Dialog>;
}

/** Scannable deposit QR for crypto wallets: dark modules on a light tile for reliable scanning. */
export function DepositQr({ address, code, network, size = 168 }: { address: string; code: string; network?: string | null | undefined; size?: number }) {
  return <figure className="flex flex-col items-center gap-2">
    <div className="rounded-2xl bg-foreground p-3 text-background shadow-cobalt"><QRCodeSVG value={address} size={size} level="M" bgColor="transparent" fgColor="currentColor" marginSize={0} title={`${code} deposit address QR code`} /></div>
    <figcaption className="text-center text-[11px] font-semibold text-muted-foreground">Scan to send {code}{network ? ` on ${network}` : ""}</figcaption>
  </figure>;
}

/** Total across every wallet, shown in naira at live rates. */
export function PortfolioHeader() {
  const load = useServerFn(getWallets); const loadExtras = useServerFn(getWalletExtras);
  const { profile: banking } = useBankingProfile(); const hidden = useHideAmounts(); const pricing = useLivePricing();
  const [data, setData] = useState<{ w: WalletView[]; x: Extras } | null>(null);
  useEffect(() => { let on = true; Promise.all([load(), loadExtras()]).then(([w, x]) => on && setData({ w: w.wallets, x })).catch(() => undefined); return () => { on = false; }; }, [load, loadExtras, banking]);
  if (!data) return null;
  const ngn = banking?.balances["NGN"] ?? data.x.ngnBalance;
  const parts = data.w.filter((w) => w.balance !== 0).map((w) => ({ code: w.code, bal: w.balance, n: nairaValueLive(w.code, w.balance, pricing?.rates ?? null) }));
  const total = ngn + parts.reduce((a, p) => a + (p.n ?? 0), 0);
  const unpriced = parts.filter((p) => p.n === null).map((p) => p.code);
  return <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
    <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Total across all wallets</p><p className="font-mono text-lg font-bold">{mask(naira(total), hidden)}</p></div>
    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">🇳🇬 {mask(naira(ngn), hidden)}</span>{parts.map((p) => <span key={p.code} className="rounded-full bg-muted px-2 py-1">{currencyDef(p.code)?.flag} {mask(fmt(p.code, p.bal), hidden)}</span>)}</div>
    {unpriced.length > 0 && <p className="text-[10px] text-muted-foreground">{unpriced.join(", ")} not in total until a swap sets a rate.</p>}
  </div>;
}

/** Always-visible one-tap currency switcher shown at the top of every dashboard page. */
export function CurrencyBar({ current, onPick }: { current: string; onPick: (code: string) => void }) {
  return <nav aria-label="Choose wallet currency" className="dropdown-list -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    {CURRENCIES.map((c) => { const on = c.code === current; return <button key={c.code} onClick={() => onPick(c.code)} aria-pressed={on} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${on ? "border-transparent bg-gradient-tri text-primary-foreground shadow-cobalt" : "border-border bg-background/40 text-muted-foreground hover:border-cyan hover:text-foreground"}`}><span className="text-sm">{c.flag}</span>{c.code}</button>; })}
  </nav>;
}
