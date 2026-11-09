import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CardSim, Coins, Plane, ReceiptText, Send, Wallet } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { BillsVisual, Converter, CtaBand, FeatureCard, FlightVisual, SectionHead, ShowcaseRow, StepsRow, VirtualCard } from "@/components/marketing/widgets";
import personalImg from "@/assets/marketing/mkt-personal.jpg";
import remittanceImg from "@/assets/marketing/mkt-remittance.jpg";
import billsImg from "@/assets/marketing/mkt-bills.jpg";
import flightsImg from "@/assets/marketing/mkt-flights.jpg";

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "Personal Wallet — Slikcash" },
      { name: "description", content: "Zero-fee @SlikTag transfers, virtual dollar cards, instant bills and airtime, and automated savings vaults — everyday banking at the speed of light." },
      { property: "og:title", content: "Personal Wallet — Slikcash" },
      { property: "og:description", content: "Zero-fee P2P with @SlikTag, virtual USD cards, bills and automated savings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PersonalPage,
});

function PersonalPage() {
  return (
    <MarketingShell active="/personal">
      <section className="mkt-pagehero">
        <div className="mkt-container mkt-hero-grid">
          <div>
            <span className="mkt-kicker">For individuals</span>
            <h1>Your money, <span className="mkt-grad-text">everywhere you are</span></h1>
            <p>
              Zero-fee peer-to-peer transfers with your @SlikTag, virtual dollar cards for global shopping,
              instant utility and airtime payments, and automated savings vaults that grow while you sleep.
            </p>
            <div className="mkt-hero-actions">
              <a href="/auth" className="mkt-btn-primary">Start with Slikcash Personal <ArrowRight className="h-4 w-4" /></a>
              <a href="/pricing" className="mkt-btn-ghost">See pricing</a>
            </div>
          </div>
          <div className="mkt-hero-visual">
            <figure className="mkt-media mkt-hero-media">
              <img src={personalImg} alt="A phone wallet with coins, a piggy bank and growing savings" width={1024} height={1024} />
            </figure>
            <VirtualCard />
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Everyday money"
            title="Everything your bank app should have been"
          />
          <div className="mkt-grid-3">
            <FeatureCard icon={<Send className="h-5 w-5" />} title="Zero-fee @SlikTag transfers">
              Send money to friends with a memorable @SlikTag — instant, free between Slikcash users, and 0.8 seconds to any Nigerian bank.
            </FeatureCard>
            <FeatureCard icon={<CardSim className="h-5 w-5" />} title="Virtual dollar cards">
              Create a USD Mastercard in seconds for subscriptions, ads and travel — with 3D Secure OTP and one-tap freeze.
            </FeatureCard>
            <FeatureCard icon={<ReceiptText className="h-5 w-5" />} title="Bills, airtime & data">
              Top up any network, pay electricity, TV, internet and betting wallets, and buy exam pins — all with instant receipts.
            </FeatureCard>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1rem" }}>
            <FeatureCard icon={<Coins className="h-5 w-5" />} title="Automated savings vaults">
              Lock money in Ajo vaults with daily returns, set targets, and let your savings build themselves.
            </FeatureCard>
            <FeatureCard icon={<Wallet className="h-5 w-5" />} title="Multi-currency wallet">
              Hold NGN, USD, GBP, EUR, GHS, KES, ZAR, USDT and USDC side by side, with swaps on supported pairs.
            </FeatureCard>
            <FeatureCard icon={<Plane className="h-5 w-5" />} title="Flights & travel">
              Search and book flights across 450+ airlines with instant PNRs, paid straight from your wallet.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* Remittance showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            kicker="Cross-border & remittance"
            title={<>Send money home — and everywhere else</>}
            sub="Move money across eleven countries in ten currencies. The rate you see is what your recipient gets, with live tracking until it lands."
            bullets={[
              "Flat 0.5% cross-border fee — no hidden FX markup",
              "US, UK, Eurozone, Ghana, Kenya, South Africa and more",
              "Hold and swap USD, GBP, EUR, GHS, KES, ZAR, USDT and USDC",
            ]}
            cta={{ label: "See corridors & fees", to: "/pricing" }}
            visual={<Converter />}
            image={{ src: remittanceImg, alt: "A globe with glowing money-transfer routes and currency coins" }}
          />
        </div>
      </section>

      {/* Bills showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            flip
            kicker="Bills & utilities"
            title={<>Every bill, paid before the lights blink</>}
            sub="Airtime, data, electricity, cable TV, internet, betting wallets, exam pins and federal tax — verified customers, instant value, shareable receipts."
            bullets={[
              "Network auto-detection shows the right data plans for any number",
              "Meter and smartcard lookups confirm the real customer first",
              "Receipts with references you can share or download",
            ]}
            cta={{ label: "See pricing", to: "/pricing" }}
            visual={<BillsVisual />}
            image={{ src: billsImg, alt: "Bill payments: phone, lightbulb, television and wifi symbols" }}
          />
        </div>
      </section>

      {/* Flights showcase */}
      <section className="mkt-section">
        <div className="mkt-container">
          <ShowcaseRow
            kicker="Flights & travel"
            title={<>Search any airport on earth, book in minutes</>}
            sub="Real fares across 450+ airlines worldwide. Type a city or IATA code, pick a fare, pay from your wallet — your PNR and e-ticket arrive instantly."
            bullets={[
              "Global airport search — no fixed route list",
              "Fares revalidated before payment, never a bait price",
              "Pay in any wallet currency with transparent conversion",
            ]}
            cta={{ label: "Start with Slikcash Personal", to: "/auth" }}
            visual={<FlightVisual />}
            image={{ src: flightsImg, alt: "An airplane taking off over a globe with a boarding pass and phone" }}
          />
        </div>
      </section>

      {/* Steps */}
      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Getting started" title="Your wallet is minutes away" />
          <StepsRow steps={[
            { title: "Sign up", text: "Create your account with your email and phone number — no paperwork, no branch visits." },
            { title: "Verify once", text: "A quick KYC check unlocks your NUBAN, @SlikTag, wallets and virtual cards." },
            { title: "Move money your way", text: "Send, spend, save, pay bills and book flights — all from one balance view." },
          ]} />
        </div>
      </section>

      <CtaBand
        title="Open your Slikcash wallet in minutes."
        sub="Sign up, verify once, and get your NUBAN, @SlikTag and virtual cards immediately."
      />
    </MarketingShell>
  );
}
