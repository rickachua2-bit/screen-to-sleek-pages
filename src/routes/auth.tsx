import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Briefcase, Loader2, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { api, type Role, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FlameMark } from "@/components/slikpay/Logo";
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

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/25 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={title} className="panel w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [type, setType] = useState<"BUSINESS" | "PERSONAL">("BUSINESS");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ token: string; user: User; role: Role } | null>(null);
  const [otp, setOtp] = useState("");
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const finish = (p: { token: string; user: User; role: Role }) => {
    signIn(p.token, p.user, p.role, remember);
    toast.success(`Welcome, ${p.user.name.split(" ")[0]}`);
    navigate({ to: p.role === "merchant" ? "/dashboard" : "/personal" });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (f.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (tab === "up" && f.name.trim().length < 2) {
      toast.error("Enter your full or business name");
      return;
    }
    setBusy(true);
    try {
      if (tab === "in") {
        const r = await api.login(f.email, f.password);
        if (r.requires2fa) setPending(r);
        else finish(r);
      } else {
        const r = await api.register({ ...f, accountType: type });
        setPending(r);
      }
    } catch {
      toast.error("We couldn't sign you in. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const r = await api.verify2fa(otp);
    if (r.success && pending) finish(pending);
    else toast.error("Invalid code. Enter the 6 digits sent to you.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="panel p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <FlameMark className="h-12 w-12" />
            <h1 className="mt-3 text-2xl font-black text-foreground">Slikpay</h1>
            <p className="text-sm font-semibold text-body">Banking for business and life · by Sterling Bank</p>
          </div>
          <div className="mb-6 grid grid-cols-2 rounded-xl border-2 border-border p-1">
            {(["in", "up"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 text-sm font-bold ${tab === t ? "bg-cobalt text-primary-foreground shadow-cobalt" : "text-body hover:text-foreground"}`}>
                {t === "in" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {tab === "up" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {([["BUSINESS", "Business Account", "Merchant, settlement, BaaS APIs", Briefcase], ["PERSONAL", "Personal Account", "Wallet, transfers, bills, card", UserIcon]] as const).map(([v, l, d, Icon]) => (
                    <button type="button" key={v} onClick={() => setType(v)} className={`rounded-xl border-2 p-3 text-left transition-colors ${type === v ? "border-cobalt bg-cobalt/5" : "border-border hover:border-cyan"}`}>
                      <Icon className={`h-5 w-5 ${type === v ? "text-cobalt" : "text-body"}`} />
                      <div className="mt-2 text-sm font-extrabold text-foreground">{l}</div>
                      <div className="text-[11px] font-semibold leading-snug text-muted-foreground">{d}</div>
                    </button>
                  ))}
                </div>
                <Field label={type === "BUSINESS" ? "Business legal name" : "Full name"} id="name">
                  <input id="name" className="field" value={f.name} onChange={set("name")} placeholder={type === "BUSINESS" ? "Prime Tech Ltd" : "Adaora Nwosu"} />
                </Field>
                <Field label="Phone number" id="phone">
                  <input id="phone" type="tel" className="field" value={f.phone} onChange={set("phone")} placeholder="+234 803 000 0000" />
                </Field>
              </>
            )}
            <Field label="Email" id="email">
              <input id="email" type="email" autoComplete="email" className="field" value={f.email} onChange={set("email")} placeholder="you@company.com" />
            </Field>
            <Field label="Password" id="password">
              <input id="password" type="password" autoComplete={tab === "in" ? "current-password" : "new-password"} className="field" value={f.password} onChange={set("password")} placeholder="At least 8 characters" />
            </Field>
            {tab === "in" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 font-semibold text-body">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-cobalt" /> Remember me
                </label>
                <button type="button" onClick={() => setForgot(true)} className="font-bold text-cobalt hover:underline">Forgot password?</button>
              </div>
            )}
            <Button variant="brand" type="submit" disabled={busy} className="h-11 w-full text-base">
              {busy && <Loader2 className="animate-spin" />} {tab === "in" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Tip: use an email containing “personal” to land in the Personal wallet.</p>
      </div>

      {pending && (
        <Modal title="Two-factor verification" onClose={() => setPending(null)}>
          <p className="mb-4 text-sm font-semibold text-body">Enter the 6-digit code sent to your phone and email.</p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 border-2 text-lg font-bold" />)}</InputOTPGroup>
            </InputOTP>
          </div>
          <Button variant="brand" className="mt-5 h-11 w-full" disabled={otp.length !== 6} onClick={verify}>Verify & continue</Button>
        </Modal>
      )}
      {forgot && (
        <Modal title="Reset your password" onClose={() => setForgot(false)}>
          <p className="mb-4 text-sm font-semibold text-body">We'll email you a secure link to set a new password.</p>
          <input aria-label="Email" type="email" className="field" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@company.com" />
          <Button variant="brand" className="mt-4 h-11 w-full" onClick={async () => { await api.forgotPassword(resetEmail); toast.success("Reset link sent if the account exists"); setForgot(false); }}>Send reset link</Button>
        </Modal>
      )}
    </div>
  );
}
