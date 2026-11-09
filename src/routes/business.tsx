import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, Braces, Briefcase, CalendarClock, FileText, Globe2, Link2, ReceiptText, ShieldCheck, Store, Users } from "lucide-react";
import { useState } from "react";
import { DOCS_URL, MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, MediaBanner, PageHero, SectionHead, StepsRow } from "@/components/marketing/widgets";
import businessImg from "@/assets/marketing/mkt-business.jpg";
import gatewayImg from "@/assets/marketing/mkt-gateway.jpg";
import remittanceImg from "@/assets/marketing/mkt-remittance.jpg";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business Console — Slikcash" },
      { name: "description", content: "Merchant settlements, bulk payroll payouts, direct debit mandates, cashier shifts and cross-border corridors — one console for your whole finance team." },
      { property: "og:title", content: "Business Console — Slikcash" },
      { property: "og:description", content: "Settlements, bulk payouts, mandates and cross-border payments with maker-checker governance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});

const SEGMENTS = {
  corporates: [
    { icon: <Users className="h-5 w-5" />, title: "Multi-team governance", text: "Seven invitation roles, maker-checker approvals and audit trails your board and auditors can export." },
    { icon: <Globe2 className="h-5 w-5" />, title: "Global supplier payouts", text: "Pay suppliers and remote teams across 11 countries at a flat 0.5% with live tracking and automatic recovery." },
    { icon: <Braces className="h-5 w-5" />, title: "API-first operations", text: "Embed collections, payouts and account issuance into your own systems with sandbox keys issued on signup." },
  ],
  small: [
    { icon: <Store className="h-5 w-5" />, title: "Get paid in store & online", text: "SoftPOS tap-to-pay, SmartTag QR stands, payment links and invoices — every naira lands in your NUBAN instantly." },
    { icon: <ReceiptText className="h-5 w-5" />, title: "Cashier shifts & tills", text: "Open and close shifts with per-till collections, variance tracking and end-of-day reconciliation." },
    { icon: <CalendarClock className="h-5 w-5" />, title: "Recurring collections", text: "Direct debit mandates on weekly or monthly schedules keep subscriptions and dues flowing automatically." },
  ],
  freelancers: [
    { icon: <Link2 className="h-5 w-5" />, title: "Invoice like a company", text: "Send branded invoices and hosted payment links — clients pay by card or transfer and you settle instantly." },
    { icon: <ArrowLeftRight className="h-5 w-5" />, title: "Get paid from abroad", text: "Receive USD, GBP and EUR into your own foreign-currency accounts and convert at transparent rates." },
    { icon: <Briefcase className="h-5 w-5" />, title: "Separate work from life", text: "A dedicated business NUBAN, spending cards and exportable statements keep your finances clean at tax time." },
  ],
} as const;

const STEPS = [
  { title: "Open your business account", text: "Sign up with your business details and verify your contacts — it takes minutes, not weeks." },
  { title: "Complete KYB", text: "Registry lookup, director and beneficial-owner verification. Sandbox API keys are issued instantly; live keys follow approval." },
  { title: "Start collecting everywhere", text: "Your NUBAN, gateway, SoftPOS, payment links and API keys go live — with live support whenever you need it." },
];

function BusinessPage() {
  const [segment, setSegment] = useState<keyof typeof SEGMENTS>("corporates");
  return (
    <MarketingShell active="/business">
      <PageHero
        kicker="For businesses"
        title={<>The console your <span className="mkt-grad-text">finance team</span> has been waiting for</>}
        sub="Merchant settlements, bulk payroll payouts, automated tax statements, cashier shifts and direct debit mandates — with maker-checker approvals and a full audit trail on every transaction."
        image={businessImg}
        imageAlt="A business dashboard with charts, a briefcase, calculator and coins"
      >
        <div className="mkt-hero-actions">
          <a href="/auth" className="mkt-btn-primary">Open a Business Account <ArrowRight className="h-4 w-4" /></a>
          <a href="/pricing" className="mkt-btn-ghost">See pricing</a>
        </div>
      </PageHero>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Collections"
            title="Get paid anywhere, settle instantly"
            sub="Every collection lands in your dedicated NUBAN and is captured automatically — even transfers sent straight to your account number."
          />
          <MediaBanner src={gatewayImg} alt="Online checkout on a laptop and phone with a payment card and shield" />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Globe2 className="h-5 w-5" />} title="Universal gateway">
              Cards, bank transfer, Apple Pay, Google Pay and USSD in one checkout, with instant T+0 NGN settlement and T+1 foreign settlement.
            </FeatureCard>
            <FeatureCard icon={<Link2 className="h-5 w-5" />} title="Payment links & invoices">
              Create hosted checkout links and branded invoices in seconds, share them anywhere, and watch payments land in real time.
            </FeatureCard>
            <FeatureCard icon={<Store className="h-5 w-5" />} title="SoftPOS & SmartTag">
              Accept contactless tap-to-pay on any NFC phone and charge customers by QR with SmartTag stands and Soundbox alerts.
            </FeatureCard>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Payouts & operations"
            title="Move money out with total control"
            sub="From one-off supplier payments to thousand-row payroll files, every payout is reserved, approved and tracked."
          />
          <MediaBanner src={remittanceImg} alt="A globe with glowing money-transfer routes and currency coins" />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Users className="h-5 w-5" />} title="Bulk payroll payouts">
              Upload a payment file, validate every row, review the total and fees, then release the whole batch with one approval.
            </FeatureCard>
            <FeatureCard icon={<CalendarClock className="h-5 w-5" />} title="Direct debit mandates">
              Collect recurring payments on weekly or monthly schedules with customer-approved mandates and idempotent runs.
            </FeatureCard>
            <FeatureCard icon={<ArrowLeftRight className="h-5 w-5" />} title="Cross-border corridors">
              Pay the US, UK, Eurozone, Ghana, Kenya and South Africa at a flat 0.5% with live status tracking and automatic recovery.
            </FeatureCard>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1rem" }}>
            <FeatureCard icon={<FileText className="h-5 w-5" />} title="Automated tax statements">
              Export regulator-ready statements and full ledger history with running balances, filters and CSV downloads.
            </FeatureCard>
            <FeatureCard icon={<ReceiptText className="h-5 w-5" />} title="Cashier shifts">
              Open and close cashier shifts with per-till collections, variance tracking and end-of-day reconciliation.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Maker-checker governance">
              Seven invitation roles, transaction approvals and biometric gates keep sensitive actions under dual control.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* Segment tabs */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="For every stage" title="Building solutions for every type of business" />
          <div className="mkt-tabs" role="tablist" aria-label="Business type">
            <button role="tab" aria-selected={segment === "corporates"} data-active={segment === "corporates" || undefined} onClick={() => setSegment("corporates")}>For Corporates</button>
            <button role="tab" aria-selected={segment === "small"} data-active={segment === "small" || undefined} onClick={() => setSegment("small")}>For Small Businesses</button>
            <button role="tab" aria-selected={segment === "freelancers"} data-active={segment === "freelancers" || undefined} onClick={() => setSegment("freelancers")}>For Freelancers</button>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1.5rem" }}>
            {SEGMENTS[segment].map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title}>{f.text}</FeatureCard>
            ))}
          </div>
        </div>
      </section>

      {/* API teaser */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-card mkt-reveal" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "1.6rem" }}>
            <div style={{ maxWidth: "34rem" }}>
              <span className="mkt-kicker">Build on Slikcash</span>
              <h3 style={{ margin: ".7rem 0 .4rem", fontSize: "1.25rem" }}>Every console feature is also an API</h3>
              <p style={{ margin: 0, fontSize: ".9rem", color: "var(--mkt-muted)" }}>
                Payments, accounts, cards, transfers, remittance, bills and flights — with signed webhooks,
                SDKs for every stack and full documentation.
              </p>
            </div>
            <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
              <a href={DOCS_URL} target="_blank" rel="noreferrer" className="mkt-btn-primary mkt-btn-sm">Read the docs <ArrowRight className="h-4 w-4" /></a>
              <a href="/developers" className="mkt-btn-ghost mkt-btn-sm">API quickstart</a>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Getting started" title="Your business account is minutes away" />
          <StepsRow steps={STEPS} />
        </div>
      </section>

      <CtaBand
        title="Take your business global with Slikcash."
        sub="Open a business account, verify your company and get sandbox API keys instantly — live keys follow KYB approval."
      />
    </MarketingShell>
  );
}
