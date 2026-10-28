import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2, Check, ChevronDown, Globe2, KeyRound, Landmark, Loader2, Lock, MapPin, PartyPopper, Search, ShieldCheck, UserCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MERCHANT_STEPS } from "@/lib/go-live";
import { supabase } from "@/lib/supabase";
import { completeGoLive, confirmTwoFactor, getKybProfile, listSettlementBanks, reuseDirectorAsOwner, saveKybOperations, verifyKybPerson, verifySettlementAccount, type KybPerson } from "@/lib/kyb.functions";

type Profile = Awaited<ReturnType<typeof getKybProfile>>;
type Detail = Profile["steps"][number]["detail"];
const ICONS: Record<string, typeof Check> = { contacts: KeyRound, business_identity: Building2, director_bvn: UserCheck, beneficial_owners: Users, operations: MapPin, settlement_account: Landmark, two_factor: Lock };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function KybFlow() {
  const load = useServerFn(getKybProfile);
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [done, setDone] = useState<Awaited<ReturnType<typeof completeGoLive>> | null>(null);
  const refresh = async () => { try { setP(await load()); setError(""); } catch (e) { setError(errMsg(e)); } };
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const status = (k: string) => (k === "contacts" ? "verified" : p?.steps.find((s) => s.step === k)?.status ?? "none");
  const detail = (k: string): Detail => p?.steps.find((s) => s.step === k)?.detail ?? {};
  const firstOpen = MERCHANT_STEPS.find((s) => status(s.key) !== "verified")?.key ?? null;
  const current = active ?? firstOpen;
  const verifiedCount = MERCHANT_STEPS.filter((s) => status(s.key) === "verified").length;

  if (error) return <div className="rounded-2xl border border-destructive/50 bg-card p-6 text-sm"><p className="font-bold text-destructive">{error}</p><Button className="mt-4" variant="crisp" onClick={refresh}>Retry</Button></div>;
  if (!p) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your business verification…</div>;
  if (done) return <LiveSuccess result={done} />;
  if (p.mode === "live") return <BusinessProfile p={p} detail={detail} />;

  return <div className="space-y-5">
    <header className="relative overflow-hidden rounded-2xl border border-cyan/40 bg-gradient-to-br from-cobalt/30 via-card to-magenta/20 p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-cyan">Go live · Know your business</p>
      <h1 className="mt-1 text-2xl font-black">{p.business.name || "Your business"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{verifiedCount} of {MERCHANT_STEPS.length} complete. Finish every step and your live account number is issued at once.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-gradient-tri transition-all duration-700" style={{ width: `${(verifiedCount / MERCHANT_STEPS.length) * 100}%` }} /></div>
    </header>
    <ol className="space-y-3">
      {MERCHANT_STEPS.map((s, i) => {
        const st = status(s.key); const ok = st === "verified"; const open = current === s.key; const Icon = ICONS[s.key] ?? Check;
        return <li key={s.key} className={`rounded-2xl border bg-card/80 transition ${open ? "border-cyan/60 shadow-cobalt" : "border-border"}`}>
          <button type="button" onClick={() => setActive(open ? "__none" : s.key)} className="flex w-full items-center gap-4 p-4 text-left">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${ok ? "border-cyan bg-cyan/20 text-cyan" : st === "failed" ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>{ok ? <BadgeCheck className="h-5 w-5" /> : <Icon className="h-4 w-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{i + 1}. {s.title}</span><span className="block truncate text-xs text-muted-foreground">{ok ? summaryOf(s.key, detail(s.key), p) : s.detail}</span></span>
            <span className={`text-[11px] font-bold ${ok ? "text-cyan" : st === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{ok ? "Verified" : st === "failed" ? "Needs attention" : "To do"}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <div className="border-t border-border p-5">
            {s.key === "contacts" && <p className="text-sm text-muted-foreground">Your phone number and email ({p.email}) were confirmed with one-time codes when you signed up.</p>}
            {s.key === "business_identity" && <IdentityPanel p={p} />}
            {s.key === "director_bvn" && <PeoplePanel kind="director" people={detail("director_bvn").people ?? []} onDone={refresh} />}
            {s.key === "beneficial_owners" && <PeoplePanel kind="owner" people={detail("beneficial_owners").people ?? []} directors={(detail("director_bvn").people ?? []).filter((x) => x.verified)} onDone={refresh} />}
            {s.key === "operations" && <OperationsPanel saved={detail("operations")} onDone={refresh} />}
            {s.key === "settlement_account" && <SettlementPanel saved={detail("settlement_account")} businessName={p.business.name} onDone={refresh} />}
            {s.key === "two_factor" && <TwoFactorPanel verified={ok} onDone={refresh} />}
          </div>}
        </li>;
      })}
    </ol>
    <GoLiveButton ready={verifiedCount === MERCHANT_STEPS.length} onLive={setDone} />
  </div>;
}

function summaryOf(key: string, d: Detail, p: Profile) {
  if (key === "contacts") return p.email;
  if (key === "business_identity") return `${p.business.name} · ${p.business.rcNumber}`;
  if (key === "director_bvn" || key === "beneficial_owners") return (d.people ?? []).filter((x) => x.verified).map((x) => x.name).join(", ");
  if (key === "operations") return `${String(d["city"] ?? "")}, ${String(d["state"] ?? "")}`;
  if (key === "settlement_account") return `${String(d["bankName"] ?? "")} · ${String(d["accountNumber"] ?? "")}`;
  if (key === "two_factor") return "Authenticator app connected";
  return "";
}

function IdentityPanel({ p }: { p: Profile }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-3">
    {[["Registered name", p.business.name], ["Registration number", p.business.rcNumber || "—"], ["Country", p.business.country]].map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-background/40 p-3"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>)}
    <p className="text-xs text-muted-foreground sm:col-span-3"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-cyan" />Verified against the company registry when you signed up. Nothing more to do here.</p>
  </dl>;
}

function PeoplePanel({ kind, people, directors = [], onDone }: { kind: "director" | "owner"; people: KybPerson[]; directors?: KybPerson[]; onDone: () => Promise<void> }) {
  const verify = useServerFn(verifyKybPerson); const reuse = useServerFn(reuseDirectorAsOwner);
  const [f, setF] = useState({ firstName: "", lastName: "", bvn: "", ownership: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pick, setPick] = useState({ bvn: "", ownership: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!/^\d{11}$/.test(f.bvn)) return setMsg({ ok: false, text: "BVN must be 11 digits." });
    const own = Number(f.ownership);
    if (kind === "owner" && (!own || own < 25 || own > 100)) return setMsg({ ok: false, text: "Ownership must be between 25% and 100%." });
    setBusy(true);
    try { const r = await verify({ data: { kind, firstName: f.firstName, lastName: f.lastName, bvn: f.bvn, ownership: kind === "owner" ? own : undefined } }); setMsg({ ok: r.verified, text: r.message }); if (r.verified) setF({ firstName: "", lastName: "", bvn: "", ownership: "" }); await onDone(); }
    catch (err) { setMsg({ ok: false, text: errMsg(err) }); } finally { setBusy(false); }
  };
  const reuseDir = async () => {
    const own = Number(pick.ownership);
    if (!pick.bvn || !own || own < 25) return setMsg({ ok: false, text: "Pick a director and an ownership of 25% or more." });
    setBusy(true); try { await reuse({ data: { bvn: pick.bvn, ownership: own } }); setMsg({ ok: true, text: "Owner added." }); await onDone(); } catch (err) { setMsg({ ok: false, text: errMsg(err) }); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    {people.length > 0 && <ul className="space-y-2">{people.map((x) => <li key={x.bvn} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-sm"><span className="font-semibold">{x.name}{x.ownership ? <span className="ml-2 text-xs text-muted-foreground">{x.ownership}%</span> : null}</span><span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">BVN {x.bvn}{x.verified ? <BadgeCheck className="h-4 w-4 text-cyan" /> : <XCircle className="h-4 w-4 text-destructive" />}</span></li>)}</ul>}
    {kind === "owner" && directors.length > 0 && <div className="rounded-xl border border-cobalt/40 bg-cobalt/10 p-3">
      <p className="text-xs font-bold">Owner is a director?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="Director" className="field h-10 flex-1" value={pick.bvn} onChange={(e) => setPick((s) => ({ ...s, bvn: e.target.value }))}><option value="">Choose director</option>{directors.map((d) => <option key={d.bvn} value={d.bvn}>{d.name}</option>)}</select>
        <input aria-label="Ownership percent" className="field h-10 w-28" inputMode="numeric" placeholder="% owned" value={pick.ownership} onChange={(e) => setPick((s) => ({ ...s, ownership: e.target.value.replace(/\D/g, "").slice(0, 3) }))} />
        <Button type="button" variant="crisp" disabled={busy} onClick={reuseDir}>Add</Button>
      </div>
    </div>}
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">First name<input className="field mt-1 w-full" required value={f.firstName} onChange={(e) => setF((s) => ({ ...s, firstName: e.target.value }))} /></label>
      <label className="text-sm font-semibold">Last name<input className="field mt-1 w-full" required value={f.lastName} onChange={(e) => setF((s) => ({ ...s, lastName: e.target.value }))} /></label>
      <label className="text-sm font-semibold">BVN<input className="field mt-1 w-full font-mono tracking-widest" inputMode="numeric" maxLength={11} required value={f.bvn} onChange={(e) => setF((s) => ({ ...s, bvn: e.target.value.replace(/\D/g, "") }))} /></label>
      {kind === "owner" && <label className="text-sm font-semibold">Ownership %<input className="field mt-1 w-full" inputMode="numeric" required value={f.ownership} onChange={(e) => setF((s) => ({ ...s, ownership: e.target.value.replace(/\D/g, "").slice(0, 3) }))} /></label>}
      <div className="sm:col-span-2"><Button variant="brand" type="submit" disabled={busy} className="shine bg-gradient-tri">{busy && <Loader2 className="animate-spin" />}{kind === "director" ? (people.length ? "Verify another director" : "Verify director") : "Verify owner"}</Button><span className="ml-3 text-[11px] text-muted-foreground">BVN is checked instantly and only the last 4 digits are kept.</span></div>
    </form>
    {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-cyan" : "text-destructive"}`}>{msg.text}</p>}
  </div>;
}

function OperationsPanel({ saved, onDone }: { saved: Detail; onDone: () => Promise<void> }) {
  const run = useServerFn(saveKybOperations);
  const s0 = (saved["socials"] as string[] | undefined) ?? [];
  const [f, setF] = useState({ street: String(saved["street"] ?? ""), city: String(saved["city"] ?? ""), state: String(saved["state"] ?? ""), website: String(saved["website"] ?? ""), social1: s0[0] ?? "", social2: s0[1] ?? "" });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const fix = (u: string) => (u && !/^https?:\/\//.test(u) ? `https://${u}` : u).trim();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setBusy(true);
    try { await run({ data: { street: f.street, city: f.city, state: f.state, website: fix(f.website), socials: [fix(f.social1), fix(f.social2)].filter(Boolean) } }); toast.success("Address and web presence saved"); await onDone(); }
    catch (err) { setMsg(errMsg(err).includes("url") || errMsg(err).includes("https") ? "Check your links, e.g. https://instagram.com/yourbusiness" : errMsg(err)); } finally { setBusy(false); }
  };
  const field = (k: keyof typeof f, label: string, ph = "", req = false) => <label className="text-sm font-semibold">{label}<input className="field mt-1 w-full" required={req} placeholder={ph} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} /></label>;
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
    <div className="sm:col-span-3">{field("street", "Business address", "12 Admiralty Way, Lekki Phase 1", true)}</div>
    {field("city", "City", "Lagos", true)}{field("state", "State", "Lagos", true)}<span />
    <div className="sm:col-span-3 flex items-center gap-2 pt-2 text-xs font-bold text-cyan"><Globe2 className="h-4 w-4" />Website or at least one social page</div>
    {field("website", "Website", "yourbusiness.com")}{field("social1", "Social page", "instagram.com/yourbusiness")}{field("social2", "Another social page", "x.com/yourbusiness")}
    <div className="sm:col-span-3"><Button variant="brand" type="submit" disabled={busy} className="shine bg-gradient-tri">{busy && <Loader2 className="animate-spin" />}Save and continue</Button>{msg && <span className="ml-3 text-sm font-semibold text-destructive">{msg}</span>}</div>
  </form>;
}

type Bank = { code: string; name: string; category: string };
function BankSearch({ banks, value, onChange }: { banks: Bank[]; value: Bank | null; onChange: (b: Bank) => void }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const box = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return t ? banks.filter((b) => b.name.toLowerCase().includes(t) || b.code.includes(t)) : banks; }, [banks, q]);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  return <div ref={box} className="relative">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="field flex h-11 w-full items-center justify-between text-left"><span className={value ? "font-semibold" : "text-muted-foreground"}>{value?.name ?? "Search and choose your bank"}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></button>
    {open && <div className="dropdown-panel absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-cyan/40 bg-popover shadow-cobalt">
      <div className="flex items-center gap-2 border-b border-border px-3"><Search className="h-4 w-4 text-cyan" /><input ref={input} aria-label="Search banks" className="h-11 w-full bg-transparent text-sm outline-none" placeholder={`Search ${banks.length} banks…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { e.preventDefault(); onChange(list[0]); setOpen(false); } if (e.key === "Escape") setOpen(false); }} /></div>
      <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
        {list.length === 0 && <li className="p-3 text-center text-xs text-muted-foreground">No bank matches "{q}"</li>}
        {list.map((b) => <li key={b.code + b.name} role="option" aria-selected={value?.code === b.code}><button type="button" onClick={() => { onChange(b); setOpen(false); setQ(""); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-cobalt/20 ${value?.code === b.code ? "bg-cobalt/25 text-cyan" : ""}`}><span>{b.name}</span><span className="text-[10px] text-muted-foreground">{b.category === "FINTECH_MFB" ? "Fintech/MFB" : b.category ? "Bank" : ""}</span></button></li>)}
      </ul>
    </div>}
  </div>;
}

function SettlementPanel({ saved, businessName, onDone }: { saved: Detail; businessName: string; onDone: () => Promise<void> }) {
  const listBanks = useServerFn(listSettlementBanks); const resolve = useServerFn(verifySettlementAccount);
  const [banks, setBanks] = useState<Bank[] | null>(null); const [bankErr, setBankErr] = useState("");
  const [bank, setBank] = useState<Bank | null>(null); const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<{ accountName: string; matches: boolean } | null>(null); const [err, setErr] = useState("");
  const fetchBanks = async () => { setBankErr(""); try { setBanks(await listBanks()); } catch (e) { setBankErr(errMsg(e)); } };
  useEffect(() => { void fetchBanks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setRes(null); setErr("");
    if (!bank || acct.length !== 10) return;
    let alive = true; setBusy(true);
    resolve({ data: { bankCode: bank.code, bankName: bank.name, accountNumber: acct } })
      .then(async (r) => { if (!alive) return; setRes(r); if (r.matches) { toast.success("Settlement account verified"); await onDone(); } })
      .catch((e) => alive && setErr(errMsg(e))).finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [bank, acct]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="space-y-4">
    {saved["accountNumber"] ? <p className="rounded-xl border border-cyan/40 bg-cyan/10 p-3 text-sm"><BadgeCheck className="mr-1 inline h-4 w-4 text-cyan" />{String(saved["accountName"])} · {String(saved["bankName"])} · {String(saved["accountNumber"])}<span className="block text-xs text-muted-foreground">Enter a different account below to replace it.</span></p> : null}
    <p className="text-xs text-muted-foreground">Payouts settle only into an account named <b className="text-foreground">{businessName}</b>.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="text-sm font-semibold">Bank<div className="mt-1">{banks ? <BankSearch banks={banks} value={bank} onChange={setBank} /> : bankErr ? <div className="field flex h-11 items-center justify-between text-xs text-destructive">{bankErr}<Button size="sm" variant="ghost" onClick={fetchBanks}>Retry</Button></div> : <div className="field flex h-11 items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading banks…</div>}</div></div>
      <label className="text-sm font-semibold">Account number<input className="field mt-1 h-11 w-full font-mono tracking-widest" inputMode="numeric" maxLength={10} placeholder="0123456789" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
    </div>
    {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Fetching account name…</p>}
    {res && (res.matches
      ? <p className="flex items-center gap-2 rounded-xl border border-cyan/50 bg-cyan/10 p-3 text-sm font-bold text-cyan"><BadgeCheck className="h-5 w-5" />{res.accountName} — matches your business</p>
      : <p className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm font-semibold text-destructive"><XCircle className="mr-1 inline h-4 w-4" />This account is in the name of <b>{res.accountName}</b>, not <b>{businessName}</b>. Use a corporate account in your registered business name.</p>)}
    {err && <p className="text-sm font-semibold text-destructive">{err}</p>}
  </div>;
}

function TwoFactorPanel({ verified, onDone }: { verified: boolean; onDone: () => Promise<void> }) {
  const confirm = useServerFn(confirmTwoFactor);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  if (verified) return <p className="flex items-center gap-2 text-sm font-bold text-cyan"><ShieldCheck className="h-5 w-5" />Your authenticator app is connected. Sign-ins and payouts are protected.</p>;
  const start = async () => {
    setBusy(true); setMsg("");
    try {
      const old = await supabase.auth.mfa.listFactors();
      for (const f of old.data?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const r = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Slikpay ${Date.now()}` });
      if (r.error) throw r.error;
      setEnroll({ id: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret });
    } catch (e) { setMsg(errMsg(e).toLowerCase().includes("mfa") ? "Authenticator sign-in isn't switched on for the account service yet." : errMsg(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!enroll || code.length !== 6) return;
    setBusy(true); setMsg("");
    try {
      const r = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
      if (r.error) throw new Error("That code didn't work. Enter the current 6-digit code from your app.");
      await confirm(); toast.success("Two-factor authentication connected"); await onDone();
    } catch (e) { setMsg(errMsg(e)); setCode(""); } finally { setBusy(false); }
  };
  if (!enroll) return <div className="space-y-3"><p className="text-sm text-muted-foreground">Install Google Authenticator (or any authenticator app), then connect it to your Slikpay account.</p><Button variant="brand" className="shine bg-gradient-tri" disabled={busy} onClick={start}>{busy && <Loader2 className="animate-spin" />}<Lock />Set up authenticator</Button>{msg && <p className="text-sm font-semibold text-destructive">{msg}</p>}</div>;
  return <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
    <div className="rounded-2xl bg-foreground p-3"><img src={enroll.qr} alt="Scan with your authenticator app" className="h-44 w-44" /></div>
    <div className="space-y-3">
      <p className="text-sm font-bold">1. Scan the code with Google Authenticator</p>
      <p className="text-xs text-muted-foreground">Can't scan? Enter this key: <code className="break-all font-mono text-cyan">{enroll.secret}</code></p>
      <p className="text-sm font-bold">2. Enter the 6-digit code it shows</p>
      <div className="otp-panel inline-block rounded-2xl p-3"><InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify}><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="otp-slot" />)}</InputOTPGroup></InputOTP></div>
      <div><Button variant="brand" disabled={busy || code.length !== 6} onClick={verify}>{busy && <Loader2 className="animate-spin" />}Confirm</Button></div>
      {msg && <p className="text-sm font-semibold text-destructive">{msg}</p>}
    </div>
  </div>;
}

function GoLiveButton({ ready, onLive }: { ready: boolean; onLive: (r: Awaited<ReturnType<typeof completeGoLive>>) => void }) {
  const run = useServerFn(completeGoLive); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { onLive(await run()); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  return <div className={`rounded-2xl border p-5 ${ready ? "border-cyan/60 bg-gradient-to-r from-cobalt/30 to-magenta/20" : "border-border bg-card/60"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-black">{ready ? "You're ready to go live" : "Complete every step to go live"}</p><p className="text-xs text-muted-foreground">We'll approve your business and issue your live account number in {ready ? "your business name" : "your verified business name"} immediately.</p></div>
      <Button variant="brand" disabled={!ready || busy} onClick={go} className="shine h-12 bg-gradient-tri px-6">{busy && <Loader2 className="animate-spin" />}Go live now</Button>
    </div>
  </div>;
}

function LiveSuccess({ result }: { result: Awaited<ReturnType<typeof completeGoLive>> }) {
  return <div className="relative overflow-hidden rounded-3xl border border-cyan/50 bg-gradient-to-br from-cobalt/40 via-card to-magenta/25 p-8 text-center">
    <PartyPopper className="mx-auto h-12 w-12 text-magenta" />
    <h1 className="mt-3 text-3xl font-black">You're live!</h1>
    <p className="mt-2 text-sm text-muted-foreground">Your business is verified and can now receive real payments.</p>
    {result.accountNumber
      ? <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-background/50 p-5"><p className="text-[11px] uppercase tracking-widest text-muted-foreground">Your business account number</p><p className="mt-1 font-mono text-3xl font-black tracking-widest text-cyan">{result.accountNumber}</p><p className="mt-1 text-sm font-bold">{result.accountName}</p></div>
      : <p className="mx-auto mt-6 max-w-md rounded-xl border border-magenta/50 bg-magenta/10 p-3 text-sm">Your account number couldn't be issued just yet ({result.issueError}). Use “Issue my account number” on your dashboard to try again.</p>}
    <Button variant="brand" className="mt-6" onClick={() => window.location.assign("/dashboard?module=overview")}>Go to dashboard</Button>
  </div>;
}

function BusinessProfile({ p, detail }: { p: Profile; detail: (k: string) => Detail }) {
  const ops = detail("operations"); const acct = detail("settlement_account");
  const people = (k: string) => (detail(k).people ?? []).filter((x) => x.verified);
  const rows: [string, string][] = [
    ["Registered name", p.business.name], ["Registration number", p.business.rcNumber || "—"], ["Country", p.business.country], ["Email", p.email],
    ["Directors", people("director_bvn").map((x) => x.name).join(", ") || "—"],
    ["Beneficial owners", people("beneficial_owners").map((x) => `${x.name}${x.ownership ? ` (${x.ownership}%)` : ""}`).join(", ") || "—"],
    ["Address", [ops["street"], ops["city"], ops["state"]].filter(Boolean).join(", ") || "—"],
    ["Web presence", [ops["website"], ...(((ops["socials"] as string[]) ?? []))].filter(Boolean).join(" · ") || "—"],
    ["Settlement account", acct["accountNumber"] ? `${String(acct["accountName"])} · ${String(acct["bankName"])} · ${String(acct["accountNumber"])}` : "—"],
    ["Business account number", p.liveAccount ?? "Not issued yet"], ["Two-factor", "Authenticator app connected"],
  ];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-cyan/40 bg-gradient-to-br from-cobalt/30 via-card to-magenta/20 p-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/20 text-cyan"><Building2 className="h-7 w-7" /></span>
      <div className="flex-1"><p className="text-[11px] font-bold uppercase tracking-widest text-cyan">KYB</p><h1 className="text-2xl font-black">{p.business.name}</h1></div>
      <span className="flex items-center gap-2 rounded-full border border-cyan/60 bg-cyan/15 px-4 py-2 text-sm font-bold text-cyan"><BadgeCheck className="h-4 w-4" />Verified business · Live</span>
    </header>
    <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-card/70 p-4"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-sm font-bold">{v}</dd></div>)}</dl>
  </div>;
}
