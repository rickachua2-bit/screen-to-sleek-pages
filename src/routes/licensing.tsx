import { createFileRoute } from "@tanstack/react-router";
import { Building2, FileCheck2, Landmark, Scale, ScanFace, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { MarketingShell } from "@/components/marketing/shell";
import { CtaBand, FeatureCard, PageHero, SectionHead } from "@/components/marketing/widgets";
import accountsImg from "@/assets/marketing/mkt-accounts.png";
import { CompanyDetails } from "@/components/marketing/company";

export const Route = createFileRoute("/licensing")({
  head: () => ({
    meta: [
      { title: "Regulatory & Licensing — Slikcash" },
      { name: "description", content: "Slikcash is a financial service provider, not a bank. Learn how your money is held with licensed, NDIC-insured partner banks and moved over CBN-licensed rails." },
      { property: "og:title", content: "Regulatory & Licensing — Slikcash" },
      { property: "og:description", content: "How Slikcash delivers banking services through licensed, regulated partners." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://slikcash.com/licensing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://slikcash.com/licensing" }],
  }),
  component: LicensingPage,
});

const MODEL = [
  { icon: <Building2 className="h-5 w-5" />, title: "A financial service provider, not a bank", text: "Slikcash is a product of SLIK REMIT LTD. Every regulated service — accounts, deposits, cards, settlement — is delivered by licensed partner banks and financial institutions." },
  { icon: <Landmark className="h-5 w-5" />, title: "NDIC-insured partner banks", text: "Customer deposits are held with licensed commercial bank partners whose deposits carry Nigeria Deposit Insurance Corporation (NDIC) protection, in segregated accounts." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "CBN-licensed clearing rails", text: "Naira transfers and collections move over Central Bank of Nigeria licensed switching and clearing infrastructure operated by our partners." },
  { icon: <FileCheck2 className="h-5 w-5" />, title: "Licensed card issuing", text: "Virtual and physical cards are issued by licensed partner banks under Mastercard International licences, processed on PCI-DSS Level 1 certified infrastructure." },
];

const COMPLIANCE = [
  { icon: <ScanFace className="h-5 w-5" />, title: "KYC & KYB verification", text: "Every customer is identity-verified; every business passes registry, director and beneficial-owner checks before live operations." },
  { icon: <Scale className="h-5 w-5" />, title: "AML/CFT programme", text: "Risk-based anti-money-laundering and counter-terrorism-financing controls, sanctions screening and ongoing transaction monitoring." },
  { icon: <FileCheck2 className="h-5 w-5" />, title: "Data protection", text: "Personal data is processed in line with the Nigeria Data Protection Act, with clear rights and a published privacy policy." },
];

function LicensingPage() {
  return (
    <MarketingShell active="/licensing">
      <PageHero
        kicker="Regulatory & Licensing"
        title={<>Regulated where it matters, <span className="mkt-grad-text">transparent by design</span></>}
        sub="Slikcash is not a bank — and we say so proudly. Your money is held and moved by licensed, regulated partners, and this page explains exactly how that works."
        image={accountsImg}
        imageAlt="Multi-currency bank account cards"
      />

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Our model" title="Who holds and moves your money" sub="A clear chain of licensed responsibility stands behind every balance, transfer and card." />
          <div className="mkt-grid-2">
            {MODEL.map((m, i) => (
              <div key={m.title} className="mkt-reveal" style={{ "--mkt-d": `${i * 70}ms` } as CSSProperties}>
                <FeatureCard icon={m.icon} title={m.title}>{m.text}</FeatureCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Compliance framework" title="Controls that run on every account" />
          <div className="mkt-grid-3">
            {COMPLIANCE.map((m, i) => (
              <div key={m.title} className="mkt-reveal" style={{ "--mkt-d": `${i * 70}ms` } as CSSProperties}>
                <FeatureCard icon={m.icon} title={m.title}>{m.text}</FeatureCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Complaints & escalation" title="If something goes wrong" sub="A clear, three-step path — and you can escalate past us at any point." />
          <div className="mkt-card mkt-reveal" style={{ padding: "clamp(1.25rem, 3vw, 2rem)" }}>
            <ol className="mkt-legal-list">
              <li><strong>Contact support</strong> — email <a href="mailto:support@slikcash.com" style={{ color: "var(--mkt-cobalt)", fontWeight: 700 }}>support@slikcash.com</a> or use the contact page. We acknowledge every complaint and aim to resolve within a few business days.</li>
              <li><strong>Escalate to our compliance team</strong> — if you are not satisfied, ask for your complaint to be escalated; a senior compliance officer reviews it independently.</li>
              <li><strong>Approach the regulator</strong> — you may also escalate to the Central Bank of Nigeria's Consumer Protection Department or the relevant regulator in your market at any time.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-reveal">
            <SectionHead kicker="Legal entity" title="SLIK REMIT LTD" />
            <CompanyDetails />
            <p style={{ color: "var(--mkt-muted)", lineHeight: 1.7, maxWidth: "44rem" }}>
              Slikcash is a financial technology company, not a bank. Banking services, dedicated virtual accounts and
              interbank settlement are provided by licensed partner banks and regulated financial institutions in each
              market we serve. Funds held in user accounts are protected under the respective partner banks' deposit
              insurance schemes. Questions about our regulatory status: <a href="mailto:info@slikcash.com" style={{ color: "var(--mkt-cobalt)", fontWeight: 700 }}>info@slikcash.com</a>.
            </p>
          </div>
        </div>
      </section>

      <CtaBand title="Bank on regulated rails" sub="Open a free Slikcash account — transparency included by default." />
    </MarketingShell>
  );
}
