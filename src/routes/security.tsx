import { createFileRoute } from "@tanstack/react-router";
import { Bell, Fingerprint, KeyRound, Landmark, Lock, Radar, RefreshCcw, ShieldCheck, UserCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, PageHero, SectionHead } from "@/components/marketing/widgets";
import securityImg from "@/assets/marketing/mkt-security.png";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Slikcash" },
      { name: "description", content: "How Slikcash protects your money and data: 256-bit encryption, PCI-DSS Level 1, two-factor authentication, signed webhooks and 24/7 monitoring." },
      { property: "og:title", content: "Security — Slikcash" },
      { property: "og:description", content: "Bank-grade protection for every account, transaction and API call." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://slikcash.com/security" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://slikcash.com/security" }],
  }),
  component: SecurityPage,
});

const PROTECTIONS = [
  { icon: <Lock className="h-5 w-5" />, title: "Encryption everywhere", text: "256-bit TLS protects every connection, and sensitive data is encrypted at rest with strong, audited algorithms." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "PCI-DSS Level 1", text: "Card data is processed by PCI-DSS Level 1 certified infrastructure — the highest level of payment-card security." },
  { icon: <Fingerprint className="h-5 w-5" />, title: "2FA & settlement PIN", text: "Sign-in requires email or authenticator verification, and every money movement is gated behind your transaction PIN." },
  { icon: <KeyRound className="h-5 w-5" />, title: "Vaulted API keys", text: "API secrets are hashed for verification and stored encrypted, revealed only once behind a one-time email code." },
  { icon: <Radar className="h-5 w-5" />, title: "24/7 monitoring", text: "Real-time anomaly detection watches every transaction; unusual activity triggers review before funds move." },
  { icon: <RefreshCcw className="h-5 w-5" />, title: "Never double-charged", text: "Idempotent payment processing means a retried tap, click or webhook can never debit you twice." },
];

const MONEY = [
  { icon: <Landmark className="h-5 w-5" />, title: "Segregated partner-bank accounts", text: "Customer funds are held with licensed, NDIC-insured partner banks — never lent out or re-invested by Slikcash." },
  { icon: <UserCheck className="h-5 w-5" />, title: "Maker-checker controls", text: "Sensitive operations require layered approvals, and every action is written to a tamper-evident audit trail." },
  { icon: <Bell className="h-5 w-5" />, title: "Instant alerts", text: "Email and in-product notifications for sign-ins and transactions, so you spot anything that isn't you, fast." },
];

const TIPS = [
  "Never share your password, PIN or one-time codes — Slikcash will never ask for them by phone, email or social media.",
  "Always confirm you are on slikcash.com before signing in.",
  "Turn on two-factor authentication and keep your authenticator device private.",
  "Use a unique password for Slikcash — not one you reuse anywhere else.",
  "Report anything suspicious immediately to support@slikcash.com.",
];

function SecurityPage() {
  return (
    <MarketingShell active="/security">
      <PageHero
        kicker="Security"
        title={<>Security engineered like a <span className="mkt-grad-text">bank vault</span></>}
        sub="Every Slikcash account is defended by layered encryption, certified card infrastructure, mandatory verification and round-the-clock monitoring — because trust is our only product."
        image={securityImg}
        imageAlt="A security shield with a padlock and fingerprint symbol"
      />

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Platform defences" title="Six layers between your money and the world" sub="Security is not a feature we added — it is how the platform is built, from the first line of code to the last audit." />
          <div className="mkt-grid-3">
            {PROTECTIONS.map((p, i) => (
              <div key={p.title} className="mkt-reveal" style={{ "--mkt-d": `${i * 70}ms` } as CSSProperties}>
                <FeatureCard icon={p.icon} title={p.title}>{p.text}</FeatureCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Your money" title="How your funds are protected" />
          <div className="mkt-grid-3">
            {MONEY.map((p, i) => (
              <div key={p.title} className="mkt-reveal" style={{ "--mkt-d": `${i * 70}ms` } as CSSProperties}>
                <FeatureCard icon={p.icon} title={p.title}>{p.text}</FeatureCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Your part" title="Five habits that keep you safe" sub="The strongest vault still needs a careful keyholder. These habits protect you everywhere — not just on Slikcash." />
          <div className="mkt-card mkt-reveal" style={{ padding: "clamp(1.25rem, 3vw, 2rem)" }}>
            <ol className="mkt-legal-list">
              {TIPS.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-card mkt-reveal" style={{ padding: "clamp(1.25rem, 3vw, 2rem)" }}>
            <SectionHead kicker="Responsible disclosure" title="Found a vulnerability?" />
            <p style={{ color: "var(--mkt-muted)", lineHeight: 1.7, maxWidth: "44rem" }}>
              We welcome reports from security researchers. Email <a href="mailto:support@slikcash.com" style={{ color: "var(--mkt-cobalt)", fontWeight: 700 }}>support@slikcash.com</a> with
              the subject <strong>"Security report"</strong> and a description of the issue. Please give us reasonable time to investigate and fix before any public disclosure — we commit to acknowledging every report.
            </p>
          </div>
        </div>
      </section>

      <CtaBand title="Open an account built on trust" sub="Bank-grade security on every wallet, transfer and card — free to start." />
    </MarketingShell>
  );
}
