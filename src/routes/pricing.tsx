import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { Converter, CtaBand, SectionHead } from "@/components/marketing/widgets";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & FX Corridors — Slikcash" },
      { name: "description", content: "Transparent fees: NIP transfers at 1% capped at ₦80, card acquiring at 1.4%, cross-border checkout at 3.5% and free virtual card creation." },
      { property: "og:title", content: "Pricing & FX Corridors — Slikcash" },
      { property: "og:description", content: "Transparent fees and live FX corridors for every Slikcash product." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const ROWS: { product: string; fee: string; note: string }[][] = [
  [
    { product: "NIP bank transfers", fee: "1% · capped at ₦80", note: "Flat percentage with a hard cap — a ₦1,000,000 transfer still costs ₦80." },
    { product: "NUBAN account issuance", fee: "Free", note: "Dedicated account numbers for every verified user and business." },
    { product: "@SlikTag P2P", fee: "0%", note: "Free between Slikcash users, always." },
  ],
  [
    { product: "Local card acquiring", fee: "1.4%", note: "NGN cards, Apple Pay, Google Pay and USSD collections." },
    { product: "Cross-border card checkout", fee: "3.5%", note: "International cards settled T+1 with a rolling-reserve chargeback shield." },
    { product: "Virtual card creation", fee: "0%", note: "Unlimited USD and NGN virtual Mastercards at no creation cost." },
  ],
  [
    { product: "Cross-border payouts (NGN-funded)", fee: "0.5% · min ₦5,000", note: "US, UK, Eurozone, Ghana, Kenya and South Africa corridors." },
    { product: "Cross-border payouts (foreign wallet)", fee: "0.5% · min 5, max 25 units", note: "Fund from a matching USD, GBP, EUR, GHS, KES or ZAR wallet." },
    { product: "Crypto swaps (USDT/USDC → NGN)", fee: "Live rate + provider spread", note: "Quoted upfront before you confirm — no hidden conversion fees." },
  ],
];

const TABLE_TITLES = ["Transfers & accounts", "Accepting payments", "Global & crypto"];

function PricingPage() {
  return (
    <MarketingShell active="/pricing">
      <section className="mkt-pagehero">
        <div className="mkt-container">
          <span className="mkt-kicker">Pricing</span>
          <h1>Transparent fees, <span className="mkt-grad-text">no surprises</span></h1>
          <p>
            Every fee is shown before you confirm a payment. No setup costs, no monthly minimums,
            no hidden FX markups on quoted conversions.
          </p>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container" style={{ display: "grid", gap: "2rem" }}>
          {ROWS.map((rows, i) => (
            <div key={TABLE_TITLES[i]}>
              <SectionHead kicker={TABLE_TITLES[i]} title="" />
              <div className="mkt-table-wrap">
                <table className="mkt-table">
                  <thead>
                    <tr><th>Product</th><th>Fee</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.product}>
                        <td>{r.product}</td>
                        <td className="mkt-price">{r.fee}</td>
                        <td className="mkt-note">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container">
          <SectionHead
            kicker="FX corridors"
            title="Live conversion across ten currencies"
            sub="Indicative interbank rates — your exact quote is locked on screen before you confirm any conversion or payout."
          />
          <Converter />
        </div>
      </section>

      <CtaBand
        title="Start moving money at honest prices."
        sub="Open an account and see your exact fee on every transaction before you confirm."
      />
    </MarketingShell>
  );
}
