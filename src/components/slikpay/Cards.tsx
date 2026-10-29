import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Copy, CreditCard, Eye, Loader2, Lock, RefreshCw, Search, Settings2, Snowflake, Sun, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cardTransactions, fundCard, issueCard, listCards, revealCard, setCardFrozen, updateCardControls, withdrawCard, CARD_BRANDS, CARD_CURRENCIES, type CardBrand, type CardCurrency, type CardTxn, type CardView } from "@/lib/cards.functions";
import { CardGraphic } from "./CardGraphic";
import { useBankingProfile } from "./PaddleConsole";
import hero from "@/assets/cards-hero.jpg";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const STATUS_STYLE: Record<CardView["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "border-success/40 bg-success/10 text-success" },
  frozen: { label: "Frozen", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  unknown: { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" },
};

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className="slik-popup w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      {children}
    </div>
  </div>;
}

function AmountDialog({ card, kind, needPin, busy, onCancel, onConfirm }: {
  card: CardView; kind: "fund" | "withdraw"; needPin: boolean; busy: boolean;
  onCancel: () => void; onConfirm: (amount: number, pin: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const valid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && (kind === "fund" || Number(amount) <= card.balance) && (!needPin || pin.length === 4);
  return <DialogShell title={kind === "fund" ? `Fund ${card.brand === "VISA" ? "Visa" : "Mastercard"} ···${card.last4}` : `Withdraw from ···${card.last4}`} onClose={onCancel}>
    <p className="text-sm text-muted-foreground">{kind === "fund" ? `Move money from your ${card.currency} wallet onto this card.` : `Move money back to your ${card.currency} wallet. Card holds ${money(card.balance, card.currency)}.`}</p>
    <div className="mt-4 space-y-1.5"><Label htmlFor="card-amount">Amount ({card.currency})</Label>
      <Input id="card-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" className="h-11 text-lg font-bold tabular-nums" />
    </div>
    {needPin && <div className="mt-3 space-y-1.5"><Label htmlFor="card-pin">Transaction PIN</Label>
      <Input id="card-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit PIN" autoComplete="off" className="font-mono tracking-[0.4em]" />
    </div>}
    <Button variant="brand" className="mt-5 w-full" disabled={!valid || busy} onClick={() => onConfirm(Number(amount), pin)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === "fund" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
      {busy ? "Working…" : kind === "fund" ? "Fund card" : "Withdraw"}
    </Button>
  </DialogShell>;
}

function RevealDialog({ card, needPin, busy, onCancel, onReveal }: {
  card: CardView; needPin: boolean; busy: boolean;
  onCancel: () => void; onReveal: (pin: string) => Promise<{ pan: string; cvv: string; expiry: string; billingAddress: string } | null>;
}) {
  const [pin, setPin] = useState("");
  const [details, setDetails] = useState<{ pan: string; cvv: string; expiry: string; billingAddress: string } | null>(null);
  const copy = async (v: string, label: string) => { try { await navigator.clipboard.writeText(v); toast.success(`${label} copied`); } catch { toast.error("Copy unavailable"); } };
  return <DialogShell title={`Card details ···${card.last4}`} onClose={onCancel}>
    {!details ? <>
      <p className="text-sm text-muted-foreground">Reveal the full card number, CVV and expiry. Details are shown once and never stored.</p>
      {needPin && <div className="mt-4 space-y-1.5"><Label htmlFor="reveal-pin">Transaction PIN</Label>
        <Input id="reveal-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit PIN" autoComplete="off" className="font-mono tracking-[0.4em]" />
      </div>}
      <Button variant="brand" className="mt-5 w-full" disabled={busy || (needPin && pin.length !== 4)} onClick={async () => { const d = await onReveal(pin); if (d) setDetails(d); }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{busy ? "Revealing…" : "Reveal details"}
      </Button>
    </> : <>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Card number</dt><dd className="flex items-center gap-2 font-mono font-bold">{details.pan}<Button variant="ghost" size="icon" aria-label="Copy card number" onClick={() => void copy(details.pan, "Card number")}><Copy className="h-3.5 w-3.5" /></Button></dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">CVV</dt><dd className="flex items-center gap-2 font-mono font-bold">{details.cvv}<Button variant="ghost" size="icon" aria-label="Copy CVV" onClick={() => void copy(details.cvv, "CVV")}><Copy className="h-3.5 w-3.5" /></Button></dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Expiry</dt><dd className="font-mono font-bold">{details.expiry}</dd></div>
        {details.billingAddress && <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Billing address</dt><dd className="text-right text-xs font-semibold">{details.billingAddress}</dd></div>}
      </dl>
      <p className="mt-4 rounded-lg border border-magenta/30 bg-magenta/5 p-3 text-[11px] text-muted-foreground">Never share these details. They are not stored in this browser and are fetched fresh each time.</p>
    </>}
  </DialogShell>;
}

function ControlsDialog({ card, busy, onCancel, onSave }: {
  card: CardView; busy: boolean; onCancel: () => void; onSave: (c: CardView["controls"]) => void;
}) {
  const [online, setOnline] = useState(card.controls.online);
  const [atm, setAtm] = useState(card.controls.atm);
  const [international, setInternational] = useState(card.controls.international);
  const [limit, setLimit] = useState(card.controls.spendingLimit > 0 ? String(card.controls.spendingLimit) : "");
  const limitValid = /^\d+(?:\.\d{1,2})?$/.test(limit) && Number(limit) > 0;
  const Toggle = ({ label, hint, value, set }: { label: string; hint: string; value: boolean; set: (v: boolean) => void }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3">
      <div><p className="text-sm font-bold">{label}</p><p className="text-[11px] text-muted-foreground">{hint}</p></div>
      <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => set(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-cobalt" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
  return <DialogShell title={`Card controls ···${card.last4}`} onClose={onCancel}>
    <div className="space-y-2">
      <Toggle label="Online payments" hint="Web and in-app purchases" value={online} set={setOnline} />
      <Toggle label="ATM withdrawals" hint="Cash machines (physical cards)" value={atm} set={setAtm} />
      <Toggle label="International" hint="Merchants outside the issuing country" value={international} set={setInternational} />
    </div>
    <div className="mt-3 space-y-1.5"><Label htmlFor="card-limit">Spending limit ({card.currency})</Label>
      <Input id="card-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000.00" autoComplete="off" className="tabular-nums" />
    </div>
    <Button variant="brand" className="mt-5 w-full" disabled={!limitValid || busy} onClick={() => onSave({ online, atm, international, spendingLimit: Number(limit) })}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}{busy ? "Saving…" : "Save controls"}
    </Button>
  </DialogShell>;
}

function IssueCard({ onIssued }: { onIssued: (c: CardView) => void }) {
  const issueFn = useServerFn(issueCard);
  const { profile } = useBankingProfile();
  const [holderName, setHolderName] = useState("");
  const [brand, setBrand] = useState<CardBrand>("MASTERCARD");
  const [currency, setCurrency] = useState<CardCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needPin = profile?.mode === "live";
  const amountOk = amount === "" || (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0);
  const limitOk = limit === "" || (/^\d+(?:\.\d{1,2})?$/.test(limit) && Number(limit) > 0);
  const funding = amountOk && amount !== "" ? Number(amount) : 0;
  const valid = holderName.trim().length >= 2 && amountOk && limitOk && (!(needPin && funding > 0) || pin.length === 4);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const card = await issueFn({
        data: {
          holderName: holderName.trim(), brand, currency,
          ...(funding > 0 ? { amount: funding } : {}),
          ...(limitOk && limit !== "" ? { spendingLimit: Number(limit) } : {}),
          ...(pin ? { pin } : {}),
          reference: `SLKCARD-${crypto.randomUUID()}`,
        },
      });
      toast.success(`${brand === "VISA" ? "Visa" : "Mastercard"} ···${card.last4} issued`);
      setHolderName(""); setAmount(""); setLimit(""); setPin("");
      onIssued(card);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This card could not be issued. Check the details and try again.");
    } finally { setBusy(false); }
  };

  return <form className="rounded-2xl border border-border bg-card p-5 shadow-sm" onSubmit={(e) => void submit(e)} aria-label="Issue a virtual card">
    <h3 className="font-bold">Issue a virtual card</h3>
    <p className="mt-0.5 text-xs text-muted-foreground">A Mastercard or Visa ready in seconds — for online spend, subscriptions and team expenses.</p>
    <div className="mt-4 space-y-1.5"><Label htmlFor="card-holder">Card holder name</Label>
      <Input id="card-holder" value={holderName} maxLength={120} onChange={(e) => setHolderName(e.target.value)} placeholder="Tunde Adeleke" autoComplete="off" required />
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label id="card-brand-label">Brand</Label>
        <div className="flex gap-1.5" role="group" aria-labelledby="card-brand-label">
          {CARD_BRANDS.map((b) => <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)}
            className={`h-11 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors ${brand === b ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>{b === "VISA" ? "Visa" : "Mastercard"}</button>)}
        </div>
      </div>
      <div className="space-y-1.5"><Label id="card-currency-label">Currency</Label>
        <div className="flex gap-1.5" role="group" aria-labelledby="card-currency-label">
          {CARD_CURRENCIES.map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}
            className={`h-11 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors ${currency === c ? "border-magenta bg-magenta text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-magenta/50"}`}>{c}</button>)}
        </div>
      </div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="card-initial">Initial funding <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="card-initial" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" className="tabular-nums" />
      </div>
      <div className="space-y-1.5"><Label htmlFor="card-spend-limit">Spending limit <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="card-spend-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000.00" autoComplete="off" className="tabular-nums" />
      </div>
    </div>
    {needPin && funding > 0 && <div className="mt-3 space-y-1.5"><Label htmlFor="issue-pin">Transaction PIN</Label>
      <Input id="issue-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit PIN" autoComplete="off" className="font-mono tracking-[0.4em]" />
    </div>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    <Button type="submit" variant="brand" className="mt-4 w-full" disabled={!valid || busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{busy ? "Issuing…" : "Issue card"}
    </Button>
    <p className="mt-2 text-center text-[11px] text-muted-foreground">Initial funding is reserved from your {currency} wallet and loaded onto the card in one step.</p>
  </form>;
}

function CardRow({ card, busy, onFund, onWithdraw, onToggleFreeze, onControls, onReveal, onTxns, showTxns, txns, txnsLoading }: {
  card: CardView; busy: boolean;
  onFund: () => void; onWithdraw: () => void; onToggleFreeze: () => void; onControls: () => void; onReveal: () => void; onTxns: () => void;
  showTxns: boolean; txns: CardTxn[] | null; txnsLoading: boolean;
}) {
  const st = STATUS_STYLE[card.status];
  return <li className="rounded-xl border border-border bg-card p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
        <CardGraphic label={card.holderName} last4={card.last4} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{card.brand === "VISA" ? "Visa" : "Mastercard"} {card.currency} · <span className="font-mono">···{card.last4}</span></p>
          <p className="truncate text-[11px] text-muted-foreground">{card.holderName}</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums">{money(card.balance, card.currency)}</p>
          <p className="text-[11px] text-muted-foreground">{card.controls.spendingLimit > 0 ? `Limit ${money(card.controls.spendingLimit, card.currency)}` : "No spending limit"} · {card.controls.online ? "Online on" : "Online off"} · {card.controls.international ? "Intl on" : "Intl off"}</p>
        </div>
      </div>
      <span className={`h-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
      <Button variant="brand" size="sm" disabled={busy || card.status === "frozen"} onClick={onFund}><ArrowDownToLine className="h-3.5 w-3.5" />Fund</Button>
      <Button variant="outline" size="sm" disabled={busy || card.balance <= 0} onClick={onWithdraw}><ArrowUpFromLine className="h-3.5 w-3.5" />Withdraw</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onToggleFreeze}>{card.status === "frozen" ? <Sun className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}{card.status === "frozen" ? "Unfreeze" : "Freeze"}</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onControls}><Settings2 className="h-3.5 w-3.5" />Controls</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onReveal}><Eye className="h-3.5 w-3.5" />Reveal</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onTxns}>{showTxns ? "Hide activity" : "Activity"}</Button>
    </div>
    {showTxns && <div className="mt-3 border-t border-border pt-3">
      {txnsLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading card activity…</p>}
      {txns && !txns.length && <p className="text-xs text-muted-foreground">No card transactions yet.</p>}
      {txns && txns.length > 0 && <ul className="space-y-1.5">
        {txns.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <span className="min-w-0 truncate font-semibold">{t.description}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-bold tabular-nums">{money(t.amount, t.currency || card.currency)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${["SUCCESSFUL", "SUCCESS", "COMPLETED", "APPROVED"].includes(t.status) ? "border-success/40 bg-success/10 text-success" : ["FAILED", "DECLINED"].includes(t.status) ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>{t.status}</span>
          </span>
        </li>)}
      </ul>}
    </div>}
  </li>;
}

export function Cards({ preview }: { preview?: { cards: CardView[] } }) {
  const listFn = useServerFn(listCards);
  const fundFn = useServerFn(fundCard);
  const withdrawFn = useServerFn(withdrawCard);
  const freezeFn = useServerFn(setCardFrozen);
  const controlsFn = useServerFn(updateCardControls);
  const revealFn = useServerFn(revealCard);
  const txnsFn = useServerFn(cardTransactions);
  const { profile } = useBankingProfile();
  const [cards, setCards] = useState<CardView[] | null>(preview?.cards ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [amountAction, setAmountAction] = useState<{ card: CardView; kind: "fund" | "withdraw" } | null>(null);
  const [revealTarget, setRevealTarget] = useState<CardView | null>(null);
  const [controlsTarget, setControlsTarget] = useState<CardView | null>(null);
  const [txnsFor, setTxnsFor] = useState<string | null>(null);
  const [txns, setTxns] = useState<CardTxn[] | null>(null);
  const [txnsLoading, setTxnsLoading] = useState(false);

  const needPin = profile?.mode === "live";

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError("");
    try { const r = await listFn(); setCards(r.cards); }
    catch (e) { setError(e instanceof Error ? e.message : "Your cards could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn, preview]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = cards ?? [];
    return q ? all.filter((c) => `${c.holderName} ${c.brand} ${c.currency} ${c.last4}`.toLowerCase().includes(q)) : all;
  }, [cards, search]);

  const replace = (updated: CardView) => setCards((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);

  const confirmAmount = async (amount: number, pin: string) => {
    if (!amountAction || busy) return;
    setBusy(true); setError("");
    try {
      const updated = amountAction.kind === "fund"
        ? await fundFn({ data: { cardId: amountAction.card.id, amount, ...(pin ? { pin } : {}), reference: `SLKCF-${crypto.randomUUID()}` } })
        : await withdrawFn({ data: { cardId: amountAction.card.id, amount, ...(pin ? { pin } : {}) } });
      replace(updated);
      toast.success(amountAction.kind === "fund" ? `Card funded with ${money(amount, updated.currency)}` : `${money(amount, updated.currency)} moved back to your wallet`);
      setAmountAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action could not be completed. Check the card before retrying.");
      setAmountAction(null);
    } finally { setBusy(false); }
  };

  const toggleFreeze = async (card: CardView) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const updated = await freezeFn({ data: { cardId: card.id, frozen: card.status !== "frozen" } });
      replace(updated);
      toast.success(updated.status === "frozen" ? "Card frozen — all spend is blocked" : "Card active again");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The card could not be updated. Try again.");
    } finally { setBusy(false); }
  };

  const saveControls = async (controls: CardView["controls"]) => {
    if (!controlsTarget || busy) return;
    setBusy(true); setError("");
    try {
      const updated = await controlsFn({ data: { cardId: controlsTarget.id, ...controls } });
      replace(updated);
      toast.success("Card controls saved");
      setControlsTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The controls could not be saved. Try again.");
      setControlsTarget(null);
    } finally { setBusy(false); }
  };

  const reveal = async (pin: string) => {
    if (!revealTarget) return null;
    setBusy(true); setError("");
    try {
      return await revealFn({ data: { cardId: revealTarget.id, ...(pin ? { pin } : {}) } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card details could not be revealed. Try again.");
      setRevealTarget(null);
      return null;
    } finally { setBusy(false); }
  };

  const toggleTxns = async (card: CardView) => {
    if (txnsFor === card.id) { setTxnsFor(null); setTxns(null); return; }
    setTxnsFor(card.id); setTxns(null); setTxnsLoading(true);
    try { const r = await txnsFn({ data: { cardId: card.id } }); setTxns(r.transactions); }
    catch (e) { setError(e instanceof Error ? e.message : "Card activity could not be loaded."); setTxnsFor(null); }
    finally { setTxnsLoading(false); }
  };

  const active = (cards ?? []).filter((c) => c.status === "active");
  const frozen = (cards ?? []).filter((c) => c.status === "frozen");

  return <section className="transfer-center collections-composer space-y-5" aria-label="Cards">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Cards</h2>
      <p className="mt-1 text-sm text-muted-foreground">{profile ? (profile.mode === "live" ? "Live account" : "Sandbox account") : "Checking account…"} · virtual Mastercard & Visa, issued in seconds</p>
    </div>
    <div className="transfer-composer-layout">
      <aside className="transfer-story">
        <span className="transfer-eyebrow"><CreditCard className="h-4 w-4" />VIRTUAL CARDS</span>
        <h2>Spend anywhere,<br /><span>instantly.</span></h2>
        <p className="crypto-story-description">Issue USD and NGN cards in seconds, fund them from your wallet, and control every spend — freeze, limits and merchant rules included.</p>
        <img src={hero} alt="A glowing virtual card floating above a wallet with control dials" width={1152} height={640} className="collections-hero" loading="lazy" />
        <ol className="crypto-stages">{[
          ["Issue in seconds", "Pick Mastercard or Visa, USD or NGN — no paperwork."],
          ["Fund from your wallet", "Load the card instantly; withdraw back anytime."],
          ["Control every spend", "Freeze instantly, set limits, toggle online and international."],
        ].map(([title, detail], i) => <li key={title}><span className="crypto-stage-number">{i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}
        </ol>
        <p className="crypto-story-security"><Lock className="h-3.5 w-3.5" />PIN-protected details · Instant freeze · Live activity</p>
      </aside>

      <section className="transfer-composer space-y-4" aria-label="Cards workspace">
        <IssueCard onIssued={(c) => setCards((prev) => (prev ? [c, ...prev] : prev))} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CreditCard className="h-3.5 w-3.5 text-cobalt" />Cards</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{cards?.length ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Active</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{cards ? active.length : "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Snowflake className="h-3.5 w-3.5 text-cyan" />Frozen</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{cards ? frozen.length : "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by holder, brand or last four" aria-label="Search cards"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
          </div>
          <Button variant="outline" size="icon" aria-label="Refresh cards" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        </div>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {loading && !cards && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your cards…</p>}

        {cards && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10"><CreditCard className="h-6 w-6 text-cobalt" /></span>
          <h3 className="mt-4 font-bold">{cards.length ? "No cards match your search" : "No cards yet"}</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{cards.length ? "Try a different holder or last four." : "Issue your first virtual card above — ready to spend in seconds."}</p>
        </div>}

        <ul className="space-y-3">
          {filtered.map((c) => <CardRow key={c.id} card={c} busy={busy}
            onFund={() => setAmountAction({ card: c, kind: "fund" })}
            onWithdraw={() => setAmountAction({ card: c, kind: "withdraw" })}
            onToggleFreeze={() => void toggleFreeze(c)}
            onControls={() => setControlsTarget(c)}
            onReveal={() => setRevealTarget(c)}
            onTxns={() => void toggleTxns(c)}
            showTxns={txnsFor === c.id} txns={txnsFor === c.id ? txns : null} txnsLoading={txnsFor === c.id && txnsLoading} />)}
        </ul>
      </section>
    </div>

    {amountAction && <AmountDialog card={amountAction.card} kind={amountAction.kind} needPin={needPin} busy={busy} onCancel={() => setAmountAction(null)} onConfirm={(a, p) => void confirmAmount(a, p)} />}
    {revealTarget && <RevealDialog card={revealTarget} needPin={needPin} busy={busy} onCancel={() => setRevealTarget(null)} onReveal={reveal} />}
    {controlsTarget && <ControlsDialog card={controlsTarget} busy={busy} onCancel={() => setControlsTarget(null)} onSave={(c) => void saveControls(c)} />}
  </section>;
}
