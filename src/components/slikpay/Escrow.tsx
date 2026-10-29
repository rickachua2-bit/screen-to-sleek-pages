import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Clock3, Handshake, Loader2, Lock, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Undo2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEscrow, disputeEscrow, fundEscrow, listEscrows, refundEscrow, releaseMilestone, ESCROW_CURRENCIES, type EscrowCurrency, type EscrowStatus, type EscrowView } from "@/lib/escrow.functions";
import { useBankingProfile } from "./PaddleConsole";
import hero from "@/assets/escrow-hero.jpg";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const STATUS_STYLE: Record<EscrowStatus, { label: string; className: string }> = {
  created: { label: "Awaiting funding", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  funded: { label: "In escrow", className: "border-cobalt/40 bg-cobalt/10 text-cobalt" },
  released: { label: "Released", className: "border-success/40 bg-success/10 text-success" },
  disputed: { label: "Disputed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  refunded: { label: "Refunded", className: "border-border bg-muted/50 text-muted-foreground" },
  unknown: { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" },
};

type PendingAction =
  | { kind: "fund"; escrow: EscrowView }
  | { kind: "release"; escrow: EscrowView; milestoneId: string; milestoneTitle: string }
  | { kind: "refund"; escrow: EscrowView };

function PinDialog({ action, needPin, busy, onCancel, onConfirm }: {
  action: PendingAction;
  needPin: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  const title = action.kind === "fund" ? `Lock ${money(action.escrow.amount, action.escrow.currency)} into escrow?`
    : action.kind === "release" ? `Release "${action.milestoneTitle}" to the seller?`
    : `Refund ${money(action.escrow.amount, action.escrow.currency)} to the buyer?`;
  const detail = action.kind === "fund"
    ? "The full deal amount is reserved from your wallet and locked in the trust vault until you release it."
    : action.kind === "release"
      ? "The milestone amount is paid out to the seller. This cannot be undone."
      : "The locked funds are returned to the buyer. This cannot be undone.";
  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onCancel}>
    <div role="dialog" aria-modal="true" aria-label={title} className="slik-popup w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X /></Button>
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
      {needPin && <div className="mt-4 space-y-1.5">
        <Label htmlFor="escrow-pin">Transaction PIN</Label>
        <Input id="escrow-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit PIN" autoComplete="off" className="font-mono tracking-[0.4em]" />
      </div>}
      <Button variant="brand" className="mt-5 w-full" disabled={busy || (needPin && pin.length !== 4)} onClick={() => onConfirm(pin)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}{busy ? "Working…" : "Confirm"}
      </Button>
    </div>
  </div>;
}

function DisputeDialog({ escrow, busy, onCancel, onConfirm }: { escrow: EscrowView; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onCancel}>
    <div role="dialog" aria-modal="true" aria-label="Open a dispute" className="slik-popup w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-bold">Dispute "{escrow.title}"?</h2>
        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X /></Button>
      </div>
      <p className="text-sm text-muted-foreground">Funds stay locked in the vault while the dispute is reviewed. Describe what went wrong.</p>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="dispute-reason">Reason</Label>
        <textarea id="dispute-reason" value={reason} maxLength={280} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Goods not delivered as agreed…" className="field w-full resize-none" />
      </div>
      <Button variant="brand" className="mt-5 w-full" disabled={busy || reason.trim().length < 4} onClick={() => onConfirm(reason.trim())}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}{busy ? "Opening…" : "Open dispute"}
      </Button>
    </div>
  </div>;
}

interface MilestoneDraft { title: string; amount: string }

const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "–";

function DealPreview({ title, total, currency, buyerName, sellerName, milestones }: {
  title: string; total: number; currency: string; buyerName: string; sellerName: string; milestones: MilestoneDraft[];
}) {
  const filled = milestones.filter((m) => m.title.trim() || Number(m.amount) > 0);
  return <aside className="h-fit rounded-xl border border-border bg-background p-4" aria-label="Deal preview">
    <p className="text-xs font-bold text-muted-foreground">Deal preview</p>
    <p className="mt-2 truncate text-sm font-extrabold">{title.trim() || "Untitled deal"}</p>
    <p className="mt-0.5 text-lg font-extrabold tabular-nums text-cobalt">{money(total, currency)}</p>
    <span className="mt-1.5 inline-block rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan">Escrow (Unfunded)</span>
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] font-bold text-muted-foreground">Milestones · {filled.length}</p>
      <ul className="mt-2 space-y-2">
        {filled.map((m, i) => {
          const amt = Number(m.amount) || 0;
          const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
          return <li key={i} className="flex items-center gap-2 text-[11px]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-cobalt" : "bg-border"}`} />
            <span className="min-w-0 flex-1 truncate font-semibold">{m.title.trim() || `Milestone ${i + 1}`}</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </li>;
        })}
        {!filled.length && <li className="text-[11px] text-muted-foreground">Add milestones to see the split.</li>}
      </ul>
    </div>
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      {([["Buyer", buyerName, "bg-cobalt/10 text-cobalt"], ["Seller", sellerName, "bg-magenta/10 text-magenta"]] as const).map(([role, name, tone]) => (
        <div key={role} className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${tone}`}>{initials(name)}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{name.trim() || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{role}</p>
          </div>
        </div>
      ))}
    </div>
  </aside>;
}

function CreateEscrowCard({ onCreated }: { onCreated: (e: EscrowView) => void }) {
  const createFn = useServerFn(createEscrow);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<EscrowCurrency>("NGN");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([{ title: "Full delivery", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = /^\d+(?:\.\d{1,2})?$/.test(amount) ? Number(amount) : 0;
  const milestoneSum = milestones.reduce((s, m) => s + (/^\d+(?:\.\d{1,2})?$/.test(m.amount) ? Number(m.amount) : 0), 0);
  const milestonesBalanced = total > 0 && Math.abs(milestoneSum - total) <= 0.01;
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const valid = title.trim().length >= 2 && total > 0 && buyerName.trim().length >= 2 && emailOk(buyerEmail)
    && sellerName.trim().length >= 2 && emailOk(sellerEmail) && milestones.every((m) => m.title.trim()) && milestonesBalanced;

  const setMilestone = (i: number, patch: Partial<MilestoneDraft>) => setMilestones((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const created = await createFn({
        data: {
          title: title.trim(),
          amount: total,
          currency,
          buyer: { name: buyerName.trim(), email: buyerEmail.trim() },
          seller: { name: sellerName.trim(), email: sellerEmail.trim() },
          milestones: milestones.map((m) => ({ title: m.title.trim(), amount: Number(m.amount) })),
          reference: `SLKESC-${crypto.randomUUID()}`,
        },
      });
      toast.success(`Escrow opened for ${money(created.amount, created.currency)}`);
      setTitle(""); setAmount(""); setBuyerName(""); setBuyerEmail(""); setSellerName(""); setSellerEmail("");
      setMilestones([{ title: "Full delivery", amount: "" }]);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This escrow could not be opened. Check the details and try again.");
    } finally { setBusy(false); }
  };

  return <form className="rounded-2xl border border-border bg-card p-5 shadow-sm" onSubmit={(e) => void submit(e)} aria-label="Open an escrow deal">
    <h3 className="font-bold">Open an escrow deal</h3>
    <p className="mt-0.5 text-xs text-muted-foreground">The buyer's money is locked in a trust vault and only released to the seller when you confirm delivery — milestone by milestone.</p>
    <div className="mt-4 space-y-1.5"><Label htmlFor="esc-title">What is this deal for?</Label>
      <Input id="esc-title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Supply of 200 bags of rice" autoComplete="off" required />
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5"><Label htmlFor="esc-amount">Deal amount</Label>
        <Input id="esc-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" required className="h-11 text-lg font-bold tabular-nums" />
      </div>
      <div className="space-y-1.5"><Label id="esc-currency-label">Currency</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="esc-currency-label">
          {ESCROW_CURRENCIES.map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}
            className={`h-11 rounded-lg border px-3 text-xs font-bold transition-colors ${currency === c ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>{c}</button>)}
        </div>
      </div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="esc-buyer-name">Buyer name</Label>
        <Input id="esc-buyer-name" value={buyerName} maxLength={120} onChange={(e) => setBuyerName(e.target.value)} placeholder="Adebayo Tunde" autoComplete="off" required />
      </div>
      <div className="space-y-1.5"><Label htmlFor="esc-buyer-email">Buyer email</Label>
        <Input id="esc-buyer-email" type="email" value={buyerEmail} maxLength={160} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="buyer@domain.com" autoComplete="off" required />
      </div>
      <div className="space-y-1.5"><Label htmlFor="esc-seller-name">Seller name</Label>
        <Input id="esc-seller-name" value={sellerName} maxLength={120} onChange={(e) => setSellerName(e.target.value)} placeholder="Lekki Properties Ltd" autoComplete="off" required />
      </div>
      <div className="space-y-1.5"><Label htmlFor="esc-seller-email">Seller email</Label>
        <Input id="esc-seller-email" type="email" value={sellerEmail} maxLength={160} onChange={(e) => setSellerEmail(e.target.value)} placeholder="seller@domain.com" autoComplete="off" required />
      </div>
    </div>
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <Label>Milestones</Label>
        <Button type="button" variant="outline" size="sm" disabled={milestones.length >= 12} onClick={() => setMilestones((prev) => [...prev, { title: "", amount: "" }])}><Plus className="h-3.5 w-3.5" />Add milestone</Button>
      </div>
      <ul className="mt-2 space-y-2">
        {milestones.map((m, i) => <li key={i} className="flex items-center gap-2">
          <Input value={m.title} maxLength={120} onChange={(e) => setMilestone(i, { title: e.target.value })} placeholder={`Milestone ${i + 1}`} aria-label={`Milestone ${i + 1} title`} required />
          <Input inputMode="decimal" value={m.amount} onChange={(e) => setMilestone(i, { amount: e.target.value })} placeholder="Amount" aria-label={`Milestone ${i + 1} amount`} required className="w-32 tabular-nums" />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove milestone ${i + 1}`} disabled={milestones.length <= 1} onClick={() => setMilestones((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </li>)}
      </ul>
      <p className={`mt-2 text-xs font-semibold tabular-nums ${milestonesBalanced ? "text-success" : "text-muted-foreground"}`}>
        Milestones total {money(milestoneSum, currency)} of {money(total, currency)}{milestonesBalanced ? " — balanced" : ""}
      </p>
    </div>
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    <Button type="submit" variant="brand" className="mt-4 w-full" disabled={!valid || busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{busy ? "Opening…" : "Open escrow"}
    </Button>
    <p className="mt-2 text-center text-[11px] text-muted-foreground">Nothing moves yet — the deal is funded in the next step, with your PIN.</p>
  </form>;
}

function EscrowCard({ e, busy, onAction, onDispute }: { e: EscrowView; busy: boolean; onAction: (a: PendingAction) => void; onDispute: (e: EscrowView) => void }) {
  const st = STATUS_STYLE[e.status];
  const releasedSum = e.milestones.filter((m) => m.status === "released").reduce((s, m) => s + m.amount, 0);
  const progress = e.amount > 0 ? Math.round((releasedSum / e.amount) * 100) : 0;
  return <li className="rounded-xl border border-border bg-card px-4 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cobalt/10"><Handshake className="h-4 w-4 text-cobalt" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{e.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{e.buyerName} → {e.sellerName} · <span className="font-mono">{e.id}</span></p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-extrabold tabular-nums">{money(e.amount, e.currency)}</p>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
      </div>
    </div>
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{e.milestones.filter((m) => m.status === "released").length} of {e.milestones.length} milestones released</span>
        <span className="tabular-nums">{progress}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-cobalt to-cyan transition-all" style={{ width: `${progress}%` }} /></div>
    </div>
    <ul className="mt-3 space-y-1.5">
      {e.milestones.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          {m.status === "released" ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" /> : <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate font-semibold">{m.title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold tabular-nums">{money(m.amount, e.currency)}</span>
          {m.status === "released" ? <span className="text-success">Released</span>
            : e.status === "funded" ? <Button variant="brand" size="sm" disabled={busy} onClick={() => onAction({ kind: "release", escrow: e, milestoneId: m.id, milestoneTitle: m.title })}>Release</Button>
            : <span className="text-muted-foreground">Pending</span>}
        </span>
      </li>)}
    </ul>
    {(e.status === "created" || e.status === "funded" || e.status === "disputed") && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
      {e.status === "created" && <Button variant="brand" size="sm" disabled={busy} onClick={() => onAction({ kind: "fund", escrow: e })}><Lock className="h-3.5 w-3.5" />Fund {money(e.amount, e.currency)}</Button>}
      {e.status === "funded" && <Button variant="outline" size="sm" disabled={busy} onClick={() => onDispute(e)}><ShieldAlert className="h-3.5 w-3.5" />Dispute</Button>}
      {(e.status === "funded" || e.status === "disputed") && <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction({ kind: "refund", escrow: e })}><Undo2 className="h-3.5 w-3.5" />Refund buyer</Button>}
    </div>}
  </li>;
}

export function Escrow({ preview }: { preview?: { escrows: EscrowView[] } }) {
  const listFn = useServerFn(listEscrows);
  const fundFn = useServerFn(fundEscrow);
  const releaseFn = useServerFn(releaseMilestone);
  const disputeFn = useServerFn(disputeEscrow);
  const refundFn = useServerFn(refundEscrow);
  const { profile } = useBankingProfile();
  const [escrows, setEscrows] = useState<EscrowView[] | null>(preview?.escrows ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [disputing, setDisputing] = useState<EscrowView | null>(null);

  const needPin = profile?.mode === "live";

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError("");
    try { const r = await listFn(); setEscrows(r.escrows); }
    catch (e) { setError(e instanceof Error ? e.message : "Your escrow deals could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn, preview]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = escrows ?? [];
    return q ? all.filter((e) => `${e.title} ${e.buyerName} ${e.sellerName} ${e.id}`.toLowerCase().includes(q)) : all;
  }, [escrows, search]);

  const replace = (updated: EscrowView) => setEscrows((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);

  const confirmAction = async (pin: string) => {
    if (!action || busy) return;
    setBusy(true); setError("");
    try {
      const updated = action.kind === "fund"
        ? await fundFn({ data: { escrowId: action.escrow.id, ...(pin ? { pin } : {}) } })
        : action.kind === "release"
          ? await releaseFn({ data: { escrowId: action.escrow.id, milestoneId: action.milestoneId, ...(pin ? { pin } : {}) } })
          : await refundFn({ data: { escrowId: action.escrow.id, ...(pin ? { pin } : {}) } });
      replace(updated);
      toast.success(action.kind === "fund" ? "Funds locked in escrow" : action.kind === "release" ? "Milestone released to the seller" : "Deal refunded to the buyer");
      setAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action could not be completed. Check the deal before retrying.");
      setAction(null);
    } finally { setBusy(false); }
  };

  const confirmDispute = async (reason: string) => {
    if (!disputing || busy) return;
    setBusy(true); setError("");
    try {
      const updated = await disputeFn({ data: { escrowId: disputing.id, reason } });
      replace(updated);
      toast.success("Dispute opened — funds stay locked");
      setDisputing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The dispute could not be opened. Try again.");
      setDisputing(null);
    } finally { setBusy(false); }
  };

  const inEscrow = (escrows ?? []).filter((e) => e.status === "funded");
  const released = (escrows ?? []).filter((e) => e.status === "released");
  const disputed = (escrows ?? []).filter((e) => e.status === "disputed");

  return <section className="transfer-center collections-composer space-y-5" aria-label="Escrow">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Escrow</h2>
      <p className="mt-1 text-sm text-muted-foreground">{profile ? (profile.mode === "live" ? "Live account" : "Sandbox account") : "Checking account…"} · protected deals with milestone payouts</p>
    </div>
    <div className="transfer-composer-layout">
      <aside className="transfer-story">
        <span className="transfer-eyebrow"><ShieldCheck className="h-4 w-4" />PROTECTED TRADE</span>
        <h2>Deals,<br /><span>protected.</span></h2>
        <p className="crypto-story-description">Lock the buyer's money in a trust vault and release it to the seller only when delivery is confirmed — split into milestones for big deals.</p>
        <img src={hero} alt="A glowing vault shielding a handshake between buyer and seller" width={1152} height={640} className="collections-hero" loading="lazy" />
        <ol className="crypto-stages">{[
          ["Open the deal", "Describe the deal, set the amount and split it into milestones."],
          ["Buyer funds the vault", "The full amount is reserved and locked — neither side can touch it."],
          ["Release on delivery", "Confirm each milestone to pay the seller, or refund the buyer."],
        ].map(([title, detail], i) => <li key={title}><span className="crypto-stage-number">{i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}
        </ol>
        <p className="crypto-story-security"><Lock className="h-3.5 w-3.5" />PIN-protected releases · Dispute & refund cover · Live status</p>
      </aside>

      <section className="transfer-composer space-y-4" aria-label="Escrow workspace">
        <CreateEscrowCard onCreated={(e) => setEscrows((prev) => (prev ? [e, ...prev] : prev))} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Lock className="h-3.5 w-3.5 text-cobalt" />In escrow</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{escrows ? inEscrow.length : "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Released</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{escrows ? released.length : "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5 text-magenta" />Disputed</p>
            <p className="mt-1.5 text-lg font-extrabold tabular-nums">{escrows ? disputed.length : "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by deal, buyer, seller or reference" aria-label="Search escrow deals"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
          </div>
          <Button variant="outline" size="icon" aria-label="Refresh escrow deals" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        </div>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {loading && !escrows && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your deals…</p>}

        {escrows && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10"><Wallet className="h-6 w-6 text-cobalt" /></span>
          <h3 className="mt-4 font-bold">{escrows.length ? "No deals match your search" : "No escrow deals yet"}</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{escrows.length ? "Try a different deal, buyer or seller." : "Open your first protected deal above — funds stay locked until delivery is confirmed."}</p>
        </div>}

        <ul className="space-y-3">
          {filtered.map((e) => <EscrowCard key={e.id} e={e} busy={busy} onAction={setAction} onDispute={setDisputing} />)}
        </ul>
      </section>
    </div>

    {action && <PinDialog action={action} needPin={needPin} busy={busy} onCancel={() => setAction(null)} onConfirm={(pin) => void confirmAction(pin)} />}
    {disputing && <DisputeDialog escrow={disputing} busy={busy} onCancel={() => setDisputing(null)} onConfirm={(reason) => void confirmDispute(reason)} />}
  </section>;
}
