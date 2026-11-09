import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Building2, CardSim, Check, Fingerprint, Globe2, Landmark,
  Nfc, ReceiptText, ShieldCheck, Smartphone, UserRound, Users, Zap,
} from "lucide-react";
import { useState } from "react";
import { MarketingShell } from "@/components/marketing/shell";
import {
  CheckoutWidget, CodeTabs, Converter, CtaBand, Faq, FeatureCard,
  RateTicker, SectionHead, VirtualCard,
} from "@/components/marketing/widgets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Slikcash — Global Banking & Payments for Africa and Beyond" },
      { name: "description", content: "Instant NUBAN accounts with 0.8-second NIP settlement, virtual USD Mastercards, SoftPOS tap-to-pay and a universal multi-currency payment gateway." },
      { property: "og:title", content: "Slikcash — Global Banking & Payments for Africa and Beyond" },
      { property: "og:description", content: "Multi-currency wallets, instant NUBAN accounts, virtual USD cards and a universal payment gateway for businesses and individuals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const TRUST = ["Licensed partner banks", "NDIC-insured deposits", "CBN-licensed rails", "PCI-DSS Level 1 certified"];

const AUDIENCE = {
  individuals: [
    { icon: <Zap className="h-5 w-5" />, title: "Zero-fee @SlikTag transfers", text: "Send and receive money instantly with a memorable @SlikTag — no account numbers, no fees between Slikcash users." },
    { icon: <CardSim className="h-5 w-5" />, title: "Virtual USD cards", text: "Pay for AWS, OpenAI, GitHub, ads and travel with high-limit virtual dollar cards protected by 3D Secure OTP." },
    { icon: <ReceiptText className="h-5 w-5" />, title: "Bills, airtime & savings", text: "Buy airtime and data, pay electricity and TV bills, and grow your money in automated Ajo savings vaults." },
  ],
  businesses: [
    { icon: <Globe2 className="h-5 w-5" />, title: "Universal payment gateway", text: "Accept cards, bank transfers, Apple Pay, Google Pay and USSD in multiple currencies with instant T+0 NGN settlement." },
    { icon: <Users className="h-5 w-5" />, title: "Payroll, bulk payouts & mandates", text: "Run bulk salary payouts, direct debit mandates and cashier shifts with maker-checker approvals built in." },
    { icon: <Landmark className="h-5 w-5" />, title: "Cross-border corridors", text: "Pay suppliers and remote teams across the US, UK, Eurozone, Ghana, Kenya and South Africa at transparent 0.5% fees." },
  ],
} as const;

const FAQ = [
  { q: "Is Slikcash a bank?", a: "No. Slikcash is a financial service provider — every account, card and payment is delivered through licensed partner banks, with deposits held at NDIC-insured institutions and transfers moving over CBN-licensed rails." },
  { q: "How fast are transfers really?", a: "NIP transfers settle in an average of 0.8 seconds, and your recipient's bank confirms the credit instantly. Cross-border payouts deliver on confirmed corridors with live status tracking." },
  { q: "What does it cost to accept payments?", a: "Local card acquiring is 1.4%, cross-border card checkout is 3.5%, and NIP transfers cost 1% capped at ₦80. Virtual card creation is free. See the full breakdown on our pricing page." },
  { q: "Can developers test without going live?", a: "Yes. Every business account gets automatic sandbox API keys with a full test environment, HMAC-SHA256 signed webhooks and SDKs for Node, Python, PHP and Flutter." },
  { q: "Which currencies can I hold?", a: "NGN, USD, GBP, EUR, GHS, KES, ZAR plus USDT and USDC — all in one wallet, with swaps and payouts on supported corridors." },
];

function Landing() {
  const [audience, setAudience] = useState<keyof typeof AUDIENCE>("individuals");
  return (
    <MarketingShell active="/">
      {/* Hero */}
      <section className="mkt-hero">
        <div className="mkt-container mkt-hero-grid">
          <div>
            <span className="mkt-kicker"><span className="mkt-live-dot" /> Live on CBN-licensed rails</span>
            <h1>
              Next-generation <span className="mkt-grad-text">global banking &amp; payments</span> for Africa and beyond.
            </h1>
            <p className="mkt-hero-sub">
              Instant NUBAN accounts with 0.8-second NIP settlement, virtual USD Mastercards, SoftPOS
              contactless tap-to-pay, and a universal multi-currency payment gateway — all in one platform.
            </p>
            <div className="mkt-hero-actions">
              <Link to="/auth" className="mkt-btn-primary">Start with Slikcash Personal <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/auth" className="mkt-btn-ghost">Explore Business Console</Link>
            </div>
            <ul className="mkt-trust">
              {TRUST.map((t) => <li key={t}><ShieldCheck className="h-3.5 w-3.5" /> {t}</li>)}
            </ul>
          </div>
          <div className="mkt-hero-visual">
            <VirtualCard />
            <CheckoutWidget />
          </div>
        </div>
      </section>

      <RateTicker />

      {/* Converter */}
      <section className="mkt-section" id="converter">
        <div className="mkt-container">
          <SectionHead
            kicker="Live FX & fees"
            title="Convert and send across ten currencies — with zero hidden fees"
            sub="Switch between NGN, USD, GBP, EUR, CAD, AUD, KES, GHS, ZAR and USDT. What you see is what your recipient gets, delivered in 0.8 seconds on local rails."
          />
          <Converter />
        </div>
      </section>

      {/* Gateway */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Payment gateway"
            title="One checkout for every way your customers pay"
            sub="Cards, bank transfers, Apple Pay, Google Pay and USSD — with zero redirect drop-off, instant T+0 NGN settlement and T+1 foreign settlement behind a rolling-reserve chargeback shield."
          />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Globe2 className="h-5 w-5" />} title="Multi-currency checkout">
              Accept NGN, USD, GBP, EUR, GHS, KES and ZAR from a single integration, with automatic conversion at transparent rates.
            </FeatureCard>
            <FeatureCard icon={<Zap className="h-5 w-5" />} title="Instant T+0 settlement">
              NGN sales land in your Slikcash NUBAN the moment the customer pays. Foreign currencies settle T+1 with full reconciliation.
            </FeatureCard>
            <FeatureCard icon={<ReceiptText className="h-5 w-5" />} title="Invoicing & payment links">
              Send branded invoices and hosted payment links from the console — no code required, every naira tracked.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Virtual cards"
            title="Instant virtual USD &amp; Naira cards that work everywhere"
            sub="High-limit virtual Mastercards for software subscriptions, digital advertising and global travel — issued in seconds, frozen in one tap, protected by 3D Secure OTP."
          />
          <div className="mkt-grid-3">
            <FeatureCard icon={<CardSim className="h-5 w-5" />} title="Built for subscriptions">
              Pay AWS, OpenAI, GitHub, Vercel and your entire SaaS stack without card declines or FX surprises.
            </FeatureCard>
            <FeatureCard icon={<Fingerprint className="h-5 w-5" />} title="3D Secure & controls">
              Every online payment is confirmed with an OTP. Freeze, unfreeze, set limits and reveal details only after PIN verification.
            </FeatureCard>
            <FeatureCard icon={<Check className="h-5 w-5" />} title="Zero creation fees">
              Create unlimited virtual USD and NGN cards at no cost — you only ever pay the transaction fee on spend.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* SoftPOS */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="SoftPOS & SmartTag"
            title="Turn any NFC phone into a contactless POS terminal"
            sub="Accept EMVCo L2 tap-to-pay cards and wallets directly on your Android phone — no expensive hardware, no queues, no downtime."
          />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Nfc className="h-5 w-5" />} title="Tap-to-pay on your phone">
              Your smartphone becomes a certified contactless terminal. Customers tap their card or phone and get an instant receipt.
            </FeatureCard>
            <FeatureCard icon={<Smartphone className="h-5 w-5" />} title="SmartTag QR stands">
              Print chargeable SmartTags for counters and tables — customers scan, pay and you hear it land on your Soundbox.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Fraud monitoring built in">
              Real-time screening watches every tap and scan, with biometric gates for sensitive actions.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* Audience tabs */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="One platform, two worlds" title="Built for individuals and businesses alike" />
          <div className="mkt-tabs" role="tablist" aria-label="Audience">
            <button role="tab" aria-selected={audience === "individuals"} data-active={audience === "individuals" || undefined} onClick={() => setAudience("individuals")}>
              <UserRound className="mr-1 inline h-4 w-4" /> For Individuals
            </button>
            <button role="tab" aria-selected={audience === "businesses"} data-active={audience === "businesses" || undefined} onClick={() => setAudience("businesses")}>
              <Building2 className="mr-1 inline h-4 w-4" /> For Businesses
            </button>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1.5rem" }}>
            {AUDIENCE[audience].map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title}>{f.text}</FeatureCard>
            ))}
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="mkt-section" id="developers-preview">
        <div className="mkt-container">
          <SectionHead
            kicker="For CTOs & engineers"
            title="A developer experience your team will love"
            sub="Charge customers, verify webhooks with HMAC-SHA256 signatures and test everything in a full sandbox — with SDKs for Node, Python, PHP and Flutter."
          />
          <CodeTabs />
        </div>
      </section>

      {/* Security */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Enterprise security"
            title="Dual-control governance on every naira"
            sub="Maker-checker transaction approvals, biometric gates and real-time fraud monitoring keep your money exactly where you left it."
          />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Users className="h-5 w-5" />} title="Maker-checker approvals">
              Large or sensitive payments wait for a second approver from your team before a single kobo moves.
            </FeatureCard>
            <FeatureCard icon={<Fingerprint className="h-5 w-5" />} title="Biometric & PIN gates">
              Card reveals, payouts and key actions are gated behind authenticator codes, email OTP and transaction PINs.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Real-time fraud monitoring">
              Every transaction is screened live, with full audit trails your finance and compliance teams can export.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* Stats + testimonials */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-grid-3">
            <div className="mkt-card mkt-stat"><strong className="mkt-grad-text">₦50B+</strong><span>Annualized volume</span></div>
            <div className="mkt-card mkt-stat"><strong className="mkt-grad-text">99.99%</strong><span>Core uptime</span></div>
            <div className="mkt-card mkt-stat"><strong className="mkt-grad-text">0.8s</strong><span>Average NIP velocity</span></div>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1rem" }}>
            <div className="mkt-card mkt-quote">
              <p>"Slikcash settled our NGN sales instantly and cut our checkout abandonment dramatically. The gateway simply doesn't drop payments."</p>
              <footer><span className="mkt-avatar">TG</span><span><strong>Travsify Global</strong>Travel & bookings platform</span></footer>
            </div>
            <div className="mkt-card mkt-quote">
              <p>"We run payroll and supplier payouts across six countries from one console. The maker-checker flow passed our audit on the first review."</p>
              <footer><span className="mkt-avatar">AT</span><span><strong>Acme Technologies Ltd</strong>Enterprise software</span></footer>
            </div>
            <div className="mkt-card mkt-quote">
              <p>"The virtual USD cards ended our subscription-declines nightmare. AWS, ads, tooling — everything just goes through now."</p>
              <footer><span className="mkt-avatar">KM</span><span><strong>Kudi Markets</strong>E-commerce group</span></footer>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section">
        <div className="mkt-container" style={{ maxWidth: "52rem" }}>
          <SectionHead kicker="Questions" title="Frequently asked questions" />
          <Faq items={FAQ} />
        </div>
      </section>

      <CtaBand
        title="Join over 250,000 forward-thinking businesses and individuals moving money at the speed of light."
        sub="Open a personal wallet in minutes, or take your business global with the Slikcash console."
      />
    </MarketingShell>
  );
}
