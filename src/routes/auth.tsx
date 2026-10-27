import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight, Check, ChevronDown, CreditCard, Eye, EyeOff, Landmark, Loader2, Lock, Mail, ShieldCheck, Smartphone, User as UserIcon, Zap, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, type Role, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isEmail, isPin, passwordStrength } from "@/lib/password";
import { Logo } from "@/components/slikpay/Logo";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Slikpay" },
      { name: "description", content: "Sign in or open a Slikpay Business or Personal account, powered by Sterling Bank." },
      { property: "og:title", content: "Sign in — Slikpay" },
      { property: "og:description", content: "Access your Slikpay Business console or Personal wallet." },
    ],
  }),
  component: AuthPage,
});

const FEATURES: { icon: LucideIcon; tone: string; title: string; desc: string }[] = [
  { icon: Zap, tone: "bg-cobalt", title: "Automated T+0 Settlement", desc: "Real-time central bank NIP inflows with automated midnight sweeps to your dedicated Sterling Bank NUBAN." },
  { icon: Smartphone, tone: "bg-gradient-brand", title: "SoftPOS Contactless Terminal", desc: "Turn any NFC Android phone into an institutional contactless card terminal with 0.5s tap-to-pay clearing." },
  { icon: CreditCard, tone: "bg-magenta", title: "Virtual Dollar Mastercards", desc: "High-limit virtual cards for global AWS, Google Cloud, Meta ads, and international shopping." },
  { icon: ArrowLeftRight, tone: "bg-gradient-tri", title: "Instant Operational Payouts & Swaps", desc: "Sub-second NIP payouts to all 45+ Nigerian banks and zero-spread fiat-to-stablecoin treasury swaps." },
];
const TRUST = ["Powered by Sterling Bank Core Clearing Rails", "CBN & NDIC Regulated BaaS Partner", "Bank-Grade 256-Bit TLS & PCI-DSS Level 1 Encryption"];

function FeatureList() {
  return (
    <div className="space-y-3">
      {FEATURES.map(({ icon: Icon, tone, title, desc }) => (
        <div key={title} className="panel flex gap-4 p-4 transition-colors hover:border-cyan">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground ${tone}`}><Icon className="h-5 w-5" /></span>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
            <p className="mt-0.5 text-[13px] font-medium leading-snug text-muted-foreground">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPill({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return <p role="alert" className="mt-1.5 inline-block rounded-full border border-destructive/30 bg-destructive/10 px-3 py-0.5 text-xs font-bold text-destructive">{msg}</p>;
}

function Field({ label, id, icon: Icon, error, children }: { label: string; id: string; icon?: LucideIcon; error?: string | undefined; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-foreground">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        {children}
      </div>
      <ErrorPill msg={error} />
    </div>
  );
}

const inputCls = (icon = true) => `field h-12 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-cobalt/10 ${icon ? "pl-10" : ""}`;

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} className={`${inputCls()} pr-11`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="At least 8 characters" />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </>
  );
}

const STRENGTH_CLS = { Weak: "bg-destructive", Medium: "bg-magenta", Strong: "bg-cobalt" } as const;

function StrengthMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const { label, score } = passwordStrength(pw);
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < (label === "Strong" ? 3 : label === "Medium" ? 2 : score > 0 ? 1 : 0) ? STRENGTH_CLS[label] : "bg-muted"}`} />)}
      </div>
      <span className="text-xs font-bold text-body">{label}</span>
    </div>
  );
}

function Steps({ n, total }: { n: number; total: number }) {
  return (
    <div className="mb-5 flex gap-1.5" aria-label={`Step ${n} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < n ? "bg-cobalt" : "bg-muted"}`} />)}
    </div>
  );
}

type Pending = { token: string; user: User; role: Role };

function SignIn({ onDone }: { onDone: (p: Pending, remember: boolean) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<{ email?: string | undefined; pw?: string | undefined; otp?: string | undefined }>({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(45);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (step !== 2 || timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, timer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = { email: isEmail(email) ? undefined : "Enter a valid email address", pw: pw.length >= 8 ? undefined : "Password must be at least 8 characters" };
    setErr(next);
    if (next.email || next.pw) return;
    setBusy(true);
    try {
      const r = await api.login(email, pw);
      setPending(r);
      setStep(2);
      setTimer(45);
    } catch {
      setErr({ pw: "We couldn't sign you in. Check your details." });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    const r = await api.verify2fa(otp);
    setBusy(false);
    if (r.success && pending) onDone(pending, remember);
    else setErr({ otp: "Invalid code. Enter the 6 digits sent to you." });
  }

  if (forgot) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
        <h2 className="text-xl font-black text-foreground">Reset your password</h2>
        <p className="text-sm font-medium text-body">We'll email you a secure link to set a new password.</p>
        <Field label="Email address" id="reset" icon={Mail} error={err.email}>
          <input id="reset" type="email" className={inputCls()} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Button variant="brand" className="h-12 w-full" onClick={async () => {
          if (!isEmail(email)) return setErr({ email: "Enter a valid email address" });
          await api.forgotPassword(email);
          toast.success("Reset link sent if the account exists");
          setForgot(false);
        }}>Send reset link →</Button>
        <button onClick={() => setForgot(false)} className="w-full text-sm font-bold text-cobalt hover:underline">Back to sign in</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4">
        <Steps n={2} total={2} />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt"><ShieldCheck className="h-6 w-6" /></span>
        <h2 className="mt-4 text-xl font-black text-foreground">Two-Factor Security Verification</h2>
        <p className="mt-1 text-sm font-medium text-body">Enter the 6-digit verification code sent to your registered email or authenticator app.</p>
        <div className="mt-6 flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-xl border-2 border-l-2 text-xl font-black first:rounded-xl last:rounded-xl" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="text-center"><ErrorPill msg={err.otp} /></div>
        <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
          {timer > 0 ? <>Resend code in {timer}s</> : <button className="font-bold text-cobalt hover:underline" onClick={() => { setTimer(45); toast.success("A new code is on its way"); }}>Resend code</button>}
        </p>
        <Button variant="brand" className="mt-5 h-12 w-full text-base" disabled={otp.length !== 6 || busy} onClick={verify}>
          {busy && <Loader2 className="animate-spin" />} Verify & Launch Console →
        </Button>
        <button onClick={() => { setStep(1); setOtp(""); }} className="mt-3 w-full text-sm font-bold text-body hover:text-foreground">← Use a different account</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="animate-in fade-in space-y-4">
      <Field label="Email address" id="email" icon={Mail} error={err.email}>
        <input id="email" type="email" autoComplete="email" className={inputCls()} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </Field>
      <Field label="Password" id="password" icon={Lock} error={err.pw}>
        <PasswordInput id="password" value={pw} onChange={setPw} autoComplete="current-password" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 font-semibold text-body">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-cobalt" /> Remember this device for 30 days
        </label>
        <button type="button" onClick={() => setForgot(true)} className="font-bold text-cobalt hover:underline">Forgot Password?</button>
      </div>
      <Button variant="brand" type="submit" disabled={busy} className="h-12 w-full text-base">
        {busy && <Loader2 className="animate-spin" />} Sign In to Console →
      </Button>
      <p className="text-center text-xs font-semibold text-muted-foreground">Tip: an email containing “personal” opens the Personal wallet.</p>
    </form>
  );
}

function SignUp({ onDone }: { onDone: (p: Pending, remember: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<"BUSINESS" | "PERSONAL" | null>(null);
  const [f, setF] = useState({ biz: "", cac: "", director: "", first: "", last: "", email: "", phone: "", pw: "" });
  const [terms, setTerms] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const isBiz = type === "BUSINESS";

  function next2(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string | undefined> = {
      biz: isBiz && f.biz.trim().length < 2 ? "Enter your legal business name" : undefined,
      director: isBiz && f.director.trim().length < 2 ? "Enter the principal director's name" : undefined,
      first: !isBiz && !f.first.trim() ? "Enter your first name" : undefined,
      last: !isBiz && !f.last.trim() ? "Enter your last name" : undefined,
      email: isEmail(f.email) ? undefined : "Enter a valid email address",
      phone: f.phone.replace(/\D/g, "").length >= 10 ? undefined : "Enter a valid phone number",
      pw: f.pw.length >= 8 ? undefined : "Password must be at least 8 characters",
      terms: terms ? undefined : "Please accept the Terms & Privacy Policy",
    };
    setErr(er);
    if (Object.values(er).some(Boolean)) return;
    setStep(3);
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (!isPin(pin)) return setErr({ pin: "PIN must be exactly 4 digits" });
    if (pin !== pin2) return setErr({ pin2: "PINs don't match" });
    setErr({});
    setBusy(true);
    const name = isBiz ? f.biz : `${f.first} ${f.last}`;
    const r = await api.register({ name, email: f.email, phone: f.phone, password: f.pw, accountType: type! });
    setBusy(false);
    setStep(4);
    setTimeout(() => onDone(r, true), 2200);
  }

  if (step === 1) {
    const opts = [
      { v: "BUSINESS" as const, icon: Landmark, tone: "text-cobalt bg-cobalt/10", title: "Business / Merchant", desc: "For registered companies, fintechs, and merchants needing dedicated Sterling NUBANs, automated settlement, and API keys." },
      { v: "PERSONAL" as const, icon: UserIcon, tone: "text-magenta bg-magenta/10", title: "Personal / Consumer", desc: "For individuals needing a fast digital wallet, instant bank transfers, bill payments, and a USD Virtual Card." },
    ];
    return (
      <div className="animate-in fade-in">
        <Steps n={1} total={4} />
        <h2 className="text-xl font-black text-foreground">Choose your account type</h2>
        <div className="mt-4 space-y-3">
          {opts.map(({ v, icon: Icon, tone, title, desc }) => (
            <button key={v} type="button" onClick={() => setType(v)} aria-pressed={type === v}
              className={`flex w-full gap-4 rounded-2xl border-2 p-4 text-left transition-all ${type === v ? "border-cobalt bg-cobalt/5 ring-4 ring-cobalt/10" : "border-border hover:border-cyan"}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <div className="flex-1">
                <div className="font-extrabold text-foreground">{title}</div>
                <p className="mt-0.5 text-[13px] font-medium leading-snug text-muted-foreground">{desc}</p>
              </div>
              {type === v && <Check className="h-5 w-5 text-cobalt" />}
            </button>
          ))}
        </div>
        <Button variant="brand" className="mt-5 h-12 w-full text-base" disabled={!type} onClick={() => setStep(2)}>Continue →</Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <form onSubmit={next2} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4">
        <Steps n={2} total={4} />
        <h2 className="text-xl font-black text-foreground">{isBiz ? "Business details" : "Your details"}</h2>
        {isBiz ? (
          <>
            <Field label="Legal business / merchant name" id="biz" icon={Landmark} error={err["biz"]}><input id="biz" className={inputCls()} value={f.biz} onChange={set("biz")} placeholder="Prime Tech Ltd" /></Field>
            <Field label="CAC registration number (optional)" id="cac"><input id="cac" className={inputCls(false)} value={f.cac} onChange={set("cac")} placeholder="RC 1234567" /></Field>
            <Field label="Full name of principal director" id="director" icon={UserIcon} error={err["director"]}><input id="director" className={inputCls()} value={f.director} onChange={set("director")} placeholder="Patrick Otu" /></Field>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" id="first" error={err["first"]}><input id="first" className={inputCls(false)} value={f.first} onChange={set("first")} placeholder="Adaora" /></Field>
            <Field label="Last name" id="last" error={err["last"]}><input id="last" className={inputCls(false)} value={f.last} onChange={set("last")} placeholder="Nwosu" /></Field>
          </div>
        )}
        <Field label={isBiz ? "Business email" : "Personal email"} id="su-email" icon={Mail} error={err["email"]}><input id="su-email" type="email" className={inputCls()} value={f.email} onChange={set("email")} placeholder="you@company.com" /></Field>
        <Field label="Phone number" id="phone" icon={Smartphone} error={err["phone"]}><input id="phone" type="tel" className={inputCls()} value={f.phone} onChange={set("phone")} placeholder="+234 803 000 0000" /></Field>
        <Field label="Password" id="su-pw" icon={Lock} error={err["pw"]}>
          <PasswordInput id="su-pw" value={f.pw} onChange={(v) => setF((p) => ({ ...p, pw: v }))} autoComplete="new-password" />
        </Field>
        <StrengthMeter pw={f.pw} />
        <div>
          <label className="flex items-start gap-2 text-sm font-semibold text-body">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cobalt" />
            I agree to Slikpay's Terms of Service and Privacy Policy.
          </label>
          <ErrorPill msg={err["terms"]} />
        </div>
        <Button variant="brand" type="submit" className="h-12 w-full text-base">Continue to Security Setup →</Button>
        <button type="button" onClick={() => setStep(1)} className="w-full text-sm font-bold text-body hover:text-foreground">← Back</button>
      </form>
    );
  }

  if (step === 3) {
    const pinInput = (id: string, v: string, on: (s: string) => void) => (
      <input id={id} type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={v} onChange={(e) => on(e.target.value.replace(/\D/g, ""))}
        className={`${inputCls(false)} text-center font-mono text-2xl tracking-[0.6em]`} placeholder="••••" />
    );
    return (
      <form onSubmit={activate} noValidate className="animate-in fade-in slide-in-from-right-4 space-y-4">
        <Steps n={3} total={4} />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt"><ShieldCheck className="h-6 w-6" /></span>
        <h2 className="text-xl font-black text-foreground">Set your security PIN</h2>
        <p className="text-sm font-medium text-body">This 4-digit PIN approves instant payouts and settlements.</p>
        <Field label="4-digit PIN" id="pin" error={err["pin"]}>{pinInput("pin", pin, setPin)}</Field>
        <Field label="Confirm PIN" id="pin2" error={err["pin2"]}>{pinInput("pin2", pin2, setPin2)}</Field>
        <Button variant="brand" type="submit" disabled={busy} className="h-12 w-full text-base">
          {busy && <Loader2 className="animate-spin" />} Complete Activation & Open Account →
        </Button>
        <button type="button" onClick={() => setStep(2)} className="w-full text-sm font-bold text-body hover:text-foreground">← Back</button>
      </form>
    );
  }

  return (
    <div className="animate-in fade-in zoom-in-95 py-8 text-center">
      <span className="mx-auto flex h-20 w-20 animate-in zoom-in-50 items-center justify-center rounded-3xl bg-gradient-tri text-primary-foreground shadow-cobalt duration-500">
        <Check className="h-10 w-10" strokeWidth={3} />
      </span>
      <h2 className="mt-6 text-2xl font-black text-foreground">Welcome to Slikpay!</h2>
      <p className="mt-1 font-semibold text-body">Your account is ready.</p>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening your {isBiz ? "Business Console" : "Personal Wallet"}…
      </p>
    </div>
  );
}

function AuthPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [showFeatures, setShowFeatures] = useState(false);

  const finish = (p: Pending, remember: boolean) => {
    signIn(p.token, p.user, p.role, remember);
    toast.success(`Welcome, ${p.user.name.split(" ")[0]}`);
    navigate({ to: p.role === "merchant" ? "/dashboard" : "/personal" });
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[45fr_55fr]">
      <aside className="relative border-b-[1.5px] border-border lg:border-b-0 lg:border-r-[1.5px]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-tri" />
        <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8 lg:sticky lg:top-0 lg:min-h-screen lg:px-12 lg:py-12">
          <Logo sub="by Sterling Bank" />
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground lg:text-[34px]">The Unified Pan-African & Global Financial Operating System</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-body lg:text-base">Institutional settlement rails, contactless SoftPOS tap-to-pay, and virtual treasury cards engineered for high-growth businesses and modern consumers.</p>
          </div>
          <button className="flex items-center justify-between rounded-xl border-2 border-border px-4 py-3 text-sm font-bold text-foreground lg:hidden" onClick={() => setShowFeatures(!showFeatures)} aria-expanded={showFeatures}>
            <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan" /> Why Slikpay? 4 core features</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showFeatures ? "rotate-180" : ""}`} />
          </button>
          <div className={`${showFeatures ? "block" : "hidden"} lg:block`}><FeatureList /></div>
          <ul className="mt-auto space-y-2 border-t-[1.5px] border-border pt-5">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs font-bold text-body"><ShieldCheck className="h-4 w-4 shrink-0 text-cobalt" /> {t}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 lg:py-12">
        <div className="w-full max-w-md">
          <div className="mb-7 grid grid-cols-2 rounded-2xl border-2 border-border p-1.5">
            {(["in", "up"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${tab === t ? "bg-cobalt text-primary-foreground shadow-cobalt" : "text-body hover:text-foreground"}`}>
                {t === "in" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          {tab === "in" ? <SignIn key="in" onDone={finish} /> : <SignUp key="up" onDone={finish} />}
        </div>
      </main>
    </div>
  );
}
