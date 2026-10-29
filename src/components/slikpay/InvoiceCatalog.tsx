import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Check, Clock3, Copy, FileText, Loader2, Package, Plus, RefreshCw, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvoice, listInvoices, type InvoiceItem, type InvoiceView } from "@/lib/invoices.functions";
import { checkoutProduct, createProduct, deleteProduct, listProducts, type ProductView } from "@/lib/products.functions";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"];

function statusBadge(inv: InvoiceView) {
  if (inv.status === "paid") return { label: "Paid", className: "border-success/40 bg-success/10 text-success" };
  if (inv.overdue) return { label: "Overdue", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  if (inv.status === "awaiting") return { label: "Awaiting payment", className: "border-cyan/40 bg-cyan/10 text-cyan" };
  if (inv.status === "failed") return { label: "Failed", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  return { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" };
}

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="outline" size="sm" aria-label={label} onClick={async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Copy unavailable"); }
  }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy</Button>;
}

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={label} className="slik-popup max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold">{label}</h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      {children}
    </div>
  </div>;
}

/* ---------------- Invoices ---------------- */

function InvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (i: InvoiceView) => void }) {
  const createFn = useServerFn(createInvoice);
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = Math.round(items.reduce((a, i) => a + (i.quantity || 0) * (i.unitPrice || 0), 0) * 100) / 100;
  const itemsValid = items.every((i) => i.description.trim() && i.quantity > 0 && i.unitPrice > 0);
  const valid = customer.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && dueDate && itemsValid && total > 0;

  const setItem = (idx: number, patch: Partial<InvoiceItem>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const inv = await createFn({ data: { customer: customer.trim(), email: email.trim(), currency: currency as never, items, dueDate, note: note.trim() || undefined, reference: `SLKINV-${crypto.randomUUID()}` } });
      toast.success(`Invoice ${inv.number} created`);
      onCreated(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this invoice. Try again.");
      setBusy(false);
    }
  };

  return <Dialog label="New invoice" onClose={onClose}>
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="inv-customer">Customer name</Label>
          <Input id="inv-customer" value={customer} maxLength={120} onChange={(e) => setCustomer(e.target.value)} placeholder="Acme Ltd" autoComplete="off" required /></div>
        <div className="space-y-1.5"><Label htmlFor="inv-email">Customer email</Label>
          <Input id="inv-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="billing@acme.com" autoComplete="off" required /></div>
        <div className="space-y-1.5"><Label htmlFor="inv-currency">Currency</Label>
          <select id="inv-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="space-y-1.5"><Label htmlFor="inv-due">Due date</Label>
          <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Items</p>
        {items.map((it, idx) => <div key={idx} className="grid grid-cols-[1fr_64px_96px_32px] items-end gap-2">
          <div className="space-y-1">{idx === 0 && <Label>Description</Label>}
            <Input aria-label={`Item ${idx + 1} description`} value={it.description} maxLength={120} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Service or product" /></div>
          <div className="space-y-1">{idx === 0 && <Label>Qty</Label>}
            <Input aria-label={`Item ${idx + 1} quantity`} inputMode="decimal" value={it.quantity || ""} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) || 0 })} placeholder="1" /></div>
          <div className="space-y-1">{idx === 0 && <Label>Unit price</Label>}
            <Input aria-label={`Item ${idx + 1} unit price`} inputMode="decimal" value={it.unitPrice || ""} onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) || 0 })} placeholder="0.00" /></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${idx + 1}`} disabled={items.length === 1} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])}><Plus className="h-3.5 w-3.5" />Add item</Button>
      </div>

      <div className="space-y-1.5"><Label htmlFor="inv-note">Note <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="inv-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Payment terms, thanks, anything" autoComplete="off" /></div>

      <div className="flex items-center justify-between rounded-xl border border-cyan/40 bg-cyan/5 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Invoice total</span>
        <strong className="text-lg tabular-nums text-cobalt">{money(total, currency)}</strong>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!valid || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{busy ? "Creating…" : "Create invoice"}
      </Button>
    </form>
  </Dialog>;
}

export function InvoicesPanel() {
  const listFn = useServerFn(listInvoices);
  const [invoices, setInvoices] = useState<InvoiceView[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await listFn(); setInvoices(r.invoices); }
    catch (e) { setError(e instanceof Error ? e.message : "Your invoices could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = invoices ?? [];
    return q ? all.filter((i) => `${i.number} ${i.customer} ${i.email}`.toLowerCase().includes(q)) : all;
  }, [invoices, search]);

  const paid = (invoices ?? []).filter((i) => i.status === "paid");
  const overdue = (invoices ?? []).filter((i) => i.overdue);
  const outstanding = (invoices ?? []).filter((i) => i.status === "awaiting" && !i.overdue);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">Every invoice carries a hosted checkout link — your customer pays online and the status updates here.</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Refresh invoices" disabled={loading} onClick={() => void load()}><RefreshCwIcon loading={loading} /></Button>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New invoice</Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-cyan" />Outstanding</p>
        <p className="mt-1.5 text-lg font-extrabold tabular-nums">{invoices ? outstanding.length : "—"}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Paid</p>
        <p className="mt-1.5 text-lg font-extrabold tabular-nums">{invoices ? paid.length : "—"}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><TriangleAlert className="h-3.5 w-3.5 text-magenta" />Overdue</p>
        <p className="mt-1.5 text-lg font-extrabold tabular-nums">{invoices ? overdue.length : "—"}</p>
      </div>
    </div>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, customer or email" aria-label="Search invoices"
        className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
    </div>

    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
    {loading && !invoices && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your invoices…</p>}

    {invoices && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-magenta/10"><FileText className="h-6 w-6 text-magenta" /></span>
      <h3 className="mt-4 font-bold">{invoices.length ? "No invoices match your search" : "No invoices yet"}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{invoices.length ? "Try a different number, customer or email." : "Create an invoice with line items and a due date — your customer gets a secure checkout link to pay it."}</p>
      {!invoices.length && <Button className="mt-5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create your first invoice</Button>}
    </div>}

    <ul className="space-y-3">
      {filtered.map((inv) => {
        const st = statusBadge(inv);
        return <li key={inv.reference} className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-cobalt">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2"><span className="font-mono text-xs font-bold text-cobalt">{inv.number}</span><span className="text-base font-extrabold tabular-nums">{money(inv.total, inv.currency)}</span></p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{inv.customer} · {inv.email}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{inv.items.length} item{inv.items.length === 1 ? "" : "s"} · Due {new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{inv.url}</code>
            <CopyLink url={inv.url} label={`Copy checkout link for invoice ${inv.number}`} />
            <a href={inv.url} target="_blank" rel="noreferrer" aria-label={`Open checkout for invoice ${inv.number}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-cobalt hover:bg-muted/50">Open<ArrowUpRight className="h-3.5 w-3.5" /></a>
          </div>
        </li>;
      })}
    </ul>

    {creating && <InvoiceDialog onClose={() => setCreating(false)} onCreated={(i) => { setCreating(false); setInvoices((prev) => (prev ? [i, ...prev] : prev)); }} />}
  </div>;
}

function RefreshCwIcon({ loading }: { loading: boolean }) {
  return <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />;
}

/* ---------------- Product catalog ---------------- */

function ProductDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: ProductView) => void }) {
  const createFn = useServerFn(createProduct);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const priceValid = /^\d+(?:\.\d{1,2})?$/.test(price) && Number(price) > 0;
  const valid = name.trim().length >= 2 && priceValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const p = await createFn({ data: { id: crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined, price: Number(price), currency: currency as never } });
      toast.success("Product added to your catalog");
      onCreated(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this product. Try again.");
      setBusy(false);
    }
  };

  return <Dialog label="Add product" onClose={onClose}>
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <div className="space-y-1.5"><Label htmlFor="pd-name">Product name</Label>
        <Input id="pd-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Website design package" autoComplete="off" required /></div>
      <div className="space-y-1.5"><Label htmlFor="pd-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="pd-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="What the customer gets" autoComplete="off" /></div>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <div className="space-y-1.5"><Label htmlFor="pd-price">Price</Label>
          <Input id="pd-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" autoComplete="off" required /></div>
        <div className="space-y-1.5"><Label htmlFor="pd-currency">Currency</Label>
          <select id="pd-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!valid || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}{busy ? "Saving…" : "Save product"}
      </Button>
    </form>
  </Dialog>;
}

function ProductCheckoutDialog({ product, onClose, onCreated }: { product: ProductView; onClose: () => void; onCreated: (url: string) => void }) {
  const checkoutFn = useServerFn(checkoutProduct);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || busy) return;
    setBusy(true); setError("");
    try {
      const r = await checkoutFn({ data: { id: product.id, email: email.trim(), name: name.trim() || undefined, reference: `SLKPROD-${crypto.randomUUID()}` } });
      toast.success("Checkout link created");
      onCreated(r.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this checkout. Try again.");
      setBusy(false);
    }
  };

  return <Dialog label={`Checkout — ${product.name}`} onClose={onClose}>
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">{product.name} · <strong className="tabular-nums">{money(product.price, product.currency)}</strong></p>
      <div className="space-y-1.5"><Label htmlFor="pc-email">Customer email</Label>
        <Input id="pc-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" autoComplete="off" required /></div>
      <div className="space-y-1.5"><Label htmlFor="pc-name">Customer name <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="pc-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Who is paying?" autoComplete="off" /></div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!emailValid || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}{busy ? "Creating…" : "Create checkout link"}
      </Button>
    </form>
  </Dialog>;
}

export function CatalogPanel() {
  const listFn = useServerFn(listProducts);
  const deleteFn = useServerFn(deleteProduct);
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkout, setCheckout] = useState<ProductView | null>(null);
  const [createdUrl, setCreatedUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await listFn(); setProducts(r.products); }
    catch (e) { setError(e instanceof Error ? e.message : "Your catalog could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = products ?? [];
    return q ? all.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)) : all;
  }, [products, search]);

  const remove = async (p: ProductView) => {
    try {
      await deleteFn({ data: { id: p.id } });
      setProducts((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
      toast.success("Product removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove this product."); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">List a product once, then turn it into a checkout link for any customer in one tap.</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Refresh catalog" disabled={loading} onClick={() => void load()}><RefreshCwIcon loading={loading} /></Button>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add product</Button>
      </div>
    </div>

    {createdUrl && <div className="rounded-2xl border border-success/40 bg-success/5 p-5" role="status">
      <p className="flex items-center gap-2 font-bold text-success"><BadgeCheck className="h-5 w-5" />Checkout link ready</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs">{createdUrl}</code>
        <CopyLink url={createdUrl} label="Copy product checkout link" />
        <Button variant="ghost" size="sm" onClick={() => setCreatedUrl("")}>Done</Button>
      </div>
    </div>}

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" aria-label="Search products"
        className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
    </div>

    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
    {loading && !products && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your catalog…</p>}

    {products && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10"><Package className="h-6 w-6 text-cobalt" /></span>
      <h3 className="mt-4 font-bold">{products.length ? "No products match your search" : "Your catalog is empty"}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{products.length ? "Try a different name or description." : "Add your first product or service with a price — then create a checkout link for any customer in one tap."}</p>
      {!products.length && <Button className="mt-5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add your first product</Button>}
    </div>}

    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((p) => <li key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-cobalt">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-bold">{p.name}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${p.name}`} onClick={() => void remove(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
        <p className="mt-2 text-lg font-extrabold tabular-nums text-cobalt">{money(p.price, p.currency)}</p>
        <Button variant="outline" size="sm" className="mt-3 border-cyan/50 text-cyan hover:bg-cyan/5" onClick={() => setCheckout(p)}><ArrowUpRight className="h-3.5 w-3.5" />Create checkout</Button>
      </li>)}
    </ul>

    {adding && <ProductDialog onClose={() => setAdding(false)} onCreated={(p) => { setAdding(false); setProducts((prev) => (prev ? [p, ...prev] : prev)); }} />}
    {checkout && <ProductCheckoutDialog product={checkout} onClose={() => setCheckout(null)} onCreated={(url) => { setCheckout(null); setCreatedUrl(url); }} />}
  </div>;
}
