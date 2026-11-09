import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Landmark, Lock, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, type Pending } from "@/components/slikpay/AuthCard";
import { FlameMark, Logo } from "@/components/slikpay/Logo";
import { DOCS_URL } from "@/lib/business-api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Slikpay" },
      { name: "description", content: "Sign in or open a Slikpay Business or Personal account in minutes." },
      { property: "og:title", content: "Sign in — Slikpay" },
      { property: "og:description", content: "Access your Slikpay Business console or Personal wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const TRUST = [
  { icon: ShieldCheck, title: "Bank-grade security", text: "Two-factor authentication and a settlement PIN protect every account." },
  { icon: Landmark, title: "Licensed partner banks", text: "Accounts and settlement run on regulated banking partners in every market." },
  { icon: Zap, title: "Instant settlement", text: "Real-time transfers, collections and payouts across Africa and beyond." },
];

const ASSURANCE = ["Licensed partner-bank rails", "256-bit TLS encryption", "PCI-DSS Level 1"];

function AuthPage() {
  const navigate = useNavigate();

  const finish = (p: Pending) => {
    toast.success(`Welcome, ${p.user.name.split(" ")[0]}`);
    if (p.role === "merchant") navigate({ to: "/dashboard", search: { module: "overview" } });
    else navigate({ to: "/wallet", search: { module: "home" } });
  };

  return (
    <div className="theme-flame relative flex min-h-screen w-full flex-col overflow-x-clip bg-background">
      {/* soft brand glows — no patterns */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-blob absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-cobalt/20 blur-3xl" />
        <div className="animate-blob absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-magenta/15 blur-3xl [animation-delay:-6s]" />
        <div className="animate-blob absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-cyan/15 blur-3xl [animation-delay:-12s]" />
      </div>

      {/* minimal top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <a href="/" aria-label="Slikcash home"><Logo sub="Pan-African Financial OS" hideSubOnMobile /></a>
        <div className="flex items-center gap-2">
          <a href={DOCS_URL} target="_blank" rel="noreferrer noopener" className="hidden rounded-full border border-border/70 px-4 py-2 text-xs font-bold text-foreground transition-colors hover:border-cobalt hover:text-cobalt sm:inline-flex">
            Developer docs
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-4 py-2 text-xs font-bold text-foreground transition-colors hover:border-cobalt hover:text-cobalt">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </a>
        </div>
      </header>

      {/* split: brand story + sign-in card */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:pt-0">
        {/* brand side */}
        <div className="hidden flex-col gap-8 lg:flex">
          <FlameMark className="h-16 w-16 flame-glow" />
          <div>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-foreground xl:text-5xl">
              Money that moves<br />at the speed of <span className="bg-gradient-to-r from-cyan via-cobalt to-magenta bg-clip-text text-transparent">trust.</span>
            </h1>
            <p className="mt-4 max-w-md text-base font-semibold leading-relaxed text-body">
              One sign-in for your business console and personal wallet — collections, transfers, cards, FX and developer APIs across Africa.
            </p>
          </div>
          <ul className="space-y-5">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cobalt/25 bg-cobalt/10 text-cyan">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-black text-foreground">{title}</span>
                  <span className="mt-0.5 block text-sm font-medium leading-relaxed text-body">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* sign-in card */}
        <div id="signin" className="mx-auto w-full max-w-md">
          <div className="relative isolate">
            <div className="halo" aria-hidden />
            <div className="panel relative w-full rounded-3xl border border-border/60 bg-background/85 p-5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--cobalt)_40%,transparent)] backdrop-blur-2xl sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt">
                  <Lock className="h-3 w-3" /> Secure authentication
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> All systems live
                </span>
              </div>
              <AuthCard onDone={finish} />
            </div>
          </div>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            {ASSURANCE.map((t) => (
              <li key={t} className="flex items-center gap-1.5 text-[11px] font-semibold text-body">
                <ShieldCheck className="h-3 w-3 text-cyan" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* compact compliance footer */}
      <footer className="relative z-10 border-t border-border/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center sm:px-6">
          <p className="max-w-3xl text-[11px] font-medium leading-relaxed text-body">
            Slikpay is a financial technology company, not a bank. Banking services, accounts and settlement are provided by licensed partner banks and regulated financial institutions.
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground">© 2026 Slikpay Technologies Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
