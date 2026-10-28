import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, ArrowUpRight, Copy, Loader2, Lock, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getWallets, issueCurrencyWallet, type WalletView } from "@/lib/wallets.functions";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { currencyDef, NOT_ACTIVE, CURRENCIES } from "@/lib/wallets";
import { useHideAmounts, mask } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivacyToggle } from "./DashboardPlus";

const fmt = (code: string, n: number) => `${currencyDef(code)?.symbol ?? ""}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: currencyDef(code)?.kind === "crypto" ? 6 : 2 })}`;

export function CurrencyWallet({ code, mode }: { code: string; mode?: string | undefined }) {
  const def = currencyDef(code)!;
  const load = useServerFn(getWallets);
  const issue = useServerFn(issueCurrencyWallet);
  const run = useServerFn(runPaddleOperation);
  const hidden = useHideAmounts();
  const [wallets, setWallets] = useState<WalletView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"fund" | "send" | "swap" | null>(null);
  const refresh = useCallback(async () => { try { setError(null); setWallets((await load()).wallets); } catch (e) { setError(e instanceof Error ? e.message : "Could not load wallets."); } }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);
  const w = wallets?.find((x) => x.code === code);
  const live = mode === "live";
  const crypto = def.kind === "crypto";

  const doIssue = async () => {
    setBusy(true);
    try { const r = await issue({ data: { currency: code as "GHS" } }); if (r.ok) toast.success(`${code} ${crypto ? "wallet" : "account"} issued`); else toast.error(r.note ?? NOT_ACTIVE); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not issue account"); }
    finally { setBusy(false); }
  };

  return <section className="hero-surface p-6 md:p-8">
    <div className="relative flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-bold text-foreground/80"><span className="text-xl">{def.flag}</span>{def.name} wallet{!live && <span className="rounded-full bg-chart-4/20 px-2 py-0.5 text-[10px] text-chart-4">Sandbox</span>}</p>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/70">Available balance<PrivacyToggle className="h-7 w-7" /></div>
        <div className="font-mono text-4xl font-bold tracking-tight md:text-5xl">{wallets ? mask(fmt(code, w?.balance ?? 0), hidden) : <Loader2 className="h-8 w-8 animate-spin" />}</div>
        {w?.status === "active" && <div className="mt-4 rounded-xl border border-border bg-background/40 p-3 text-xs">
          <p className="text-[10px] font-bold uppercase text-foreground/70">{crypto ? `Deposit address · ${w.network ?? def.network}` : "Account details"}</p>
          <p className="mt-1 break-all font-mono text-sm font-bold">{w.accountNumber}</p>
          {!crypto && <p className="mt-1 text-foreground/80">{w.accountName}{w.bankName ? ` · ${w.bankName}` : ""}{w.routing ? ` · ${w.routing}` : ""}</p>}
        </div>}
        {w?.status === "not_active" && <p className="mt-4 flex items-center gap-2 rounded-full bg-background/40 px-3 py-1.5 text-xs font-bold text-chart-4"><Lock className="h-3.5 w-3.5" />{NOT_ACTIVE}</p>}
        {error && <p className="mt-4 text-xs font-semibold text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2 self-end">
        {w?.status !== "active" ? <Button variant="brand" className="rounded-full" disabled={busy || !wallets || w?.status === "not_active"} onClick={doIssue}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}{w?.status === "not_active" ? NOT_ACTIVE : `Issue ${code} ${crypto ? "wallet" : "account"}`}</Button> : <>
          <Button variant="brand" className="rounded-full" onClick={() => setDialog("fund")}><Wallet />Fund</Button>
          <Button variant="crisp" className="rounded-full" onClick={() => setDialog("send")} disabled={crypto} title={crypto ? "Crypto withdrawals are not active yet" : undefined}><ArrowUpRight />Send</Button>
          <Button variant="crisp" className="rounded-full" onClick={() => setDialog("swap")}><ArrowLeftRight />Swap</Button>
        </>}
      </div>
    </div>
    {w && <FundDialog open={dialog === "fund"} onClose={() => setDialog(null)} w={w} />}
    {w && dialog === "send" && <MoneyDialog title={`Send ${code}`} live={live} onClose={() => setDialog(null)} fields={["accountNumber", "accountName", "bankName"]} submit={async (v, pin) => {
      await run({ data: { id: "post-payouts-global", params: {}, body: { amount: Number(v["amount"]), currency: code, destinationCurrency: code, beneficiary: { accountNumber: v["accountNumber"], accountName: v["accountName"], bankName: v["bankName"], country: def.country } }, idempotencyKey: crypto_uuid(), currency: code, ...(pin ? { pin } : {}) } });
      toast.success(`${code} transfer sent`); await refresh();
    }} />}
    {w && dialog === "swap" && <MoneyDialog title={`Swap ${code}`} live={live} onClose={() => setDialog(null)} toOptions={["NGN", ...(wallets ?? []).filter((x) => x.status === "active" && x.code !== code).map((x) => x.code)]} submit={async (v, pin) => {
      const r = await run({ data: { id: "post-crypto-swap", params: {}, body: { fromCurrency: code, toCurrency: v["to"], amount: Number(v["amount"]) }, idempotencyKey: crypto_uuid(), currency: code, ...(pin ? { pin } : {}) } });
      const d = JSON.parse(r.resultJson || "null") as { toAmount?: number; rate?: number } | null;
      toast.success(`Swapped to ${v["to"]}`, { description: d?.toAmount != null ? `Received ${d.toAmount} ${v["to"]} at rate ${d.rate}` : undefined }); await refresh();
    }} />}
  </section>;
}
const crypto_uuid = () => globalThis.crypto.randomUUID();

function FundDialog({ open, onClose, w }: { open: boolean; onClose: () => void; w: WalletView }) {
  const def = currencyDef(w.code)!;
  const share = [w.accountName, w.bankName, w.accountNumber, w.routing, w.network].filter(Boolean).join(" · ");
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame">
    <DialogHeader><DialogTitle>Fund your {w.code} {def.kind === "crypto" ? "wallet" : "account"}</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">{def.kind === "crypto" ? `Send only ${w.code} on the ${w.network ?? def.network} network to this address. Other coins or networks will be lost.` : `Share these details to receive ${def.name} by local transfer.`}</p>
    <dl className="space-y-3 rounded-xl border border-border p-4 text-sm">{[["Account name", w.accountName], ["Bank", w.bankName], [def.kind === "crypto" ? "Address" : "Account number", w.accountNumber], ["Routing / sort code", w.routing], ["Network", w.network]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[10px] font-bold uppercase text-muted-foreground">{k}</dt><dd className="break-all font-mono font-bold">{v}</dd></div>)}</dl>
    <Button variant="brand" onClick={async () => { try { await navigator.clipboard.writeText(share); } catch { /* clipboard unavailable */ } toast.success("Details copied"); }}><Copy />Copy details</Button>
  </DialogContent></Dialog>;
}

function MoneyDialog({ title, live, onClose, submit, fields = [], toOptions }: { title: string; live: boolean; onClose: () => void; submit: (v: Record<string, string>, pin?: string) => Promise<void>; fields?: string[]; toOptions?: string[] }) {
  const [v, setV] = useState<Record<string, string>>({ to: toOptions?.[0] ?? "" });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const label: Record<string, string> = { accountNumber: "Account number / IBAN", accountName: "Account name", bankName: "Bank name" };
  const valid = Number(v["amount"]) > 0 && fields.every((f) => (v[f] ?? "").trim().length > 1) && (!live || /^\d{4}$/.test(pin)) && (!toOptions || v["to"]);
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="theme-flame">
    <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!valid || busy) return; setBusy(true); try { await submit(v, live ? pin : undefined); onClose(); } catch (err) { toast.error(err instanceof Error ? err.message : "Request failed"); } finally { setBusy(false); } }}>
      {toOptions && <label className="block text-xs font-bold">To<select className="field mt-1 h-10" value={v["to"]} onChange={(e) => setV({ ...v, to: e.target.value })}>{toOptions.map((o) => <option key={o} value={o}>{currencyDef(o)?.flag} {o}</option>)}</select>{toOptions.length === 1 && <span className="mt-1 block font-normal text-muted-foreground">Issue more wallets to swap between them.</span>}</label>}
      {fields.map((f) => <label key={f} className="block text-xs font-bold">{label[f]}<input className="field mt-1 h-10" value={v[f] ?? ""} onChange={(e) => setV({ ...v, [f]: e.target.value })} /></label>)}
      <label className="block text-xs font-bold">Amount<input className="field mt-1 h-10 font-mono" inputMode="decimal" value={v["amount"] ?? ""} onChange={(e) => setV({ ...v, amount: e.target.value.replace(/[^\d.]/g, "") })} /></label>
      {live && <label className="block text-xs font-bold">Transaction PIN<input className="field mt-1 h-10 font-mono" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>}
      {!live && <p className="text-[11px] text-chart-4">Sandbox · test money only.</p>}
      <Button type="submit" variant="brand" className="w-full" disabled={!valid || busy}>{busy && <Loader2 className="animate-spin" />}Confirm</Button>
      <p className="text-[10px] text-muted-foreground">The exchange rate and fees are confirmed by the service when the request completes.</p>
    </form>
  </DialogContent></Dialog>;
}

/** Always-visible one-tap currency switcher shown at the top of every dashboard page. */
export function CurrencyBar({ current, onPick }: { current: string; onPick: (code: string) => void }) {
  return <nav aria-label="Choose wallet currency" className="dropdown-list -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    {CURRENCIES.map((c) => { const on = c.code === current; return <button key={c.code} onClick={() => onPick(c.code)} aria-pressed={on} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${on ? "border-transparent bg-gradient-tri text-primary-foreground shadow-cobalt" : "border-border bg-background/40 text-muted-foreground hover:border-cyan hover:text-foreground"}`}><span className="text-sm">{c.flag}</span>{c.code}</button>; })}
  </nav>;
}
