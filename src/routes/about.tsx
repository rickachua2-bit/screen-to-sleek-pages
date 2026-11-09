import { createFileRoute } from "@tanstack/react-router";
import { Landmark, Lock, Scale, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, SectionHead } from "@/components/marketing/widgets";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Regulatory Transparency — Slikcash" },
      { name: "description", content: "Slikcash is a financial service provider delivering banking and payments through licensed, CBN-regulated partner banks with NDIC-insured deposits." },
      { property: "og:title", content: "About & Regulatory Transparency — Slikcash" },
      { property: "og:description", content: "Our mission, team, licensing and security infrastructure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const TEAM = [
  { initials: "AO", name: "Adaeze Okafor", role: "Chief Executive Officer" },
  { initials: "TB", name: "Tunde Bakare", role: "Chief Technology Officer" },
  { initials: "NE", name: "Ngozi Eze", role: "Chief Compliance Officer" },
  { initials: "DM", name: "David Mensah", role: "Chief Product Officer" },
];

function AboutPage() {
  return (
    <MarketingShell active="/about">
      <section className="mkt-pagehero">
        <div className="mkt-container">
          <span className="mkt-kicker">About Slikcash</span>
          <h1>Banking infrastructure for <span className="mkt-grad-text">Africa's ambition</span></h1>
          <p>
            We started Slikcash with a simple conviction: moving money in and out of Africa should be as
            fast, cheap and reliable as sending a message. Today we power wallets, cards, gateways and
            cross-border payouts for hundreds of thousands of people and businesses.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Leadership" title="The team behind the rails" />
          <div className="mkt-grid-3" style={{ gridTemplateColumns: undefined }}>
            <div className="mkt-grid-3" style={{ width: "100%" }}>
              {TEAM.map((t) => (
                <div key={t.name} className="mkt-card mkt-team">
                  <span className="mkt-avatar">{t.initials}</span>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Regulatory transparency"
            title="Licensed partners, insured deposits, audited rails"
            sub="Slikcash is not a bank. Every service is delivered through licensed bank partners, and we publish exactly how your money is held and moved."
          />
          <div className="mkt-grid-2">
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="Licensed partner banks">
              Customer deposits are held with NDIC-insured commercial bank partners, and all Naira transfers
              move over CBN-licensed NIBSS clearing rails. Slikcash never lends out or re-invests customer funds.
            </FeatureCard>
            <FeatureCard icon={<Scale className="h-5 w-5" />} title="Compliance-first operations">
              Full KYC and KYB verification, sanctions screening, transaction monitoring and maker-checker
              governance are built into every account — not bolted on afterwards.
            </FeatureCard>
            <FeatureCard icon={<Lock className="h-5 w-5" />} title="Security infrastructure">
              PCI-DSS Level 1 certified card processing, 256-bit TLS everywhere, HMAC-SHA256 signed webhooks,
              encrypted key vaults and biometric gates on sensitive actions.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="99.99% core uptime">
              Redundant infrastructure across regions with real-time status monitoring, automatic failover
              and idempotent payment processing that never double-charges.
            </FeatureCard>
          </div>
        </div>
      </section>

      <CtaBand
        title="Move money with a partner you can verify."
        sub="Open an account today — or talk to our team about enterprise volumes."
      />
    </MarketingShell>
  );
}
