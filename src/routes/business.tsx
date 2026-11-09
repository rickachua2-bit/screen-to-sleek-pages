import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, CalendarClock, FileText, Globe2, Link2, ReceiptText, ShieldCheck, Store, Users } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, SectionHead } from "@/components/marketing/widgets";

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

function BusinessPage() {
  return (
    <MarketingShell active="/business">
      <section className="mkt-pagehero">
        <div className="mkt-container">
          <span className="mkt-kicker">For businesses</span>
          <h1>The console your <span className="mkt-grad-text">finance team</span> has been waiting for</h1>
          <p>
            Merchant settlements, bulk payroll payouts, automated tax statements, cashier shifts and direct
            debit mandates — with maker-checker approvals and a full audit trail on every transaction.
          </p>
          <div className="mkt-hero-actions">
            <a href="/auth" className="mkt-btn-primary">Open a Business Account <ArrowRight className="h-4 w-4" /></a>
            <a href="/pricing" className="mkt-btn-ghost">See pricing</a>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Collections"
            title="Get paid anywhere, settle instantly"
            sub="Every collection lands in your dedicated NUBAN and is captured automatically — even transfers sent straight to your account number."
          />
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

      <CtaBand
        title="Take your business global with Slikcash."
        sub="Open a business account, verify your company and get sandbox API keys instantly — live keys follow KYB approval."
      />
    </MarketingShell>
  );
}
