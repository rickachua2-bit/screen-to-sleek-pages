import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Check, Clock3, Copy, FileText, Link2, Loader2, Package, Plus, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPaymentLink, listPaymentLinks, type PaymentLinkView } from "@/lib/payment-links.functions";
import { useBankingProfile } from "./PaddleConsole";
import { CatalogPanel, InvoicesPanel } from "./InvoiceCatalog";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"];

const STATUS_STYLE: Record<PaymentLinkView["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "border-success/40 bg-success/10 text-success" },
  awaiting: { label: "Awaiting payment", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  failed: { label: "Failed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  unknown: { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="outline" size="sm" aria-label={label} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Copy unavailable"); }
  }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy</Button>;
}

function CreateLinkDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (l: PaymentLinkView) => void }) {
  const createFn = useServerFn(createPaymentLink);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountValid || !emailValid || busy) return;
    setBusy(true); setError("");
    try {
      const link = await createFn({ data: { amount: Number(amount), currency: currency as never, email: email.trim(), name: name.trim() || undefined, reference: `SLKLINK-${crypto.randomUUID()}` } });
      toast.success("Payment link created");
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this link. Try again.");
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Create payment link" className="slik-popup w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold">Create payment link</h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div className="space-y-1.5"><Label htmlFor="pl-amount">Amount</Label>
            <Input id="pl-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" required />
          </div>
          <div className="space-y-1.5"><Label htmlFor="pl-currency">Currency</Label>
            <select id="pl-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="pl-email">Customer email</Label>
          <Input id="pl-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" autoComplete="off" required />
        </div>
        <div className="space-y-1.5"><Label htmlFor="pl-name">Customer name <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="pl-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Who is paying?" autoComplete="off" />
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={!amountValid || !emailValid || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{busy ? "Creating…" : "Create link"}
        </Button>
      </form>
    </div>
  </div>;
}

function CreatedPanel({ link, onDone }: { link: PaymentLinkView; onDone: () => void }) {
  return <div className="rounded-2xl border border-success/40 bg-success/5 p-5" role="status">
    <p className="flex items-center gap-2 font-bold text-success"><BadgeCheck className="h-5 w-5" />Your payment link is ready</p>
    <p className="mt-1 text-sm text-muted-foreground">Share it with {link.name ?? link.email} — they pay {money(link.amount, link.currency)} on a secure hosted page.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs">{link.url}</code>
      <CopyButton text={link.url} label="Copy new payment link" />
      <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-cobalt hover:bg-muted/50">Open<ArrowUpRight className="h-3.5 w-3.5" /></a>
      <Button variant="ghost" size="sm" onClick={onDone}>Done</Button>
    </div>
  </div>;
}


export function PaymentLinks() {
  const listFn = useServerFn(listPaymentLinks);
  const { profile } = useBankingProfile();
  const [tab, setTab] = useState<"links" | "invoices" | "catalog">("links");
  const [links, setLinks] = useState<PaymentLinkView[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<PaymentLinkView | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await listFn(); setLinks(r.links); }
    catch (e) { setError(e instanceof Error ? e.message : "Your payment links could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = links ?? [];
    return q ? all.filter((l) => `${l.reference} ${l.email} ${l.name ?? ""}`.toLowerCase().includes(q)) : all;
  }, [links, search]);

  const paid = (links ?? []).filter((l) => l.status === "paid");
  const awaiting = (links ?? []).filter((l) => l.status === "awaiting");

  return <section className="space-y-5" aria-label="Payment links">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold">Payment links</h2>
        <p className="mt-1 text-xs text-muted-foreground">{profile ? (profile.mode === "live" ? "Live account" : "Sandbox account") : "Checking account…"} · hosted checkout on every link</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Refresh payment links" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create link</Button>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 border-b border-border pb-4" role="group" aria-label="Collections">
      <Button variant={tab === "links" ? "default" : "outline"} aria-pressed={tab === "links"} onClick={() => setTab("links")}><Link2 />Payment links</Button>
      <Button variant={tab === "invoices" ? "default" : "outline"} aria-pressed={tab === "invoices"} onClick={() => setTab("invoices")}><FileText />Invoices</Button>
      <Button variant={tab === "catalog" ? "default" : "outline"} aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}><Package />Product catalog</Button>
    </div>

    {tab === "invoices" && <InvoicesPanel />}
    {tab === "catalog" && <CatalogPanel />}

    {tab === "links" && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Link2 className="h-3.5 w-3.5 text-cobalt" />Links created</p>
          <p className="mt-1.5 text-lg font-extrabold tabular-nums">{links?.length ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Paid</p>
          <p className="mt-1.5 text-lg font-extrabold tabular-nums">{links ? paid.length : "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-magenta" />Awaiting payment</p>
          <p className="mt-1.5 text-lg font-extrabold tabular-nums">{links ? awaiting.length : "—"}</p>
        </div>
      </div>

      {created && <CreatedPanel link={created} onDone={() => setCreated(null)} />}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer, email or reference" aria-label="Search payment links"
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {loading && !links && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your links…</p>}

      {links && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan/10"><Link2 className="h-6 w-6 text-cyan" /></span>
        <h3 className="mt-4 font-bold">{links.length ? "No links match your search" : "No payment links yet"}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{links.length ? "Try a different customer, email or reference." : "Create your first link and share it anywhere — your customer pays on a secure hosted page and the money lands in your Slikpay balance."}</p>
        {!links.length && <Button className="mt-5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create your first link</Button>}
      </div>}

      <ul className="space-y-3">
        {filtered.map((l) => {
          const st = STATUS_STYLE[l.status];
          return <li key={l.reference} className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-cobalt">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-extrabold tabular-nums">{money(l.amount, l.currency)}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{l.name ? `${l.name} · ` : ""}{l.email}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{l.reference}{l.createdAt ? ` · ${new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{l.url}</code>
              <CopyButton text={l.url} label={`Copy payment link ${l.reference}`} />
              <a href={l.url} target="_blank" rel="noreferrer" aria-label={`Open payment link ${l.reference}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-cobalt hover:bg-muted/50">Open<ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
          </li>;
        })}
      </ul>
    </>}

    {creating && <CreateLinkDialog onClose={() => setCreating(false)} onCreated={(l) => { setCreating(false); setCreated(l); setLinks((prev) => (prev ? [l, ...prev] : prev)); }} />}
  </section>;
}
