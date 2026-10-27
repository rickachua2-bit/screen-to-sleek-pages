import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AtSign, Bitcoin, Briefcase, Building, Building2, Camera, Check, ChevronDown, Cloud, Copy, Cross, Cpu, Dumbbell, Eye, EyeOff, Factory, Film, Fingerprint, Fuel, Gamepad2, GraduationCap, Hammer, HeartHandshake, Info, Landmark, Laptop, Loader2, Lock, Mail, Megaphone, Package, Pickaxe, Plane, Scale, Scissors, Search, ShieldCheck, Ship, ShoppingCart, Smartphone, Stethoscope, Store, Sun, Tractor, Truck, User as UserIcon, Users, UtensilsCrossed, Wallet, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, NG_BANKS, type Role, type User } from "@/lib/api";
import { isEmail, isPin, passwordStrength } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export type Pending = { token: string; user: User; role: Role };
type Mode = "in" | "up";

/* ---------- shared bits ---------- */

function ErrorPill({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return <p role="alert" className="mt-1.5 inline-block rounded-full border border-destructive/30 bg-destructive/10 px-3 py-0.5 text-xs font-bold text-destructive">{msg}</p>;
}

function Field({ label, id, icon: Icon, error, shake, hint, children }: { label: string; id: string; icon?: LucideIcon; error?: string | undefined; shake?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className={shake && error ? "animate-shake" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-foreground">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        {children}
      </div>
      {hint && !error && <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>}
      <ErrorPill msg={error} />
    </div>
  );
}

const inputCls = (icon = true) => `field h-12 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-cobalt/10 ${icon ? "pl-10" : ""}`;

/* ---------- styled dropdown (custom listbox) ---------- */

type Opt = { value: string; label: string; flag?: string; hint?: string; group?: string };

function SelectMenu({ id, value, options, onChange, placeholder, searchable = false }: {
  id: string;
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const optsRef = useRef(options); optsRef.current = options;
  const valRef = useRef(value); valRef.current = value;
  const picked = options.find((o) => o.value === value);
  const term = q.trim().toLowerCase();
  const shown = term ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(term)) : options;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(Math.max(0, optsRef.current.findIndex((o) => o.value === valRef.current)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, q]);

  // open upward when the list would run past the bottom of the window
  useEffect(() => {
    if (!open || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom);
  }, [open]);

  const pick = (o: Opt | undefined) => { if (!o) return; onChange(o.value); setOpen(false); };

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); } return; }
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={wrap} className="relative" onKeyDown={onKey}>
      <button id={id} type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={`${id}-list`}
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls(false)} flex items-center justify-between gap-2 rounded-xl px-3.5 text-left transition-all duration-200 ${open ? "border-cobalt ring-4 ring-cobalt/10" : "hover:border-cyan"}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          {picked?.flag && <span className="text-lg leading-none">{picked.flag}</span>}
          <span className={`truncate ${picked ? "text-foreground" : "text-muted-foreground"}`}>{picked?.label ?? placeholder ?? "Select…"}</span>
          {picked?.hint && <span className="shrink-0 font-mono text-xs font-bold text-cobalt">{picked.hint}</span>}
        </span>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${open ? "rotate-180 border-cobalt bg-cobalt/15 text-cobalt" : "border-border text-muted-foreground"}`}>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>

      {open && (
        <div className={`animate-in fade-in-0 zoom-in-95 absolute left-0 right-0 z-40 origin-top ${up ? "bottom-[calc(100%+6px)] slide-in-from-bottom-1" : "top-[calc(100%+6px)] slide-in-from-top-1"}`}>
          <div className="panel dropdown-list max-h-64 overflow-auto p-1.5 backdrop-blur-xl shadow-[0_28px_70px_-24px_color-mix(in_oklab,var(--cobalt)_60%,transparent)]">
            {searchable && (
              <div className="sticky top-0 z-10 -mx-1.5 -mt-1.5 mb-1.5 bg-card/95 px-1.5 pb-1.5 pt-0.5 backdrop-blur-xl">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Search…" aria-label="Search options"
                    className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cobalt" />
                </div>
              </div>
            )}
            <div ref={list} id={`${id}-list`} role="listbox" className="space-y-0.5">
              {shown.length === 0 && <p className="px-3 py-6 text-center text-xs font-bold text-muted-foreground">No match for "{q}"</p>}
              {shown.map((o, i) => {
                const isSel = o.value === value;
                const isActive = i === active;
                const showGroup = o.group && (i === 0 || shown[i - 1]?.group !== o.group);
                return (
                  <div key={o.value}>
                    {showGroup && <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt">{o.group}</p>}
                    <button type="button" role="option" aria-selected={isSel} tabIndex={-1} data-active={isActive}
                      onClick={() => pick(o)} onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${isSel ? "bg-cobalt/12 text-foreground ring-1 ring-cobalt/40" : "text-body hover:bg-cobalt/10 hover:text-foreground"}`}>
                      {o.flag && <span className="text-lg leading-none">{o.flag}</span>}
                      <span className="flex-1 truncate">{o.label}</span>
                      {o.hint && <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">{o.hint}</span>}
                      {isSel ? <Check className="h-4 w-4 shrink-0 text-magenta" strokeWidth={3} /> : <span className={`h-4 w-4 shrink-0 rounded-full border ${isActive ? "border-cobalt" : "border-transparent"}`} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} className={`${inputCls()} pr-11`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "At least 8 characters"} />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </>
  );
}

const STRENGTH_CLS = { Weak: "bg-destructive", Medium: "bg-magenta", Strong: "bg-success" } as const;

function StrengthMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const { label, score } = passwordStrength(pw);
  const checks = [
    { ok: pw.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(pw), label: "uppercase letter" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "special symbol" },
  ];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < (label === "Strong" ? 3 : label === "Medium" ? 2 : score > 0 ? 1 : 0) ? STRENGTH_CLS[label] : "bg-muted"}`} />)}
        </div>
        <span className="text-xs font-bold text-body">{label}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map((c) => (
          <span key={c.label} className={`flex items-center gap-1 text-[11px] font-bold ${c.ok ? "text-success" : "text-muted-foreground"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.ok ? "bg-success" : "bg-muted-foreground/40"}`} /> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepBar({ n, labels }: { n: number; labels: string[] }) {
  return (
    <div className="mb-5" aria-label={`Step ${n} of ${labels.length}`}>
      <div className="flex items-center gap-1.5">
        {labels.map((l, i) => (
          <div key={l} className="flex flex-1 items-center gap-1.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-all ${i + 1 < n ? "bg-success text-primary-foreground" : i + 1 === n ? "bg-gradient-brand text-primary-foreground shadow-cobalt" : "bg-muted text-muted-foreground"}`}>
              {i + 1 < n ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden text-[10px] font-bold uppercase tracking-wide sm:block ${i + 1 === n ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && <span className={`h-px flex-1 ${i + 1 < n ? "bg-success" : "bg-border"}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PinBoxes({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <InputOTP maxLength={4} value={value} onChange={onChange} autoFocus={autoFocus}>
      <InputOTPGroup className="gap-2">
        {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-xl border-2 border-l-2 text-xl font-black first:rounded-xl last:rounded-xl" />)}
      </InputOTPGroup>
    </InputOTP>
  );
}

function SecurityPill() {
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-3 py-1.5 text-center text-[11px] font-bold text-success">
      <Lock className="h-3 w-3" /> Protected by Bank-Grade 256-bit AES encryption &amp; 2FA
    </p>
  );
}

/* ---------- account type tabs ---------- */

function AccountTabs({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const tabs = [
    { v: "merchant" as const, icon: Building2, label: "Business / Merchant", desc: "SoftPOS, Dedicated NUBANs, Bulk Payroll & Developer APIs" },
    { v: "personal" as const, icon: UserIcon, label: "Personal User", desc: "Free P2P, Virtual Cards, Bills & @SlikTag transfers" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Account type">
        {tabs.map(({ v, icon: Icon, label }) => (
          <button key={v} type="button" role="tab" aria-selected={role === v} onClick={() => onChange(v)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all ${role === v ? "bg-gradient-brand text-primary-foreground shadow-cobalt" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{v === "merchant" ? "Business" : "Personal"}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-2 text-xs font-semibold text-body">
        {tabs.find((t) => t.v === role)!.desc}
      </p>
    </div>
  );
}

/* ---------- sign in ---------- */

function SignIn({ role, onDone }: { role: Role; onDone: (p: Pending, remember: boolean) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(45);
  const [forgot, setForgot] = useState(false);
  const isBiz = role === "merchant";

  useEffect(() => {
    if (step !== 2 || timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, timer]);

  const fail = (e: Record<string, string | undefined>) => { setErr(e); setShake((s) => s + 1); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const idOk = isBiz ? id.trim().length >= 3 : id.trim().length >= 3;
    const secretOk = pinMode ? isPin(pin) : pw.length >= 8;
    const next = {
      id: idOk ? undefined : isBiz ? "Enter your work email or Merchant ID" : "Enter your phone number or @SlikTag",
      pw: secretOk ? undefined : pinMode ? "PIN must be exactly 4 digits" : "Password must be at least 8 characters",
    };
    if (next.id || next.pw) return fail(next);
    setErr({});
    setBusy(true);
    try {
      const email = isEmail(id) ? id : `${id.replace(/^@/, "").toLowerCase().replace(/\s+/g, ".")}@slikpay.online`;
      const r = await api.login(email, pinMode ? pin : pw, role);
      setPending(r);
      setStep(2);
      setTimer(45);
    } catch {
      fail({ pw: "We couldn't sign you in. Check your details." });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    const r = await api.verify2fa(otp);
    setBusy(false);
    if (r.success && pending) onDone(pending, remember);
    else fail({ otp: "Invalid code. Enter the 6 digits sent to you." });
  }

  if (forgot) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
        <h2 className="text-xl font-black text-foreground">Reset your password</h2>
        <p className="text-sm font-medium text-body">We'll email you a secure link to set a new password.</p>
        <Field label="Email address" id="reset" icon={Mail} error={err["email"]} shake={!!shake}>
          <input id="reset" type="email" className={inputCls()} value={id} onChange={(e) => setId(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Button variant="brand" className="h-12 w-full" onClick={async () => {
          if (!isEmail(id)) return fail({ email: "Enter a valid email address" });
          await api.forgotPassword(id);
          toast.success("Reset link sent if the account exists");
          setForgot(false);
        }}>Send reset link →</Button>
        <button onClick={() => setForgot(false)} className="w-full text-sm font-bold text-cobalt hover:underline">← Back to sign in</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4">
        <StepBar n={2} labels={["Details", "2FA"]} />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt"><ShieldCheck className="h-6 w-6" /></span>
        <h2 className="mt-4 text-xl font-black text-foreground">Two-Factor Security Verification</h2>
        <p className="mt-1 text-sm font-medium text-body">Enter the 6-digit verification code sent to your registered email or authenticator app.</p>
        <div className={`mt-6 flex justify-center ${err["otp"] ? "animate-shake" : ""}`}>
          <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-xl border-2 border-l-2 text-xl font-black first:rounded-xl last:rounded-xl" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="text-center"><ErrorPill msg={err["otp"]} /></div>
        <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
          {timer > 0 ? <>Resend code in {timer}s</> : <button className="font-bold text-cobalt hover:underline" onClick={() => { setTimer(45); toast.success("A new code is on its way"); }}>Resend code</button>}
        </p>
        <Button variant="brand" className="shine mt-5 h-12 w-full bg-gradient-tri text-base" disabled={otp.length !== 6 || busy} onClick={verify}>
          {busy && <Loader2 className="animate-spin" />} Verify &amp; Launch Console →
        </Button>
        <button onClick={() => { setStep(1); setOtp(""); }} className="mt-3 w-full text-sm font-bold text-body hover:text-foreground">← Use a different account</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="animate-in fade-in space-y-4" key={shake}>
      <div>
        <h2 className="text-xl font-black text-foreground">Welcome Back</h2>
        <p className="text-sm font-medium text-body">Sign in to your Slikpay {isBiz ? "Business Console" : "Personal Wallet"}.</p>
      </div>
      <Field label={isBiz ? "Work Email or Merchant ID" : "Phone Number or @SlikTag"} id="login-id" icon={isBiz ? Mail : AtSign} error={err["id"]} shake>
        {isBiz ? (
          <input id="login-id" autoComplete="username" className={inputCls()} value={id} onChange={(e) => setId(e.target.value)} placeholder="director@company.com" />
        ) : (
          <div className="flex gap-2">
            <span className="flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-cobalt/40 bg-cobalt/10 px-3 text-sm font-black text-foreground"><span className="text-lg leading-none">🇳🇬</span><span className="font-mono">+234</span></span>
            <input id="login-id" autoComplete="username" className={`${inputCls(false)} flex-1`} value={id} onChange={(e) => setId(e.target.value)} placeholder="0803 000 0000 or @babatunde" />
          </div>
        )}
      </Field>
      {!isBiz && (
        <div className="flex justify-end">
          <button type="button" onClick={() => { setPinMode(!pinMode); setErr({}); }} className="text-xs font-bold text-cobalt hover:underline">
            {pinMode ? "Use password instead" : "Use 4-digit Security PIN instead"}
          </button>
        </div>
      )}
      {pinMode && !isBiz ? (
        <Field label="4-Digit Security PIN" id="login-pin" error={err["pw"]} shake>
          <div className="flex justify-center pt-1"><PinBoxes value={pin} onChange={setPin} autoFocus /></div>
        </Field>
      ) : (
        <Field label="Password" id="password" icon={Lock} error={err["pw"]} shake>
          <PasswordInput id="password" value={pw} onChange={setPw} autoComplete="current-password" placeholder="Your password" />
        </Field>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 font-semibold text-body">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-cobalt" /> Remember this device for 30 days
        </label>
        <button type="button" onClick={() => setForgot(true)} className="font-bold text-cobalt hover:underline">Forgot password?</button>
      </div>
      <Button variant="brand" type="submit" disabled={busy} className="shine h-12 w-full bg-gradient-tri text-base">
        {busy && <Loader2 className="animate-spin" />} Sign In to {isBiz ? "Business Console" : "Personal Account"} →
      </Button>
      {!isBiz && (
        <button type="button" onClick={() => toast.info("Biometric sign-in is coming soon")} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-sm font-bold text-foreground transition-colors hover:border-cobalt">
          <Fingerprint className="h-4 w-4 text-magenta" /> Or sign in with Face ID / Fingerprint
        </button>
      )}
      <SecurityPill />
    </form>
  );
}

/* ---------- business sign-up ---------- */

const COMPANY_TYPES = ["Private Limited Company (LTD / RC)", "Business Name (BN)", "Incorporated Trustee (IT / NGO)"];
const COUNTRIES = [

  { code: "NG", flag: "🇳🇬", name: "Nigeria", dial: "+234", group: "West Africa" },
  { code: "GH", flag: "🇬🇭", name: "Ghana", dial: "+233", group: "West Africa" },
  { code: "KE", flag: "🇰🇪", name: "Kenya", dial: "+254", group: "East & Southern Africa" },
  { code: "RW", flag: "🇷🇼", name: "Rwanda", dial: "+250", group: "East & Southern Africa" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa", dial: "+27", group: "East & Southern Africa" },
  { code: "EG", flag: "🇪🇬", name: "Egypt", dial: "+20", group: "East & Southern Africa" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", dial: "+44", group: "Global" },
  { code: "EU", flag: "🇪🇺", name: "Eurozone", dial: "+33", group: "Global" },
  { code: "US", flag: "🇺🇸", name: "United States", dial: "+1", group: "Global" },
];

const COUNTRY_OPTS: Opt[] = COUNTRIES.map((c) => ({ value: c.code, label: c.name, flag: c.flag, hint: c.dial, group: c.group }));
const COMPANY_OPTS: Opt[] = COMPANY_TYPES.map((c) => ({ value: c, label: c }));
const BANK_OPTS: Opt[] = NG_BANKS.map((b) => ({ value: b.name, label: b.name, hint: b.code }));

function CountrySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return <SelectMenu id={id} value={value} options={COUNTRY_OPTS} onChange={onChange} searchable placeholder="Select your country" />;
}

const dialOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
/* ---------- business category picker ---------- */

type Cat = { value: string; label: string; icon: LucideIcon };

const CATEGORY_GROUPS: { group: string; items: Cat[] }[] = [
  { group: "Trade & Commerce", items: [
    { value: "eCommerce", label: "eCommerce", icon: ShoppingCart },
    { value: "Retail & Wholesale", label: "Retail & Wholesale", icon: Store },
    { value: "Import & Export", label: "Import & Export", icon: Ship },
    { value: "FMCG Distribution", label: "FMCG Distribution", icon: Package },
    { value: "Social Commerce & Resellers", label: "Social Commerce & Resellers", icon: Users },
  ] },
  { group: "Money & Technology", items: [
    { value: "FinTech & Payments", label: "FinTech & Payments", icon: Bitcoin },
    { value: "Banking & Lending", label: "Banking & Lending", icon: Landmark },
    { value: "Insurance", label: "Insurance", icon: HeartHandshake },
    { value: "Crypto & Digital Assets", label: "Crypto & Digital Assets", icon: Wallet },
    { value: "SaaS & Software", label: "SaaS & Software", icon: Laptop },
    { value: "Cloud, Data & AI", label: "Cloud, Data & AI", icon: Cpu },
    { value: "Telecoms & Connectivity", label: "Telecoms & Connectivity", icon: Cloud },
  ] },
  { group: "Professional Services", items: [
    { value: "Consulting & Advisory", label: "Consulting & Advisory", icon: Briefcase },
    { value: "Legal & Compliance", label: "Legal & Compliance", icon: Scale },
    { value: "Marketing & Creative Agency", label: "Marketing & Creative", icon: Megaphone },
    { value: "Recruiting & Staffing", label: "Recruiting & Staffing", icon: Users },
    { value: "Real Estate & Property", label: "Real Estate & Property", icon: Building },
  ] },
  { group: "Logistics & Energy", items: [
    { value: "Logistics & Freight", label: "Logistics & Freight", icon: Truck },
    { value: "Aviation & Travel", label: "Aviation & Travel", icon: Plane },
    { value: "Marine & Shipping", label: "Marine & Shipping", icon: Ship },
    { value: "Oil, Gas & Energy", label: "Oil, Gas & Energy", icon: Fuel },
    { value: "Renewable Energy", label: "Renewable Energy", icon: Sun },
  ] },
  { group: "Health, Learning & Life", items: [
    { value: "Healthcare & Clinics", label: "Healthcare & Clinics", icon: Stethoscope },
    { value: "Education & Training", label: "Education & Training", icon: GraduationCap },
    { value: "Food, Restaurants & Catering", label: "Food & Restaurants", icon: UtensilsCrossed },
    { value: "Fashion & Beauty", label: "Fashion & Beauty", icon: Scissors },
    { value: "Fitness & Wellness", label: "Fitness & Wellness", icon: Dumbbell },
    { value: "Media & Entertainment", label: "Media & Entertainment", icon: Film },
    { value: "Gaming & Esports", label: "Gaming & Esports", icon: Gamepad2 },
    { value: "Photography & Studios", label: "Photography & Studios", icon: Camera },
  ] },
  { group: "Industry & Primary", items: [
    { value: "Agriculture & Agribusiness", label: "Agriculture & Agribusiness", icon: Tractor },
    { value: "Manufacturing & Production", label: "Manufacturing & Production", icon: Factory },
    { value: "Mining & Extraction", label: "Mining & Extraction", icon: Pickaxe },
    { value: "Construction & Infrastructure", label: "Construction & Infra", icon: Hammer },
  ] },
  { group: "Non-Profit & Public", items: [
    { value: "Non-Profit / NGO", label: "Non-Profit / NGO", icon: HeartHandshake },
    { value: "Cooperative & Thrift", label: "Cooperative & Thrift", icon: Users },
    { value: "Government & Public Sector", label: "Government & Public", icon: Landmark },
    { value: "Faith-Based Organisation", label: "Faith-Based Org", icon: Cross },
  ] },
];

const ALL_CATS = CATEGORY_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

// extra words people type when looking for a category
const CAT_KEYWORDS: Record<string, string> = {
  "eCommerce": "online store shop marketplace web",
  "Retail & Wholesale": "shop supermarket wholesale trade vendor",
  "Import & Export": "trade customs cross-border foreign",
  "FMCG Distribution": "fast moving consumer goods supply distributor",
  "Social Commerce & Resellers": "instagram whatsapp vendor reseller agent",
  "FinTech & Payments": "fintech payment collection billing",
  "Banking & Lending": "bank microfinance loan credit",
  "Insurance": "underwriting cover assurance",
  "Crypto & Digital Assets": "crypto blockchain wallet tokens web3",
  "SaaS & Software": "software app startup developer tech",
  "Cloud, Data & AI": "cloud data ai machine learning hosting",
  "Telecoms & Connectivity": "telecom network sim internet mtn",
  "Consulting & Advisory": "consultancy advisory services",
  "Legal & Compliance": "law lawyers compliance regulatory",
  "Marketing & Creative Agency": "marketing ads brand creative agency",
  "Recruiting & Staffing": "hr hiring staffing recruitment",
  "Real Estate & Property": "property land rent housing estate",
  "Logistics & Freight": "logistics delivery haulage courier transport",
  "Aviation & Travel": "airline travel flights tourism hospitality",
  "Marine & Shipping": "shipping port vessel marine",
  "Oil, Gas & Energy": "oil gas petroleum downstream energy",
  "Renewable Energy": "solar power clean energy inverter",
  "Healthcare & Clinics": "health hospital clinic pharma medical",
  "Education & Training": "school training learning students edtech",
  "Food, Restaurants & Catering": "food restaurant catering kitchen",
  "Fashion & Beauty": "fashion clothing beauty salon apparel",
  "Fitness & Wellness": "gym fitness wellness sports",
  "Media & Entertainment": "media music film entertainment content creator",
  "Gaming & Esports": "gaming esports games betting",
  "Photography & Studios": "photo studio videography events",
  "Agriculture & Agribusiness": "agro farming crops livestock agribusiness",
  "Manufacturing & Production": "factory manufacturing production industrial",
  "Mining & Extraction": "mining solid minerals extraction",
  "Construction & Infrastructure": "construction building infrastructure engineering",
  "Non-Profit / NGO": "ngo charity foundation non profit",
  "Cooperative & Thrift": "cooperative thrift microfinance union",
  "Government & Public Sector": "government public agency parastatal",
  "Faith-Based Organisation": "church mosque faith religious",
};


function CategoryPicker({ value, onChange, error, shake }: { value: string; onChange: (v: string) => void; error?: string | undefined; shake?: boolean }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const groups = CATEGORY_GROUPS
    .map((g) => ({ ...g, items: term ? g.items.filter((i) => `${i.label} ${g.group} ${CAT_KEYWORDS[i.value] ?? ""}`.toLowerCase().includes(term)) : g.items }))
    .filter((g) => g.items.length > 0);
  const picked = ALL_CATS.find((c) => c.value === value);

  return (
    <div className={shake && error ? "animate-shake" : undefined}>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <label htmlFor="b-cat-search" className="text-sm font-bold text-foreground">Business Category</label>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt">{ALL_CATS.length} categories</span>
      </div>
      <div className="rounded-2xl border-2 border-border bg-card/60 p-2 transition-colors focus-within:border-cobalt">
        <div className="relative px-0.5 pb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input id="b-cat-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories — e.g. agro, logistics, fintech" aria-label="Search business categories"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cobalt" />
        </div>
        <div className="dropdown-list max-h-52 space-y-3 overflow-auto px-0.5 pb-1">
          {groups.length === 0 && <p className="px-2 py-5 text-center text-xs font-bold text-muted-foreground">No category matches "{q}"</p>}
          {groups.map((g) => (
            <div key={g.group}>
              <p className="mb-1.5 px-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt">{g.group}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {g.items.map((c) => {
                  const sel = c.value === value;
                  const Icon = c.icon;
                  return (
                    <button key={c.value} type="button" onClick={() => onChange(c.value)} aria-pressed={sel}
                      className={`flex items-center gap-1.5 rounded-xl border px-2 py-2 text-left text-[11px] font-bold leading-tight transition-all duration-200 ${sel ? "border-transparent bg-gradient-brand text-primary-foreground shadow-cobalt" : "border-border text-body hover:-translate-y-0.5 hover:border-cyan hover:text-foreground"}`}>
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${sel ? "text-primary-foreground" : "text-magenta"}`} />
                      <span className="line-clamp-2">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {picked ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-success"><Check className="h-3.5 w-3.5" strokeWidth={3} /> {picked.label} selected</p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Pick the category that best describes what your business sells or does.</p>
      )}
      <ErrorPill msg={error} />
    </div>
  );
}

const VOLUMES = ["₦1M - ₦10M", "₦10M - ₦50M", "₦50M+"];


function BusinessSignUp({ onDone, onBack }: { onDone: (p: Pending, remember: boolean) => void; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ country: "NG", director: "", email: "", phone: "", pw: "", cac: "", companyType: COMPANY_TYPES[0]!, industry: "", bank: "", nuban: "" });
  const [volume, setVolume] = useState(VOLUMES[0]!);
  const [cacVerified, setCacVerified] = useState(false);
  const [cacBusy, setCacBusy] = useState(false);
  const [resolved, setResolved] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const fail = (e: Record<string, string | undefined>) => { setErr(e); setShake((s) => s + 1); };

  function next1(e: React.FormEvent) {
    e.preventDefault();
    const er = {
      director: f.director.trim().length >= 2 ? undefined : "Enter the director / owner's full name",
      email: isEmail(f.email) ? undefined : "Enter a valid work email",
      phone: f.phone.replace(/\D/g, "").length >= 10 ? undefined : "Enter a valid phone number",
      pw: f.pw.length >= 8 ? undefined : "Password must be at least 8 characters",
    };
    if (Object.values(er).some(Boolean)) return fail(er);
    setErr({});
    setStep(2);
  }

  function verifyCac() {
    if (f.cac.trim().length < 4) return fail({ cac: "Enter your CAC registration number" });
    setErr({});
    setCacBusy(true);
    setTimeout(() => { setCacBusy(false); setCacVerified(true); }, 900);
  }

  function next2(e: React.FormEvent) {
    e.preventDefault();
    if (!cacVerified) return fail({ cac: "Verify your CAC number to continue" });
    if (!f.industry) return fail({ industry: "Select your business category" });

    setErr({});
    setStep(3);
  }

  useEffect(() => {
    const digits = f.nuban.replace(/\D/g, "");
    if (digits.length === 10) {
      const t = setTimeout(() => setResolved("ACME LOGISTICS LTD"), 600);
      return () => clearTimeout(t);
    }
    setResolved("");
    return undefined;
  }, [f.nuban]);

  async function launch(e: React.FormEvent) {
    e.preventDefault();
    const er = {
      bank: f.bank ? undefined : "Choose your settlement bank",
      nuban: f.nuban.replace(/\D/g, "").length === 10 ? undefined : "Enter the 10-digit NUBAN",
      pin: isPin(pin) ? undefined : "PIN must be exactly 4 digits",
      pin2: pin === pin2 && isPin(pin2) ? undefined : "PINs don't match",
      terms: terms ? undefined : "Please accept the agreements to launch",
    };
    if (Object.values(er).some(Boolean)) return fail(er);
    setErr({});
    setBusy(true);
    const r = await api.register({ name: f.director, email: f.email, phone: f.phone, password: f.pw, accountType: "BUSINESS", category: f.industry });
    setBusy(false);
    onDone(r, true);
  }

  if (step === 1) {
    return (
      <form onSubmit={next1} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4" key={`b1-${shake}`}>
        <StepBar n={1} labels={["Account Details", "CAC Verification", "Settlement & PIN"]} />
        <h2 className="text-xl font-black text-foreground">Account Details</h2>
        <p className="-mt-2 text-sm font-medium text-body">Director / Administrator information.</p>
        <Field label="Country of Incorporation" id="b-country">
          <CountrySelect id="b-country" value={f.country} onChange={(v) => setF((p) => ({ ...p, country: v }))} />
        </Field>
        <Field label="Full Name of Director / Owner" id="b-director" icon={UserIcon} error={err["director"]} shake>
          <input id="b-director" className={inputCls()} value={f.director} onChange={set("director")} placeholder="e.g. Babatunde Adeleke" />
        </Field>
        <Field label="Official Work Email" id="b-email" icon={Mail} error={err["email"]} shake>
          <input id="b-email" type="email" autoComplete="email" className={inputCls()} value={f.email} onChange={set("email")} placeholder="director@acme.ng" />
        </Field>
        <Field label="Phone Number" id="b-phone" icon={Smartphone} error={err["phone"]} shake>
          <div className="flex gap-2">
            <span className="flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-cobalt/40 bg-cobalt/10 px-3 text-sm font-black text-foreground"><span className="text-lg leading-none">{dialOf(f.country).flag}</span><span className="font-mono">{dialOf(f.country).dial}</span></span>
            <input id="b-phone" type="tel" className={`${inputCls(false)} flex-1`} value={f.phone} onChange={set("phone")} placeholder="803 000 0000" />
          </div>
        </Field>
        <Field label="Create Password" id="b-pw" icon={Lock} error={err["pw"]} shake>
          <PasswordInput id="b-pw" value={f.pw} onChange={(v) => setF((p) => ({ ...p, pw: v }))} autoComplete="new-password" />
        </Field>
        <StrengthMeter pw={f.pw} />
        <Button variant="brand" type="submit" className="shine h-12 w-full bg-gradient-tri text-base">Continue to Business Verification →</Button>
        <button type="button" onClick={onBack} className="w-full text-sm font-bold text-body hover:text-foreground">← Change account type</button>
      </form>
    );
  }

  if (step === 2) {
    return (
      <form onSubmit={next2} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4" key={`b2-${shake}`}>
        <StepBar n={2} labels={["Account Details", "CAC Verification", "Settlement & PIN"]} />
        <h2 className="text-xl font-black text-foreground">Business &amp; CAC Regulatory Lookup</h2>
        <Field label="Company Type" id="b-ctype">
          <SelectMenu id="b-ctype" value={f.companyType} options={COMPANY_OPTS} onChange={(v) => setF((p) => ({ ...p, companyType: v }))} placeholder="Select company type" />
        </Field>
        <Field label="CAC Registration Number" id="b-cac" icon={Landmark} error={err["cac"]} shake>
          <input id="b-cac" className={`${inputCls()} pr-28`} value={f.cac} onChange={(e) => { setF((p) => ({ ...p, cac: e.target.value })); setCacVerified(false); }} placeholder="e.g. RC 1892341" />
          <button type="button" onClick={verifyCac} disabled={cacBusy}
            className="absolute right-1.5 top-1/2 flex h-9 -translate-y-1/2 items-center gap-1 rounded-lg bg-gradient-brand px-3 text-xs font-black text-primary-foreground shadow-cobalt disabled:opacity-60">
            {cacBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Verify CAC
          </button>
        </Field>
        {cacVerified && (
          <div className="animate-in fade-in zoom-in-95 rounded-2xl border-2 border-success/40 bg-success-soft p-4 shadow-[0_0_24px_-6px_color-mix(in_oklab,var(--success)_50%,transparent)]">
            <p className="flex items-center gap-1.5 text-sm font-black text-success"><Check className="h-4 w-4" strokeWidth={3} /> Corporate Affairs Commission Record Found</p>
            <p className="mt-2 text-sm font-extrabold text-foreground">ACME LOGISTICS &amp; PAYMENTS NIGERIA LTD</p>
            <p className="mt-0.5 text-xs font-semibold text-body">14 Marina Road, Lagos Island · <span className="text-success">ACTIVE</span> · Form CAC 1.1 Verified</p>
          </div>
        )}
        <CategoryPicker value={f.industry} onChange={(v) => { setF((p) => ({ ...p, industry: v })); setErr((e) => ({ ...e, industry: undefined })); }} error={err["industry"]} shake />
        <div>
          <p className="mb-1.5 text-sm font-bold text-foreground">Expected Monthly Processing Volume</p>
          <div className="flex flex-wrap gap-2">
            {VOLUMES.map((v) => (
              <button key={v} type="button" onClick={() => setVolume(v)} aria-pressed={volume === v}
                className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all ${volume === v ? "border-cobalt bg-cobalt/10 text-cobalt" : "border-border text-body hover:border-cyan"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep(1)}>← Back</Button>
          <Button variant="brand" type="submit" className="h-12 flex-[2]">Continue to Settlement &amp; PIN →</Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={launch} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4" key={`b3-${shake}`}>
      <StepBar n={3} labels={["Account Details", "CAC Verification", "Settlement & PIN"]} />
      <h2 className="text-xl font-black text-foreground">Settlement Bank &amp; Security PIN</h2>
      <Field label="Settlement Bank" id="b-bank" error={err["bank"]} shake>
        <SelectMenu id="b-bank" value={f.bank} options={BANK_OPTS} onChange={(v) => setF((p) => ({ ...p, bank: v }))} searchable placeholder="Select a licensed Nigerian bank" />
      </Field>
      <Field label="10-Digit Settlement NUBAN Account Number" id="b-nuban" error={err["nuban"]} shake>
        <input id="b-nuban" inputMode="numeric" maxLength={10} className={`${inputCls(false)} font-mono tracking-widest`} value={f.nuban} onChange={(e) => setF((p) => ({ ...p, nuban: e.target.value.replace(/\D/g, "") }))} placeholder="0123456789" />
        {resolved && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-success"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Account Resolved: {resolved}</p>}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Create 4-Digit Transaction PIN" id="b-pin" error={err["pin"]} shake>
          <div className="pt-1"><PinBoxes value={pin} onChange={setPin} /></div>
        </Field>
        <Field label="Confirm PIN" id="b-pin2" error={err["pin2"]} shake>
          <div className="pt-1"><PinBoxes value={pin2} onChange={setPin2} /></div>
        </Field>
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm font-semibold text-body">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cobalt" />
          I agree to Slikpay's Merchant Terms of Service, AML/CFT Regulatory Policy, and Sterling Bank BaaS Settlement Agreement.
        </label>
        <ErrorPill msg={err["terms"]} />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep(2)}>← Back</Button>
        <Button variant="brand" type="submit" disabled={busy} className="shine h-12 flex-[2] bg-gradient-tri text-base">
          {busy && <Loader2 className="animate-spin" />} Launch Slikpay Business Console 🚀
        </Button>
      </div>
    </form>
  );
}

/* ---------- personal sign-up ---------- */

function PersonalSignUp({ onDone, onBack }: { onDone: (p: Pending, remember: boolean) => void; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ country: "NG", name: "", email: "", phone: "", pw: "", tag: "", bvn: "" });
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const fail = (e: Record<string, string | undefined>) => { setErr(e); setShake((s) => s + 1); };
  const tagOk = /^[a-z0-9_]{3,}$/.test(f.tag);

  function next1(e: React.FormEvent) {
    e.preventDefault();
    const er = {
      name: f.name.trim().length >= 2 ? undefined : "Enter your full name",
      email: isEmail(f.email) ? undefined : "Enter a valid email address",
      phone: f.phone.replace(/\D/g, "").length >= 10 ? undefined : "Enter a valid phone number",
      pw: f.pw.length >= 8 ? undefined : "Password must be at least 8 characters",
    };
    if (Object.values(er).some(Boolean)) return fail(er);
    setErr({});
    setStep(2);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const er = {
      tag: tagOk ? undefined : "Handle must be 3+ letters, numbers or underscores",
      bvn: f.bvn.replace(/\D/g, "").length === 11 ? undefined : "Enter your 11-digit BVN or NIN",
      pin: isPin(pin) ? undefined : "PIN must be exactly 4 digits",
    };
    if (Object.values(er).some(Boolean)) return fail(er);
    setErr({});
    setBusy(true);
    const r = await api.register({ name: f.name, email: f.email, phone: f.phone, password: f.pw, accountType: "PERSONAL" });
    setBusy(false);
    onDone(r, true);
  }

  if (step === 1) {
    return (
      <form onSubmit={next1} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4" key={`p1-${shake}`}>
        <StepBar n={1} labels={["Personal Basics", "Wallet Identity & Security"]} />
        <h2 className="text-xl font-black text-foreground">Personal Basics</h2>
        <Field label="Country of Residence" id="p-country">
          <CountrySelect id="p-country" value={f.country} onChange={(v) => setF((p) => ({ ...p, country: v }))} />
        </Field>
        <Field label="Full Name" id="p-name" icon={UserIcon} error={err["name"]} shake>
          <input id="p-name" className={inputCls()} value={f.name} onChange={set("name")} placeholder="e.g. Adaora Nwosu" />
        </Field>
        <Field label="Email" id="p-email" icon={Mail} error={err["email"]} shake>
          <input id="p-email" type="email" autoComplete="email" className={inputCls()} value={f.email} onChange={set("email")} placeholder="you@example.com" />
        </Field>
        <Field label="Phone Number" id="p-phone" icon={Smartphone} error={err["phone"]} shake>
          <div className="flex gap-2">
            <span className="flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-cobalt/40 bg-cobalt/10 px-3 text-sm font-black text-foreground"><span className="text-lg leading-none">{dialOf(f.country).flag}</span><span className="font-mono">{dialOf(f.country).dial}</span></span>
            <input id="p-phone" type="tel" className={`${inputCls(false)} flex-1`} value={f.phone} onChange={set("phone")} placeholder="803 000 0000" />
          </div>
        </Field>
        <Field label="Password" id="p-pw" icon={Lock} error={err["pw"]} shake>
          <PasswordInput id="p-pw" value={f.pw} onChange={(v) => setF((p) => ({ ...p, pw: v }))} autoComplete="new-password" />
        </Field>
        <StrengthMeter pw={f.pw} />
        <Button variant="brand" type="submit" className="shine h-12 w-full bg-gradient-tri text-base">Continue →</Button>
        <button type="button" onClick={onBack} className="w-full text-sm font-bold text-body hover:text-foreground">← Change account type</button>
      </form>
    );
  }

  return (
    <form onSubmit={create} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4" key={`p2-${shake}`}>
      <StepBar n={2} labels={["Personal Basics", "Wallet Identity & Security"]} />
      <h2 className="text-xl font-black text-foreground">Wallet Identity &amp; Security</h2>
      <Field label="Choose your @SlikTag" id="p-tag" icon={AtSign} error={err["tag"]} shake>
        <input id="p-tag" className={inputCls()} value={f.tag} onChange={(e) => setF((p) => ({ ...p, tag: e.target.value.replace(/^@/, "").toLowerCase() }))} placeholder="babatunde" />
        {tagOk && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-success"><Check className="h-3.5 w-3.5" strokeWidth={3} /> @{f.tag} is Available</p>}
      </Field>
      <Field label="BVN / NIN Verification" id="p-bvn" error={err["bvn"]} shake
        hint="Required by CBN regulation to secure your wallet and lift transaction limits.">
        <input id="p-bvn" inputMode="numeric" maxLength={11} className={`${inputCls(false)} pl-10 font-mono tracking-widest`} value={f.bvn} onChange={(e) => setF((p) => ({ ...p, bvn: e.target.value.replace(/\D/g, "") }))} placeholder="11-digit BVN or NIN" />
        <Info className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </Field>
      <Field label="4-Digit Wallet Security PIN" id="p-pin" error={err["pin"]} shake>
        <div className="flex justify-center pt-1"><PinBoxes value={pin} onChange={setPin} /></div>
      </Field>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep(1)}>← Back</Button>
        <Button variant="brand" type="submit" disabled={busy} className="shine h-12 flex-[2] bg-gradient-tri text-base">
          {busy && <Loader2 className="animate-spin" />} Create My Free Wallet &amp; Get Account Number →
        </Button>
      </div>
    </form>
  );
}

/* ---------- success modal ---------- */

const CONFETTI_COLORS = ["var(--cobalt)", "var(--cyan)", "var(--magenta)", "var(--success)"];

function SuccessModal({ role, onEnter }: { role: Role; onEnter: () => void }) {
  const nuban = "8204918234";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Account ready">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} className="confetti-piece" style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % 4],
            animationDelay: `${(i % 10) * 0.12}s`,
            animationDuration: `${2.4 + (i % 5) * 0.4}s`,
          }} />
        ))}
      </div>
      <div className="panel relative w-full max-w-md animate-in zoom-in-95 rounded-3xl p-7 text-center shadow-2xl">
        <span className="mx-auto flex h-20 w-20 animate-in zoom-in-50 items-center justify-center rounded-3xl bg-gradient-tri text-primary-foreground shadow-cobalt duration-500">
          <Check className="h-10 w-10" strokeWidth={3} />
        </span>
        <h2 className="mt-5 text-2xl font-black text-foreground">Your Slikpay Account is Ready!</h2>
        <p className="mt-1 text-sm font-semibold text-body">Your dedicated Sterling Bank account has been generated.</p>
        <div className="mt-5 rounded-2xl border-2 border-cobalt/30 bg-cobalt/5 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sterling Bank Plc / Slikpay</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="font-mono text-2xl font-black tracking-widest text-foreground">{nuban}</span>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(nuban); toast.success("Account number copied"); }}
              className="flex items-center gap-1 rounded-lg border-2 border-border px-2.5 py-1.5 text-xs font-bold text-foreground hover:border-cobalt">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-success"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Active · Instant Settlement Enabled</p>
        </div>
        <Button variant="brand" className="shine mt-5 h-12 w-full bg-gradient-tri text-base" onClick={onEnter}>
          Enter {role === "merchant" ? "Console" : "Wallet"} Dashboard →
        </Button>
      </div>
    </div>
  );
}

/* ---------- account type selection (sign-up step 1) ---------- */

function TypeSelect({ onPick }: { onPick: (r: Role) => void }) {
  const [sel, setSel] = useState<Role | null>(null);
  const opts = [
    { v: "merchant" as const, icon: Building2, tone: "text-cobalt bg-cobalt/10", title: "Business / Merchant", points: ["SoftPOS & contactless acceptance", "Dedicated NUBANs & settlement sweeps", "Bulk payroll & developer APIs"] },
    { v: "personal" as const, icon: UserIcon, tone: "text-magenta bg-magenta/10", title: "Personal User", points: ["Free P2P via @SlikTag", "Virtual USD cards & bill payments", "Instant account number on signup"] },
  ];
  return (
    <div className="animate-in fade-in">
      <h2 className="text-xl font-black text-foreground">Choose your account type</h2>
      <p className="mt-1 text-sm font-medium text-body">This decides your dashboard, limits and verification steps.</p>
      <div className="mt-4 space-y-3">
        {opts.map(({ v, icon: Icon, tone, title, points }) => (
          <button key={v} type="button" onClick={() => setSel(v)} aria-pressed={sel === v}
            className={`flex w-full gap-4 rounded-2xl border-2 p-4 text-left transition-all ${sel === v ? "border-cobalt bg-cobalt/5 ring-4 ring-cobalt/10" : "border-border hover:border-cyan"}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
            <div className="flex-1">
              <div className="font-extrabold text-foreground">{title}</div>
              <ul className="mt-1 space-y-0.5">
                {points.map((pt) => <li key={pt} className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><Check className="h-3 w-3 shrink-0 text-success" strokeWidth={3} /> {pt}</li>)}
              </ul>
            </div>
            {sel === v && <Check className="h-5 w-5 shrink-0 text-cobalt" />}
          </button>
        ))}
      </div>
      <Button variant="brand" className="shine mt-5 h-12 w-full bg-gradient-tri text-base" disabled={!sel} onClick={() => sel && onPick(sel)}>Continue →</Button>
    </div>
  );
}

/* ---------- card root ---------- */

export function AuthCard({ onDone }: { onDone: (p: Pending, remember: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("in");
  const [role, setRole] = useState<Role>("merchant");
  const [picked, setPicked] = useState<Role | null>(null);
  const [success, setSuccess] = useState<Pending | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDone = (p: Pending, remember: boolean) => {
    if (mode === "up") setSuccess(p);
    else onDone(p, remember);
  };

  return (
    <div ref={cardRef}>
      {/* segmented primary switcher */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="tablist" aria-label="Sign in or create account">
        {([["in", "Sign In"], ["up", "Create Account"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => { setMode(v); if (v === "in") setPicked(null); }}
            className={`rounded-full py-2 text-sm font-black transition-all ${mode === v ? "bg-gradient-brand text-primary-foreground shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--cyan)_70%,transparent)]" : "text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === "in" && <div className="mb-5"><AccountTabs role={role} onChange={setRole} /></div>}
      {mode === "in"
        ? <SignIn key={`in-${role}`} role={role} onDone={handleDone} />
        : picked === null
          ? <TypeSelect onPick={(r) => { setPicked(r); setRole(r); }} />
          : picked === "merchant"
            ? <BusinessSignUp key="up-biz" onDone={handleDone} onBack={() => setPicked(null)} />
            : <PersonalSignUp key="up-per" onDone={handleDone} onBack={() => setPicked(null)} />}
      <div className="mt-5 flex items-center justify-between border-t-[1.5px] border-border pt-4 text-xs font-semibold">
        <span className="text-muted-foreground">{mode === "in" ? "New to Slikpay? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-bold text-cobalt hover:underline">{mode === "in" ? "Create free account" : "Sign in"}</button>
        </span>
        <a href="#kyb" className="font-bold text-body hover:text-cobalt">KYC / KYB requirements →</a>
      </div>
      {success && <SuccessModal role={success.role} onEnter={() => onDone(success, true)} />}
    </div>
  );
}
