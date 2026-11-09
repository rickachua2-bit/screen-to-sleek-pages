import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { Converter, CtaBand, PageHero, SectionHead } from "@/components/marketing/widgets";
import { useLiveFxPricing } from "@/hooks/use-live-fx-rates";
import type { LiveFxPricing } from "@/lib/fx.functions";
import remittanceImg from "@/assets/marketing/mkt-remittance.png";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & FX Corridors — Slikcash" },
      { name: "description", content: "Transparent fees streamed live from the Slikcash pricing service: NIP transfers, card acquiring, virtual cards and cross-border FX." },
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
    { product: "NIP bank transfers", fee: "1% · capped at ₦80", note: "Flat percentage with a hard cap — a ₦1,000,000 transfer still costs ₦80.", liveKeys: ["nipdomestic"] },
    { product: "NUBAN account issuance", fee: "Free", note: "Dedicated account numbers for every verified user and business." },
    { product: "@SlikTag P2P", fee: "0%", note: "Free between Slikcash users, always.", liveKeys: ["sliktagp2p"] },
  ],
  [
    { product: "Local card acquiring", fee: "1.4%", note: "NGN cards, Apple Pay, Google Pay and USSD collections.", liveKeys: ["localcardacquiring"] },
    { product: "Cross-border card checkout", fee: "3.5%", note: "International cards settled T+1 with a rolling-reserve chargeback shield.", liveKeys: ["internationalcardacquiring"] },
    { product: "NIP direct bank transfer collections", fee: "₦50 flat", note: "Virtual-account dynamic checkout transfers.", liveKeys: ["nipdirectbanktransfer"] },
    { product: "Virtual card creation", fee: "0%", note: "Unlimited USD and NGN virtual Mastercards at no creation cost.", liveKeys: ["virtualcards"] },
  ],
  [
    { product: "Cross-border payouts (NGN-funded)", fee: "0.5% · min ₦5,000", note: "US, UK, Eurozone, Ghana, Kenya and South Africa corridors." },
    { product: "Cross-border payouts (foreign wallet)", fee: "0.5% · min 5, max 25 units", note: "Fund from a matching USD, GBP, EUR, GHS, KES or ZAR wallet." },
    { product: "Remittance FX spread", fee: "0.65% wholesale markup", note: "Institutional multi-provider routing with a guaranteed rate lock shown on every quote.", liveKeys: ["remittanceandfx"] },
    { product: "Crypto swaps (USDT/USDC → NGN)", fee: "Live rate + provider spread", note: "Quoted upfront before you confirm — no hidden conversion fees." },
  ],
];

const TABLE_TITLES = ["Transfers & accounts", "Accepting payments", "Global & crypto"];

/* ------------------------- live pricing integration ------------------------ */

type FeeObject = Record<string, unknown>;

/** Flattens the nested feeStructure tree into normalized-key → fee-object. */
function flattenPricing(root: LiveFxPricing | null): Record<string, FeeObject> {
  const out: Record<string, FeeObject> = {};
  const walk = (obj: FeeObject) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v as FeeObject;
        walk(v as FeeObject);
      }
    }
  };
  if (root) walk(root as FeeObject);
  return out;
}

function asNum(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

const fmtN = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);

/**
 * Builds a display string purely from values the pricing service returned.
 * Returns null when nothing usable exists so the published figure stays.
 */
function liveFee(flat: Record<string, FeeObject>, keys?: string[]): string | null {
  if (!keys?.length) return null;
  for (const key of keys) {
    const o = flat[key];
    if (!o) continue;
    const n: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) n[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;

    const issuanceUsd = asNum(n["issuancefeeusd"]);
    const monthlyUsd = asNum(n["monthlymaintenanceusd"]);
    const fundingPct = asNum(n["fundingfeepct"]);
    const spreadPct = asNum(n["spreadmarkuppct"]);
    const pct = asNum(n["percentage"] ?? n["percent"] ?? n["rate"]);
    const flatNgn = asNum(n["flatfeengn"] ?? n["flat"] ?? n["flatfee"] ?? n["fixed"]);
    const capNgn = asNum(n["capngn"] ?? n["cap"] ?? n["max"] ?? n["maximum"]);
    const minNgn = asNum(n["min"] ?? n["minimum"]);
    const bareFee = asNum(n["fee"]);

    const parts: string[] = [];
    if (issuanceUsd !== null) parts.push(`$${fmtN(issuanceUsd)} issuance`);
    if (monthlyUsd !== null) parts.push(`$${fmtN(monthlyUsd)} monthly`);
    if ((issuanceUsd !== null || monthlyUsd !== null) && fundingPct !== null && fundingPct > 0) {
      parts.push(`${fmtN(fundingPct)}% funding`);
    }
    if (spreadPct !== null) parts.push(`${fmtN(spreadPct)}% wholesale markup`);
    if (pct !== null && spreadPct === null && issuanceUsd === null && monthlyUsd === null) {
      parts.push(`${fmtN(pct)}%`);
    }
    if (flatNgn !== null) parts.push(`₦${fmtN(flatNgn)}${pct === null ? " flat" : ""}`);
    if (parts.length === 0 && bareFee !== null) parts.push(bareFee === 0 ? "0%" : `${fmtN(bareFee)}%`);
    if (capNgn !== null) parts.push(`capped at ₦${fmtN(capNgn)}`);
    if (minNgn !== null) parts.push(`min ₦${fmtN(minNgn)}`);
    if (parts.length > 0) return parts.join(" · ");
  }
  return null;
}

function PricingPage() {
  const { pricing, fetchedAt, unavailable } = useLiveFxPricing();
  const flat = flattenPricing(pricing);
  const anyLive = ROWS.flat().some((r) => liveFee(flat, r.liveKeys) !== null);

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
                      const live = liveFee(flat, r.liveKeys);
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
