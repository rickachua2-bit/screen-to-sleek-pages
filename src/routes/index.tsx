import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Braces, Building2, CardSim, Fingerprint, Globe2, Landmark,
  Nfc, ReceiptText, ShieldCheck, Smartphone, UserRound, Users, Zap,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { DOCS_URL, MarketingShell } from "@/components/marketing/shell";
import {
  AccountVisual, ApiProductGrid, BillsVisual, CheckoutWidget, CodeTabs, Converter, CountUp,
  CtaBand, Faq, FeatureCard, FlightVisual, MediaBanner, ProductSuite, RateTicker, SectionHead,
  ShowcaseRow, StepsRow, VirtualCard,
} from "@/components/marketing/widgets";
import heroImg from "@/assets/marketing/mkt-hero.png";
import gatewayImg from "@/assets/marketing/mkt-gateway.png";
import accountsImg from "@/assets/marketing/mkt-accounts.png";
import remittanceImg from "@/assets/marketing/mkt-remittance.png";
import cardsImg from "@/assets/marketing/mkt-cards.png";
import billsImg from "@/assets/marketing/mkt-bills.png";
import flightsImg from "@/assets/marketing/mkt-flights.png";
import softposImg from "@/assets/marketing/mkt-softpos.png";
import securityImg from "@/assets/marketing/mkt-security.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Slikcash — Global Banking & Payments for Africa and Beyond" },
      { name: "description", content: "Payment gateway, virtual bank accounts, card issuance, cross-border remittance, bills, flight booking and developer APIs — all in one platform." },
      { property: "og:title", content: "Slikcash — Global Banking & Payments for Africa and Beyond" },
      { property: "og:description", content: "Multi-currency wallets, instant NUBAN accounts, virtual USD cards, remittance, flights and a universal payment gateway for businesses and individuals." },
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
  { q: "What does it cost to accept payments?", a: "Local card acquiring is 1.4%, cross-border card checkout is 3.5%, and NIP transfers cost a low flat fee. Virtual card creation is free. See the live figures on our pricing page." },
  { q: "Can developers test without going live?", a: "Yes. Every business account gets automatic sandbox API keys with a full test environment, HMAC-SHA256 signed webhooks and SDKs for Node, Python, PHP and Flutter — and every product on this page is available as an API." },
  { q: "Which currencies can I hold?", a: "NGN, USD, GBP, EUR, GHS, KES, ZAR plus USDT and USDC — all in one wallet, with swaps and payouts on supported corridors." },
];

const STEPS = [
  { title: "Create your account", text: "Sign up in minutes with your email and phone — no paperwork, no queues, no branch visits." },
  { title: "Verify once", text: "Individuals complete a quick KYC; businesses complete KYB and get sandbox API keys instantly, with live keys on approval." },
  { title: "Get everything at once", text: "Your NUBAN, @SlikTag, multi-currency wallets and virtual cards are issued immediately — start collecting, spending and building." },
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
              contactless tap-to-pay, cross-border remittance and a universal payment gateway — all in one platform.
            </p>
            <div className="mkt-hero-actions">
              <a href={APP_SIGNIN} className="mkt-btn-primary">Start with Slikcash Personal <ArrowRight className="h-4 w-4" /></a>
              <a href={APP_SIGNIN} className="mkt-btn-ghost">Explore Business Console</a>
            </div>
            <ul className="mkt-trust">
              {TRUST.map((t) => <li key={t}><ShieldCheck className="h-3.5 w-3.5" /> {t}</li>)}
            </ul>
          </div>
          <div className="mkt-hero-visual">
            <span className="mkt-hero-chip" data-pos="a"><Zap className="h-3.5 w-3.5" /> 0.8s NIP settlement</span>
            <span className="mkt-hero-chip" data-pos="b"><Globe2 className="h-3.5 w-3.5" /> 11 payout countries</span>
            <span className="mkt-hero-chip" data-pos="c"><ShieldCheck className="h-3.5 w-3.5" /> NDIC-insured partners</span>
            <figure className="mkt-media mkt-hero-media">
              <img src={heroImg} alt="Slikcash app with a virtual card, coins and the brand ribbon" width={1024} height={1024} />
            </figure>
            <VirtualCard />
          </div>
        </div>
      </section>

      <RateTicker />

      {/* Product suite */}
      <section className="mkt-section" id="products">
        <div className="mkt-container">
          <SectionHead
            kicker="The full stack"
            title="Everything we offer — from checkout to takeoff"
            sub="One platform for collections, accounts, cards, payouts, bills, travel and developer APIs. Every product is available in the console and over the API."
          />
          <ProductSuite />
        </div>
      </section>

      {/* Gateway showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            kicker="Payment gateway"
            title={<>One checkout for every way your customers pay</>}
            sub="Cards, bank transfers, Apple Pay, Google Pay and USSD — with zero redirect drop-off, instant T+0 NGN settlement and a rolling-reserve chargeback shield."
            bullets={[
              "Hosted checkout, payment links and branded invoices — no code required",
              "Instant T+0 settlement to your Slikcash NUBAN, T+1 for foreign currencies",
              "Multi-currency acceptance with automatic conversion at transparent rates",
            ]}
            cta={{ label: "Explore the Business Console", to: "/business" }}
            visual={<CheckoutWidget />}
            image={{ src: gatewayImg, alt: "Online checkout on a laptop and phone with a payment card and shield" }}
          />
        </div>
      </section>

      {/* Virtual accounts showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            flip
            kicker="Virtual bank accounts"
            title={<>Dedicated NUBANs and multi-currency accounts, issued in seconds</>}
            sub="Give every customer, branch or cashier their own account number. Inbound transfers are captured automatically — even payments sent straight to the account."
            bullets={[
              "Instant NUBAN issuance in your personal or verified business name",
              "USD, GBP, EUR, GHS, KES and ZAR accounts side by side",
              "USDT & USDC vaults for verified users, with bank cash-out built in",
            ]}
            cta={{ label: "See accounts & wallets", to: "/personal" }}
            visual={<AccountVisual />}
            image={{ src: accountsImg, alt: "Virtual bank accounts with a bank building, wallet and currency coins" }}
          />
        </div>
      </section>

      {/* Remittance showcase */}
      <section className="mkt-section" id="converter">
        <div className="mkt-container">
          <ShowcaseRow
            kicker="Cross-border & remittance"
            title={<>Send money across eleven countries — with zero hidden fees</>}
            sub="Switch between NGN, USD, GBP, EUR, CAD, AUD, KES, GHS, ZAR and USDT. What you see is what your recipient gets, delivered on confirmed corridors with live tracking."
            bullets={[
              "Flat 0.5% cross-border fee — no hidden FX markup on quoted conversions",
              "Live status tracking with automatic recovery on uncertain outcomes",
              "Fund payouts from NGN or matching foreign-currency wallets",
            ]}
            cta={{ label: "See corridors & fees", to: "/pricing" }}
            visual={<Converter />}
            image={{ src: remittanceImg, alt: "A globe with glowing money-transfer routes and currency coins" }}
          />
        </div>
      </section>

      {/* Cards showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            flip
            kicker="Card issuance"
            title={<>Instant virtual USD &amp; Naira cards that work everywhere</>}
            sub="High-limit virtual Mastercards for software subscriptions, digital advertising and global travel — issued in seconds, frozen in one tap, protected by 3D Secure OTP."
            bullets={[
              "Pay AWS, OpenAI, GitHub, ads and airlines without declines",
              "Freeze, unfreeze, set limits and reveal details only after PIN verification",
              "Zero creation fees — you only ever pay the transaction fee on spend",
            ]}
            cta={{ label: "Get a virtual card", to: "/personal" }}
            visual={<VirtualCard />}
            image={{ src: cardsImg, alt: "Floating green and blue virtual payment cards with a security shield" }}
          />
        </div>
      </section>

      {/* Bills showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            kicker="Bills & utilities"
            title={<>Every bill in Nigeria, paid in one place</>}
            sub="Airtime, data, electricity, cable TV, internet, betting wallets, exam pins and federal tax — with customer verification, instant receipts and zero failed vend surprises."
            bullets={[
              "Network auto-detection for airtime and data on any Nigerian number",
              "Meter and smartcard lookups confirm the real customer before you pay",
              "Shareable receipts with references for every vend",
            ]}
            cta={{ label: "See everyday services", to: "/personal" }}
            visual={<BillsVisual />}
            image={{ src: billsImg, alt: "Bill payments: phone, lightbulb, television and wifi symbols" }}
          />
        </div>
      </section>

      {/* Flights showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            flip
            kicker="Flight booking"
            title={<>Book any airline on earth, straight from your wallet</>}
            sub="Search real fares across 450+ airlines worldwide, review the details, and pay from any wallet currency — your PNR and e-ticket arrive instantly."
            bullets={[
              "Global airport search by city name or IATA code — no fixed route list",
              "One-way or return, four cabin classes, up to nine travellers",
              "Fares revalidated before payment, so the price you see is the price you pay",
            ]}
            cta={{ label: "Book flights with Slikcash", to: "/personal" }}
            visual={<FlightVisual />}
            image={{ src: flightsImg, alt: "An airplane taking off over a globe with a boarding pass and phone" }}
          />
        </div>
      </section>

      {/* API band */}
      <section className="mkt-section mkt-apiband" id="developers-preview">
        <div className="mkt-container">
          <div className="mkt-apiband-grid">
            <div className="mkt-apiband-copy mkt-reveal">
              <span className="mkt-kicker"><Braces className="h-3.5 w-3.5" /> API services</span>
              <h2>Every product on this page is also an API</h2>
              <p>
                Other businesses build entire fintechs on Slikcash rails — payments, accounts, cards, transfers,
                remittance, bills and flights — with signed webhooks, SDKs and full documentation.
              </p>
              <ul className="mkt-apiband-chips">
                <li><ShieldCheck className="h-3.5 w-3.5" /> HMAC-signed webhooks</li>
                <li><Zap className="h-3.5 w-3.5" /> Sandbox keys on signup</li>
                <li><Braces className="h-3.5 w-3.5" /> Node · Python · PHP · Flutter</li>
                <li><Globe2 className="h-3.5 w-3.5" /> 99.99% core uptime</li>
              </ul>
              <div className="mkt-apiband-actions">
                <Link to="/developers" className="mkt-btn-primary">Explore the API <ArrowRight className="h-4 w-4" /></Link>
                <a href={DOCS_URL} target="_blank" rel="noreferrer" className="mkt-btn-ghost">Read the docs</a>
              </div>
            </div>
            <div className="mkt-reveal" style={{ "--mkt-d": "120ms" } as CSSProperties}>
              <CodeTabs />
            </div>
          </div>
          <ApiProductGrid />
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
          <MediaBanner src={softposImg} alt="A hand tapping a payment card on a smartphone POS beside a QR stand" />
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

      {/* Security */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Enterprise security"
            title="Dual-control governance on every naira"
            sub="Maker-checker transaction approvals, biometric gates and real-time fraud monitoring keep your money exactly where you left it."
          />
          <MediaBanner src={securityImg} alt="A security shield with a padlock and fingerprint symbol" />
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
            <div className="mkt-card mkt-stat mkt-reveal"><strong className="mkt-grad-text"><CountUp value={50} prefix="₦" suffix="B+" /></strong><span>Annualized volume</span></div>
            <div className="mkt-card mkt-stat mkt-reveal" style={{ "--mkt-d": "80ms" } as CSSProperties}><strong className="mkt-grad-text"><CountUp value={99.99} decimals={2} suffix="%" /></strong><span>Core uptime</span></div>
            <div className="mkt-card mkt-stat mkt-reveal" style={{ "--mkt-d": "160ms" } as CSSProperties}><strong className="mkt-grad-text"><CountUp value={0.8} decimals={1} suffix="s" /></strong><span>Average NIP velocity</span></div>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1rem" }}>
            <div className="mkt-card mkt-quote mkt-reveal">
              <p>"Slikcash settled our NGN sales instantly and cut our checkout abandonment dramatically. The gateway simply doesn't drop payments."</p>
              <footer><span className="mkt-avatar">TG</span><span><strong>Travsify Global</strong>Travel & bookings platform</span></footer>
            </div>
            <div className="mkt-card mkt-quote mkt-reveal" style={{ "--mkt-d": "80ms" } as CSSProperties}>
              <p>"We run payroll and supplier payouts across six countries from one console. The maker-checker flow passed our audit on the first review."</p>
              <footer><span className="mkt-avatar">AT</span><span><strong>Acme Technologies Ltd</strong>Enterprise software</span></footer>
            </div>
            <div className="mkt-card mkt-quote mkt-reveal" style={{ "--mkt-d": "160ms" } as CSSProperties}>
              <p>"The virtual USD cards ended our subscription-declines nightmare. AWS, ads, tooling — everything just goes through now."</p>
              <footer><span className="mkt-avatar">KM</span><span><strong>Kudi Markets</strong>E-commerce group</span></footer>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Getting started" title="Your account is minutes away" />
          <StepsRow steps={STEPS} />
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
