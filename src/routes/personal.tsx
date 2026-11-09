import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CardSim, Coins, Plane, ReceiptText, Send, Wallet } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, SectionHead, VirtualCard } from "@/components/marketing/widgets";

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

      <CtaBand
        title="Open your Slikcash wallet in minutes."
        sub="Sign up, verify once, and get your NUBAN, @SlikTag and virtual cards immediately."
      />
    </MarketingShell>
  );
}
