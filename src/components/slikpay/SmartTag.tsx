import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { ArrowUpRight, BadgeCheck, Check, Clock3, Copy, Loader2, Lock, Pencil, Printer, QrCode, RefreshCw, Search, Speaker, Tag, Trash2, TriangleAlert, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chargeSmartTag, createSmartTag, listSmartTags, listSoundboxes, registerSoundbox, tagUrl, unlinkSoundbox, updateSoundbox, SOUNDBOX_VOICES, TAG_CURRENCIES, type SmartTagView, type SoundboxView, type TagChargeView } from "@/lib/smarttag.functions";
import { useBankingProfile } from "./PaddleConsole";
import hero from "@/assets/collections-hero.jpg";

const money = (n: number, currency: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const STATUS_STYLE: Record<TagChargeView["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "border-success/40 bg-success/10 text-success" },
  awaiting: { label: "Awaiting payment", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  failed: { label: "Failed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  unknown: { label: "Status unknown", className: "border-border bg-muted/50 text-muted-foreground" },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="outline" size="sm" aria-label={label} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Copy unavailable"); }
  }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy</Button>;
}

function QrBadge({ value, label, size = 96 }: { value: string; label: string; size?: number }) {
  return <span className="inline-flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3">
    <QRCodeSVG value={value} size={size} bgColor="transparent" fgColor="currentColor" className="text-foreground" aria-label={label} role="img" />
    <span className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">{value}</span>
  </span>;
}

function CreateTagCard({ onCreated }: { onCreated: (t: SmartTagView) => void }) {
  const createFn = useServerFn(createSmartTag);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handleValid = /^[a-z0-9][a-z0-9-]{1,29}$/.test(handle);
  const amountValid = amount === "" || (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleValid || !amountValid || !emailValid || name.trim().length < 2 || busy) return;
    setBusy(true); setError("");
    try {
      const tag = await createFn({ data: { handle, name: name.trim(), amount: amount ? Number(amount) : undefined, currency: currency as never, email: email.trim() } });
      toast.success(`@${tag.handle} is live`);
      setName(""); setHandle(""); setAmount("");
      onCreated(tag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this tag. Try again.");
    } finally { setBusy(false); }
  };

  return <form className="rounded-2xl border border-border bg-card p-5 shadow-sm" onSubmit={(e) => void submit(e)} aria-label="Create SmartTag">
    <h3 className="font-bold">Create a SmartTag</h3>
    <p className="mt-0.5 text-xs text-muted-foreground">Your tag is a short name customers scan or tap to pay you. Add a fixed amount to make the QR work instantly.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="st-name">Display name</Label>
        <Input id="st-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Adaeze Kitchen — Counter 1" autoComplete="off" required />
      </div>
      <div className="space-y-1.5"><Label htmlFor="st-handle">Tag name</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cobalt">@</span>
          <Input id="st-handle" value={handle} maxLength={30} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="adaeze-kitchen" autoComplete="off" required className="pl-7 font-mono" />
        </div>
        {handle && !handleValid && <p className="text-[11px] text-destructive">2–30 lowercase letters, numbers or dashes.</p>}
      </div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5"><Label htmlFor="st-amount">Fixed amount <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="st-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Leave empty for open amounts" autoComplete="off" className="h-11 font-bold tabular-nums" />
      </div>
      <div className="space-y-1.5"><Label id="st-currency-label">Currency</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="st-currency-label">
          {TAG_CURRENCIES.slice(0, 4).map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}
            className={`h-11 rounded-lg border px-3 text-xs font-bold transition-colors ${currency === c ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>{c}</button>)}
          <select aria-label="More currencies" value={(TAG_CURRENCIES as readonly string[]).slice(0, 4).includes(currency) ? "" : currency} onChange={(e) => e.target.value && setCurrency(e.target.value)}
            className={`h-11 rounded-lg border px-2 text-xs font-bold ${(TAG_CURRENCIES as readonly string[]).slice(0, 4).includes(currency) ? "border-border bg-background text-muted-foreground" : "border-cobalt bg-cobalt text-primary-foreground"}`}>
            <option value="">More</option>
            {TAG_CURRENCIES.slice(4).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
    <div className="mt-3 space-y-1.5"><Label htmlFor="st-email">Contact email</Label>
      <Input id="st-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" autoComplete="off" required />
      <p className="text-[11px] text-muted-foreground">Used for receipts on payments made to this tag.</p>
    </div>
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    <Button type="submit" variant="brand" className="mt-4 w-full" disabled={!handleValid || !amountValid || !emailValid || name.trim().length < 2 || busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}{busy ? "Creating…" : "Create SmartTag"}
    </Button>
  </form>;
}

function ChargeDialog({ tag, onClose, onCharged }: { tag: SmartTagView; onClose: () => void; onCharged: (c: TagChargeView) => void }) {
  const chargeFn = useServerFn(chargeSmartTag);
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [charge, setCharge] = useState<TagChargeView | null>(null);
  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountValid || busy) return;
    setBusy(true); setError("");
    try {
      const c = await chargeFn({ data: { handle: tag.handle, amount: Number(amount), email: email.trim() || undefined, reference: `SLKTAG-${crypto.randomUUID()}` } });
      setCharge(c); onCharged(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start this charge. Try again.");
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={`Charge @${tag.handle}`} className="slik-popup w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
      {!charge ? <>
        <h2 className="font-bold">Charge @{tag.handle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Enter the amount — your customer pays on a secure hosted page in {tag.currency}.</p>
        <form className="mt-4 space-y-3" onSubmit={(e) => void submit(e)}>
          <div className="space-y-1.5"><Label htmlFor="st-charge-amount">Amount ({tag.currency})</Label>
            <Input id="st-charge-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" required className="h-11 text-lg font-bold tabular-nums" />
          </div>
          <div className="space-y-1.5"><Label htmlFor="st-charge-email">Customer email <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="st-charge-email" type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" autoComplete="off" />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" className="flex-1" disabled={!amountValid || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}{busy ? "Starting…" : "Start charge"}
            </Button>
          </div>
        </form>
      </> : <div role="status">
        <p className="flex items-center gap-2 font-bold text-success"><BadgeCheck className="h-5 w-5" />Charge ready — {money(charge.amount, charge.currency)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Show this QR or share the link. You are notified the moment they pay.</p>
        <div className="mt-4 flex justify-center"><QrBadge value={charge.url} label={`Payment QR for ${charge.reference}`} size={160} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs">{charge.url}</code>
          <CopyButton text={charge.url} label={`Copy charge link ${charge.reference}`} />
          <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>}
    </div>
  </div>;
}

function TagCard({ tag, onCharge }: { tag: SmartTagView; onCharge: (t: SmartTagView) => void }) {
  const url = tag.checkoutUrl ?? tagUrl(tag.handle);
  const [showQr, setShowQr] = useState(false);
  return <li className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-cobalt">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-base font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cobalt/10"><Tag className="h-3.5 w-3.5 text-cobalt" /></span>@{tag.handle}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{tag.name}</p>
        <p className="mt-1 text-xs font-semibold text-cyan">{tag.amount ? `Fixed · ${money(tag.amount, tag.currency)}` : `Open amount · ${tag.currency}`}</p>
      </div>
      <Button variant="outline" size="sm" aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}><QrCode className="h-3.5 w-3.5" />{showQr ? "Hide QR" : "Show QR"}</Button>
    </div>
    {showQr && <div className="mt-3 flex justify-center rounded-xl border border-dashed border-border bg-muted/30 py-4"><QrBadge value={url} label={`QR for @${tag.handle}`} size={140} /></div>}
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</code>
      <CopyButton text={url} label={`Copy tag link @${tag.handle}`} />
      {!tag.amount && <Button variant="brand" size="sm" onClick={() => onCharge(tag)}>New charge</Button>}
      {tag.checkoutUrl && <a href={tag.checkoutUrl} target="_blank" rel="noreferrer" aria-label={`Open checkout for @${tag.handle}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-cobalt hover:bg-muted/50">Open<ArrowUpRight className="h-3.5 w-3.5" /></a>}
    </div>
  </li>;
}

function QrStands({ tags }: { tags: SmartTagView[] }) {
  const [selected, setSelected] = useState("");
  if (!tags.length) return <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan/10"><QrCode className="h-6 w-6 text-cyan" /></span>
    <h3 className="mt-4 font-bold">Create a SmartTag first</h3>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">Your printable QR stand is generated from a SmartTag. Create one in the SmartTags tab, then come back here.</p>
  </div>;
  const tag = tags.find((t) => t.handle === selected) ?? tags[0]!;
  const url = tag.checkoutUrl ?? tagUrl(tag.handle);
  return <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-bold">Printable QR stand</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Pick a tag, then print the stand for your counter, table or stall.</p>
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Choose tag for QR stand">
        {tags.map((t) => <button key={t.handle} type="button" aria-pressed={tag.handle === t.handle} onClick={() => setSelected(t.handle)}
          className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${tag.handle === t.handle ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>@{t.handle}</button>)}
      </div>
      <Button variant="brand" className="mt-4" onClick={() => window.print()}><Printer className="h-4 w-4" />Print stand</Button>
    </div>
    <div className="qr-stand mx-auto w-full max-w-xs rounded-3xl p-6 text-center shadow-cobalt" aria-label={`QR stand preview for @${tag.handle}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan">Scan to pay</p>
      <p className="mt-1 truncate text-lg font-extrabold text-primary-foreground">{tag.name}</p>
      <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={url} size={180} aria-label={`QR code for @${tag.handle}`} role="img" /></div>
      <p className="mt-3 font-mono text-sm font-bold text-cyan">@{tag.handle}</p>
      <p className="mt-1 text-[11px] text-primary-foreground/70">{tag.amount ? money(tag.amount, tag.currency) : `Any amount · ${tag.currency}`} · Powered by Slikpay</p>
    </div>
  </div>;
}

function speakPreview(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { toast.error("Voice preview is not available on this device."); return; }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function SoundboxCard({ box, charges, onEdit, onUnlink, busy }: { box: SoundboxView; charges: TagChargeView[]; onEdit: (b: SoundboxView) => void; onUnlink: (b: SoundboxView) => void; busy: boolean }) {
  const recent = charges.filter((c) => c.handle === box.handle).slice(0, 3);
  return <li className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-cobalt">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-base font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-magenta/10"><Speaker className="h-3.5 w-3.5 text-magenta" /></span>{box.label}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{box.deviceId}</p>
        <p className="mt-1 text-xs font-semibold text-cyan">Announces payments to @{box.handle} · {box.voice}</p>
      </div>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" aria-label={`Preview voice for ${box.label}`} onClick={() => speakPreview(`Payment received. Five thousand naira. Thank you.`)}><Volume2 className="h-3.5 w-3.5" />Preview</Button>
        <Button variant="outline" size="sm" aria-label={`Edit ${box.label}`} disabled={busy} onClick={() => onEdit(box)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
        <Button variant="outline" size="sm" aria-label={`Unlink ${box.label}`} disabled={busy} onClick={() => onUnlink(box)}><Trash2 className="h-3.5 w-3.5" />Unlink</Button>
      </div>
    </div>
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recent payments on @{box.handle}</p>
      {recent.length ? <ul className="mt-2 space-y-1.5">
        {recent.map((c) => { const st = STATUS_STYLE[c.status]; return <li key={c.reference} className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold tabular-nums">{money(c.amount, c.currency)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
        </li>; })}
      </ul> : <p className="mt-2 text-xs text-muted-foreground">No payments on this tag yet.</p>}
    </div>
  </li>;
}

function Soundboxes({ tags, charges }: { tags: SmartTagView[]; charges: TagChargeView[] }) {
  const listFn = useServerFn(listSoundboxes);
  const registerFn = useServerFn(registerSoundbox);
  const updateFn = useServerFn(updateSoundbox);
  const unlinkFn = useServerFn(unlinkSoundbox);
  const [boxes, setBoxes] = useState<SoundboxView[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SoundboxView | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [voice, setVoice] = useState<string>(SOUNDBOX_VOICES[0]);
  const deviceValid = /^[A-Z0-9][A-Z0-9-]{3,23}$/.test(deviceId);
  const linkedHandle = handle || tags[0]?.handle || "";

  const load = useCallback(async () => {
    setError("");
    try { const r = await listFn(); setBoxes(r.soundboxes); }
    catch (e) { setError(e instanceof Error ? e.message : "Your soundboxes could not be loaded. Try again."); }
  }, [listFn]);
  useEffect(() => { void load(); }, [load]);

  const startEdit = (b: SoundboxView) => { setEditing(b); setDeviceId(b.deviceId); setLabel(b.label); setHandle(b.handle); setVoice(b.voice); };
  const resetForm = () => { setEditing(null); setDeviceId(""); setLabel(""); setHandle(""); setVoice(SOUNDBOX_VOICES[0]); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceValid || label.trim().length < 2 || !linkedHandle || busy) return;
    setBusy(true); setError("");
    try {
      if (editing) {
        const updated = await updateFn({ data: { deviceId: editing.deviceId, label: label.trim(), voice: voice as never } });
        setBoxes((prev) => prev?.map((b) => (b.deviceId === updated.deviceId ? updated : b)) ?? prev);
        toast.success(`${updated.label} updated`);
      } else {
        const created = await registerFn({ data: { deviceId, label: label.trim(), handle: linkedHandle, voice: voice as never } });
        setBoxes((prev) => (prev ? [created, ...prev] : prev));
        toast.success(`${created.label} registered`);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The soundbox could not be saved. Try again.");
    } finally { setBusy(false); }
  };

  const unlink = async (b: SoundboxView) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await unlinkFn({ data: { deviceId: b.deviceId } });
      setBoxes((prev) => prev?.filter((x) => x.deviceId !== b.deviceId) ?? prev);
      if (editing?.deviceId === b.deviceId) resetForm();
      toast.success(`${b.label} unlinked`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The soundbox could not be unlinked. Try again.");
    } finally { setBusy(false); }
  };

  if (!tags.length) return <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-magenta/10"><Speaker className="h-6 w-6 text-magenta" /></span>
    <h3 className="mt-4 font-bold">Create a SmartTag first</h3>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">A soundbox announces payments made to one of your SmartTags. Create a tag in the SmartTags tab, then register your device here.</p>
  </div>;

  return <div className="space-y-4">
    <form className="rounded-2xl border border-border bg-card p-5 shadow-sm" onSubmit={(e) => void submit(e)} aria-label={editing ? `Edit ${editing.label}` : "Register soundbox"}>
      <h3 className="font-bold">{editing ? `Edit ${editing.label}` : "Register a soundbox"}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{editing ? "Rename the device or change its announcement voice. The device ID and linked tag stay fixed." : "Enter the device ID printed on your soundbox and link it to a SmartTag. It will announce every payment to that tag."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="sb-device">Device ID</Label>
          <Input id="sb-device" value={deviceId} maxLength={24} disabled={!!editing} onChange={(e) => setDeviceId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="SLK-BOX-0001" autoComplete="off" required className="font-mono" />
          {deviceId && !deviceValid && <p className="text-[11px] text-destructive">4–24 capital letters, numbers or dashes.</p>}
        </div>
        <div className="space-y-1.5"><Label htmlFor="sb-label">Counter name</Label>
          <Input id="sb-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Front counter" autoComplete="off" required />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label id="sb-tag-label">Announces payments to</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="sb-tag-label">
            {tags.map((t) => <button key={t.handle} type="button" disabled={!!editing} aria-pressed={linkedHandle === t.handle} onClick={() => setHandle(t.handle)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${linkedHandle === t.handle ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-cobalt/50"}`}>@{t.handle}</button>)}
          </div>
        </div>
        <div className="space-y-1.5"><Label id="sb-voice-label">Announcement voice</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="sb-voice-label">
            {SOUNDBOX_VOICES.map((v) => <button key={v} type="button" aria-pressed={voice === v} onClick={() => setVoice(v)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${voice === v ? "border-magenta bg-magenta text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-magenta/50"}`}>{v}</button>)}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        {editing && <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>}
        <Button type="submit" variant="brand" className="flex-1" disabled={!deviceValid || label.trim().length < 2 || !linkedHandle || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Speaker className="h-4 w-4" />}{busy ? "Saving…" : editing ? "Save changes" : "Register soundbox"}
        </Button>
      </div>
    </form>

    <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3.5 text-xs text-muted-foreground">
      <p className="flex items-start gap-2"><Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />Registration links your device to a tag and stores its voice preference. On-device audio pairing is handled by the soundbox itself once it comes online; the Preview button plays a sample announcement on this device.</p>
    </div>

    {boxes === null && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your soundboxes…</p>}
    {boxes && !boxes.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-magenta/10"><Speaker className="h-6 w-6 text-magenta" /></span>
      <h3 className="mt-4 font-bold">No soundboxes registered</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Register your first device above — it takes under a minute.</p>
    </div>}
    <ul className="space-y-3">
      {(boxes ?? []).map((b) => <SoundboxCard key={b.deviceId} box={b} charges={charges} busy={busy} onEdit={startEdit} onUnlink={(x) => void unlink(x)} />)}
    </ul>
  </div>;
}

const TABS = [
  { id: "tags", label: "SmartTags", icon: Tag },
  { id: "stands", label: "QR stands", icon: QrCode },
  { id: "soundboxes", label: "Soundboxes", icon: Speaker },
] as const;

export function SmartTag({ preview }: { preview?: { tags: SmartTagView[]; charges: TagChargeView[] } }) {
  const listFn = useServerFn(listSmartTags);
  const { profile } = useBankingProfile();
  const [tab, setTab] = useState<"tags" | "stands" | "soundboxes">("tags");
  const [tags, setTags] = useState<SmartTagView[] | null>(preview?.tags ?? null);
  const [charges, setCharges] = useState<TagChargeView[] | null>(preview?.charges ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [search, setSearch] = useState("");
  const [charging, setCharging] = useState<SmartTagView | null>(null);

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError("");
    try { const r = await listFn(); setTags(r.tags); setCharges(r.charges); }
    catch (e) { setError(e instanceof Error ? e.message : "Your SmartTags could not be loaded. Try again."); }
    finally { setLoading(false); }
  }, [listFn, preview]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = tags ?? [];
    return q ? all.filter((t) => `${t.handle} ${t.name}`.toLowerCase().includes(q)) : all;
  }, [tags, search]);

  const paid = (charges ?? []).filter((c) => c.status === "paid");
  const awaiting = (charges ?? []).filter((c) => c.status === "awaiting");

  return <section className="transfer-center collections-composer space-y-5" aria-label="QR & SmartTag">
    <div>
      <h2 className="text-2xl font-bold text-foreground">QR & SmartTag</h2>
      <p className="mt-1 text-sm text-muted-foreground">{profile ? (profile.mode === "live" ? "Live account" : "Sandbox account") : "Checking account…"} · in-person and scan-to-pay collections</p>
    </div>
    <div className="transfer-composer-layout">
      <aside className="transfer-story">
        <span className="transfer-eyebrow"><QrCode className="h-4 w-4" />IN-PERSON PAYMENTS</span>
        <h2>One scan.<br /><span>Paid.</span></h2>
        <p className="crypto-story-description">Give every counter, table or stall its own SmartTag. Customers scan the QR, pay on a secure page, and the money lands in your Slikpay balance.</p>
        <img src={hero} alt="A glowing Slikpay QR stand on a shop counter" width={1152} height={640} className="collections-hero" loading="lazy" />
        <ol className="crypto-stages">{[
          ["Create a tag", "Name it, pick a currency, set a fixed amount or leave it open."],
          ["Print or show the QR", "Stand it on your counter or show it from your phone."],
          ["Get paid instantly", "Every payment is confirmed live and lands in your balance."],
        ].map(([title, detail], i) => <li key={title}><span className="crypto-stage-number">{i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol>
        <p className="crypto-story-security"><Lock className="h-3.5 w-3.5" />Hosted checkout · Live payment status</p>
      </aside>

      <section className="transfer-composer space-y-4" aria-label="QR & SmartTag workspace">
        <div className="flex flex-wrap gap-2" role="group" aria-label="QR & SmartTag sections">
          {TABS.map((t) => <Button key={t.id} variant={tab === t.id ? "default" : "outline"} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}><t.icon />{t.label}</Button>)}
        </div>

        {tab === "stands" && <QrStands tags={tags ?? []} />}
        {tab === "soundboxes" && <Soundboxes tags={tags ?? []} charges={charges ?? []} />}

        {tab === "tags" && <>
          <CreateTagCard onCreated={(t) => setTags((prev) => (prev ? [t, ...prev] : prev))} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Tag className="h-3.5 w-3.5 text-cobalt" />SmartTags</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{tags?.length ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Paid charges</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{charges ? paid.length : "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5 text-magenta" />Awaiting payment</p>
              <p className="mt-1.5 text-lg font-extrabold tabular-nums">{charges ? awaiting.length : "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tags by name" aria-label="Search SmartTags"
                className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-cobalt focus:outline-none" />
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh SmartTags" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
          </div>

          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          {loading && !tags && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your tags…</p>}

          {tags && !filtered.length && <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan/10"><Tag className="h-6 w-6 text-cyan" /></span>
            <h3 className="mt-4 font-bold">{tags.length ? "No tags match your search" : "No SmartTags yet"}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{tags.length ? "Try a different name." : "Create your first tag above — print the QR stand and start taking scan-to-pay payments in minutes."}</p>
          </div>}

          <ul className="space-y-3">
            {filtered.map((t) => <TagCard key={t.handle} tag={t} onCharge={setCharging} />)}
          </ul>

          {!!charges?.length && <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Recent tag charges</h3>
            <ul className="space-y-2">
              {charges.slice(0, 10).map((c) => {
                const st = STATUS_STYLE[c.status];
                return <li key={c.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold tabular-nums">{money(c.amount, c.currency)} <span className="font-normal text-muted-foreground">· @{c.handle}</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">{c.reference}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
                </li>;
              })}
            </ul>
          </div>}
        </>}
      </section>
    </div>
    {charging && <ChargeDialog tag={charging} onClose={() => setCharging(null)} onCharged={(c) => setCharges((prev) => (prev ? [c, ...prev] : prev))} />}
  </section>;
}
