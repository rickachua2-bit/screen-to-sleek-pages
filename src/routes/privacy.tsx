import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { LegalDoc, LegalHero, type LegalSection } from "@/components/marketing/legal";
import { CtaBand } from "@/components/marketing/widgets";
import { CompanyDetails } from "@/components/marketing/company";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Slikcash" },
      { name: "description", content: "How Slikcash collects, uses, shares and protects your personal data, and the rights you have over it." },
      { property: "og:title", content: "Privacy Policy — Slikcash" },
      { property: "og:description", content: "How Slikcash collects, uses and protects your personal data." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://slikcash.com/privacy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://slikcash.com/privacy" }],
  }),
  component: PrivacyPage,
});

const SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "Who we are",
    body: (
      <>
        <p><strong>SLIK REMIT LTD</strong> ("we", "us") operates Slikcash and is the data controller for personal data processed through the Slikcash website, apps and APIs. Slikcash is a product of Slik Remit. We process data in line with the Nigeria Data Protection Act and, where applicable, comparable data-protection laws in the markets we serve.</p>
        <CompanyDetails />
      </>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <ul>
        <li><strong>Identity data</strong> — name, date of birth, government identifiers (such as BVN) and verification documents, collected through our verification partners.</li>
        <li><strong>Contact data</strong> — email address, phone number and residential or business address.</li>
        <li><strong>Business data</strong> — company registration details, directors and beneficial owners, for business accounts.</li>
        <li><strong>Financial data</strong> — account numbers, transaction history, balances and card details processed by PCI-DSS certified partners.</li>
        <li><strong>Technical data</strong> — device, browser, IP address, and how you use the product, collected through logs and cookies.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <ul>
        <li>To open and operate your account and execute your transactions;</li>
        <li>To verify your identity and complete KYC/KYB checks;</li>
        <li>To prevent fraud, money laundering and abuse of the platform;</li>
        <li>To meet legal and regulatory obligations, including reporting to authorities where required;</li>
        <li>To improve our products, secure our systems and communicate with you about your account.</li>
      </ul>
    ),
  },
  {
    id: "bases",
    title: "Legal bases for processing",
    body: (
      <p>We process personal data to perform our contract with you, to comply with legal obligations (such as anti-money-laundering laws), for our legitimate interests in securing and improving the platform, and — where required — with your consent, which you may withdraw at any time.</p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We share personal data only with:</p>
        <ul>
          <li>Licensed partner banks and payment processors that deliver the services you use;</li>
          <li>Identity-verification and screening providers that perform KYC/KYB and sanctions checks;</li>
          <li>Regulators, law enforcement and courts where legally required;</li>
          <li>Service providers (hosting, analytics, communications) bound by contract to protect your data.</li>
        </ul>
        <p><strong>We never sell your personal data.</strong></p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>Because we operate across borders, your data may be processed in other countries. Where we transfer personal data internationally, we use contractual and technical safeguards designed to keep it protected to the standard described in this policy.</p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>We keep your data while your account is active and afterwards for the periods required by financial-services and anti-money-laundering regulation — typically a minimum of five years after our relationship ends — after which it is securely deleted or anonymised.</p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can request to access, correct, delete or port your personal data, restrict or object to processing, and withdraw consent at any time by emailing <a href="mailto:info@slikcash.com">info@slikcash.com</a>. Some requests may be limited where the law requires us to retain records.</p>
        <p>You also have the right to lodge a complaint with the Nigeria Data Protection Commission or your local data-protection authority.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect your data",
    body: (
      <p>We use 256-bit TLS encryption in transit, strong encryption at rest, PCI-DSS Level 1 certified card processing, hashed and vaulted credentials, strict access controls and continuous monitoring. Read more on our <a href="/security">security page</a>.</p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>We use essential cookies to keep you signed in and secure your session, and analytics cookies to understand how the product is used. You can control non-essential cookies through your browser settings; essential cookies cannot be disabled because the service depends on them.</p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>Slikcash services are not directed at anyone under 18, and we do not knowingly collect data from minors. If you believe a minor has opened an account, contact us and we will close it and delete the data.</p>
    ),
  },
  {
    id: "changes",
    title: "Changes & contact",
    body: (
      <p>We may update this policy and will notify you of material changes by email or in-product notice. Questions, requests and complaints: <a href="mailto:info@slikcash.com">info@slikcash.com</a> or <a href="mailto:support@slikcash.com">support@slikcash.com</a>.</p>
    ),
  },
];

function PrivacyPage() {
  return (
    <MarketingShell active="/privacy">
      <LegalHero
        kicker="Legal"
        title="Privacy Policy"
        sub="Your money deserves privacy, and so do you. This policy explains — in plain language — what we collect, why we collect it, who we share it with and the rights you have over it."
        updated="10 November 2026"
      />
      <LegalDoc sections={SECTIONS} />
      <CtaBand title="Bank with a platform that respects your data" sub="Open a free Slikcash account — your information stays protected end to end." />
    </MarketingShell>
  );
}
