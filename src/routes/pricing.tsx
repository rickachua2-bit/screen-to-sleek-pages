import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { Converter, CtaBand, PageHero, SectionHead } from "@/components/marketing/widgets";
import { useLiveFxPricing } from "@/hooks/use-live-fx-rates";
import remittanceImg from "@/assets/marketing/mkt-remittance.png";

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

type PricingRow = { product: string; fee: string; note: string; liveKeys?: string[] };

const ROWS: PricingRow[][] = [
  [
    { product: "NIP bank transfers", fee: "1% · capped at ₦80", note: "Flat percentage with a hard cap — a ₦1,000,000 transfer still costs ₦80.", liveKeys: ["niptransfer", "outwardnip", "nip"] },
    { product: "NUBAN account issuance", fee: "Free", note: "Dedicated account numbers for every verified user and business.", liveKeys: ["nuban", "accountissuance"] },
    { product: "@SlikTag P2P", fee: "0%", note: "Free between Slikcash users, always.", liveKeys: ["sliktag", "p2p"] },
  ],
  [
    { product: "Local card acquiring", fee: "1.4%", note: "NGN cards, Apple Pay, Google Pay and USSD collections.", liveKeys: ["localcard", "cardacquiring", "acquiring"] },
    { product: "Cross-border card checkout", fee: "3.5%", note: "International cards settled T+1 with a rolling-reserve chargeback shield.", liveKeys: ["internationalcard", "crossbordercard"] },
    { product: "Virtual card creation", fee: "0%", note: "Unlimited USD and NGN virtual Mastercards at no creation cost.", liveKeys: ["virtualcard", "cardcreation", "cardissuance"] },
  ],
  [
    { product: "Cross-border payouts (NGN-funded)", fee: "0.5% · min ₦5,000", note: "US, UK, Eurozone, Ghana, Kenya and South Africa corridors.", liveKeys: ["crossborderpayout", "remittance", "payout"] },
    { product: "Cross-border payouts (foreign wallet)", fee: "0.5% · min 5, max 25 units", note: "Fund from a matching USD, GBP, EUR, GHS, KES or ZAR wallet.", liveKeys: ["foreignwallet", "walletpayout"] },
    { product: "Crypto swaps (USDT/USDC → NGN)", fee: "Live rate + provider spread", note: "Quoted upfront before you confirm — no hidden conversion fees.", liveKeys: ["cryptoswap", "swap", "fxspread"] },
  ],
];

const TABLE_TITLES = ["Transfers & accounts", "Accepting payments", "Global & crypto"];

/* ------------------------- live pricing integration ------------------------ */

function asNum(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Best-effort read of a live fee from the pricing service. Returns a display
 * string built only from values the service actually returned, or null so the
 * published figure stays in place.
 */
function liveFee(pricing: Record<string, unknown> | null, keys?: string[]): string | null {
  if (!pricing || !keys?.length) return null;
  const entries = Object.entries(pricing);
  for (const key of keys) {
    const hit = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(key));
    if (!hit) continue;
    const v = hit[1];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.display === "string" && o.display.trim()) return o.display.trim();
      if (typeof o.label === "string" && o.label.trim()) return o.label.trim();
      if (typeof o.fee === "string" && o.fee.trim()) return o.fee.trim();
      const pct = asNum(o.percent ?? o.percentage ?? o.rate);
      const flat = asNum(o.flat ?? o.flatFee ?? o.fixed ?? o.amount);
      const cap = asNum(o.cap ?? o.max ?? o.maximum);
      const min = asNum(o.min ?? o.minimum);
      const parts: string[] = [];
      if (pct !== null) parts.push(`${pct}%`);
      if (flat !== null) parts.push(`₦${new Intl.NumberFormat("en").format(flat)}`);
      let text = parts.join(" · ");
      if (cap !== null) text += `${text ? " · " : ""}capped at ₦${new Intl.NumberFormat("en").format(cap)}`;
      if (min !== null) text += `${text ? " · " : ""}min ₦${new Intl.NumberFormat("en").format(min)}`;
      if (text) return text;
    }
  }
  return null;
}

function PricingPage() {
  const { pricing, fetchedAt, unavailable } = useLiveFxPricing();
  const anyLive = ROWS.flat().some((r) => liveFee(pricing, r.liveKeys) !== null);

  return (
    <MarketingShell active="/pricing">
      <PageHero
        kicker="Pricing"
        title={<>Transparent fees, <span className="mkt-grad-text">no surprises</span></>}
        sub="Every fee is shown before you confirm a payment. No setup costs, no monthly minimums, no hidden FX markups on quoted conversions."
        image={remittanceImg}
        imageAlt="A globe with glowing money-transfer routes and currency coins"
      />

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container" style={{ display: "grid", gap: "2rem" }}>
          {ROWS.map((rows, i) => (
            <div key={TABLE_TITLES[i]}>
              <SectionHead kicker={TABLE_TITLES[i] ?? "Pricing"} />
              <div className="mkt-table-wrap">
                <table className="mkt-table">
                  <thead>
                    <tr><th>Product</th><th>Fee</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const live = liveFee(pricing, r.liveKeys);
                      return (
                        <tr key={r.product}>
                          <td>{r.product}</td>
                          <td className="mkt-price">
                            {live ?? r.fee}
                            {live ? <span className="mkt-live-chip">Live</span> : null}
                          </td>
                          <td className="mkt-note">{r.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {anyLive && fetchedAt ? (
            <p className="mkt-live-note">
              <span className="mkt-live-dot" /> Fees marked Live stream directly from the Slikcash pricing service — updated{" "}
              {new Date(fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
            </p>
          ) : unavailable ? (
            <p className="mkt-live-note">Live pricing service is unreachable right now — showing the standard published fees.</p>
          ) : null}
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container">
          <SectionHead
            kicker="FX corridors"
            title="Live conversion across ten currencies"
            sub="Real quotes from the Slikcash Treasury Vault — your exact rate, fee and guaranteed window appear before you confirm anything."
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
