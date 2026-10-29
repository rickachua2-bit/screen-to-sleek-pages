import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Code2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, type Pending } from "@/components/slikpay/AuthCard";
import { AuthMobileBottomNav, CtaBand, Disclaimer, FeatureGrid, FloatingChips, PartnerStrip, Footer, HeroIntro, HowItWorks, KybSection, RailsTicker, TopNav } from "@/components/slikpay/AuthSections";

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

const TRUST = ["Licensed partner-bank rails", "CBN & NDIC regulated partner", "256-bit TLS · PCI-DSS Level 1"];

function AuthPage() {
    const navigate = useNavigate();

  const finish = (p: Pending) => {
    toast.success(`Welcome, ${p.user.name.split(" ")[0]}`);
    if (p.role === "merchant") navigate({ to: "/dashboard", search: { module: "overview" } });
    else navigate({ to: "/personal", search: { module: "home" } });
  };

  return (
    <div className="theme-flame min-h-screen bg-background pb-20 lg:pb-0 overflow-x-clip w-full">
      <TopNav />
      <RailsTicker />
      <section className="bg-mesh relative overflow-hidden">
        <div className="aurora" />
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="animate-blob pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-cobalt/15 blur-3xl" />
        <div className="animate-blob pointer-events-none absolute -right-32 top-20 h-[460px] w-[460px] rounded-full bg-magenta/12 blur-3xl [animation-delay:-5s]" />
        <div className="animate-blob pointer-events-none absolute bottom-0 left-1/2 h-[340px] w-[340px] rounded-full bg-cyan/20 blur-3xl [animation-delay:-10s]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1.25fr_1fr] lg:py-16">
          <div className="order-2 lg:order-1"><HeroIntro /></div>
          <div id="signin" className="order-1 lg:order-2">
            <div className="relative isolate lg:sticky lg:top-24">
              <div className="halo" />
              <FloatingChips />
              <div className="panel glow-border relative rounded-3xl border-transparent bg-background/90 p-6 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--cobalt)_35%,transparent)] backdrop-blur-2xl sm:p-8">
                <div className="mb-5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt">
                  <ShieldCheck className="h-3 w-3" /> Secure authentication
                </div>
                <AuthCard onDone={finish} />
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-cobalt/20 bg-cobalt/5 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-cobalt"><Code2 className="h-4 w-4" /></span>
                  <p className="flex-1 text-xs font-bold text-foreground">Building an integration or e-commerce store?</p>
                  <span className="font-mono text-[10px] font-bold text-cobalt">API keys + live sandbox</span>
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {TRUST.map((t) => <li key={t} className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> {t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <PartnerStrip />
      <FeatureGrid />
      <KybSection />
      <HowItWorks />
      <CtaBand />
      <Disclaimer />
      <Footer />
      <AuthMobileBottomNav />
    </div>
  );
}
