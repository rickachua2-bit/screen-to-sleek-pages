import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { LegalDoc, LegalHero, type LegalSection } from "@/components/marketing/legal";
import { CtaBand } from "@/components/marketing/widgets";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Slikcash" },
      { name: "description", content: "The terms that govern your Slikcash account, wallet, transfers, cards and payment services, delivered with licensed partner banks." },
      { property: "og:title", content: "Terms of Service — Slikcash" },
      { property: "og:description", content: "The terms that govern your Slikcash account and payment services." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://slikcash.com/terms" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://slikcash.com/terms" }],
  }),
  component: TermsPage,
});

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>These Terms of Service are between you and <strong>SLIK REMIT LTD</strong> ("we", "us"), company registration <strong>RC8999975</strong>, with a Nigeria address at H Salem plaza, Abuja, Nigeria. <strong>Slikcash is a product of Slik Remit.</strong> Our United States contact address is 15442 VENTURA BLVD., STE 201-935, SHERMAN OAKS CA 91403, US. Contact us at <a href="mailto:info@slikcash.com">info@slikcash.com</a>, <a href="tel:+2348126173408">+234 812 617 3408</a> or <a href="tel:+14158429508">+1 (415) 842-9508</a>.</p>
        <p><strong>Slikcash is not a bank.</strong> Banking services, deposit accounts, card issuing and interbank settlement are provided by licensed partner banks and regulated financial institutions in each market we serve. By creating an account or using any Slikcash service, you accept these terms and any service-specific terms shown in the product.</p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility & accounts",
    body: (
      <ul>
        <li>You must be at least 18 years old and able to enter a binding contract.</li>
        <li>You must provide accurate, complete and current information, and keep it updated.</li>
        <li>Personal accounts are for individual use; Business accounts require completed business verification (KYB) before live operations.</li>
        <li>We may decline, restrict or close an account where required by law, regulation or our risk policies.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Your account & security",
    body: (
      <>
        <p>You are responsible for keeping your password, transaction PIN, API keys and two-factor authentication devices confidential. Slikcash will never ask for your password, PIN or one-time codes by phone, email or social media.</p>
        <p>You must notify us immediately at <a href="mailto:support@slikcash.com">support@slikcash.com</a> if you suspect unauthorised access. You are responsible for activity on your account until you notify us and we confirm the account is secured.</p>
      </>
    ),
  },
  {
    id: "services",
    title: "Our services",
    body: (
      <p>Slikcash provides multi-currency wallets, bank transfers and collections, virtual accounts, card issuing, bill payments, foreign exchange and stablecoin conversions, cross-border payouts, a payment gateway and developer APIs. Some services are provided directly by licensed partners under their own terms, which we make available to you in the product. A service shown as unavailable or "coming soon" is not part of these terms until launched.</p>
    ),
  },
  {
    id: "fees",
    title: "Fees & pricing",
    body: (
      <p>Fees are calculated live and shown to you before you confirm any transaction — you will always see the fee and the total debit amount first. Our current fee schedule is published on the <a href="/pricing">pricing page</a>. We may update fees with reasonable advance notice; the fee shown at the point of confirmation is the fee that applies.</p>
    ),
  },
  {
    id: "payments",
    title: "Payments, transfers & settlement",
    body: (
      <ul>
        <li>You are responsible for the accuracy of recipient details. Completed transfers may be irreversible, and we may not be able to recover funds sent to a correctly-entered but wrong recipient.</li>
        <li>We may delay, decline or reverse a transaction where required for fraud prevention, sanctions screening, legal compliance or partner-bank instructions.</li>
        <li>Where a payment outcome is uncertain, we keep your funds reserved and reconcile with the partner bank rather than guessing — we never mark a payment successful without authoritative confirmation.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You must not use Slikcash for:</p>
        <ul>
          <li>Fraud, money laundering, terrorism financing, sanctions evasion or any illegal activity;</li>
          <li>Unlicensed gambling, Ponzi or pyramid schemes, or deceptive trade practices;</li>
          <li>Transactions that violate card-scheme rules, partner-bank policies or applicable law;</li>
          <li>Interfering with, probing or abusing our systems, APIs or other users.</li>
        </ul>
        <p>We may suspend or terminate access and report to the relevant authorities where we reasonably believe this policy is breached.</p>
      </>
    ),
  },
  {
    id: "compliance",
    title: "Compliance & verification",
    body: (
      <p>We operate know-your-customer (KYC), know-your-business (KYB), anti-money-laundering and sanctions-screening programmes, and monitor transactions as required by law. You agree to provide identity documents, business records and source-of-funds information when requested. Failure to complete verification may limit or suspend your account.</p>
    ),
  },
  {
    id: "fx",
    title: "Foreign exchange & conversions",
    body: (
      <p>Currency conversions and stablecoin swaps execute at live rates shown before you confirm, including any disclosed margin or fee. A confirmed conversion is final. Rates move constantly; the quote you accept is the rate that applies to that conversion only.</p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party providers",
    body: (
      <p>Our services rely on licensed partner banks, card schemes, mobile networks, billers, airlines and other providers. We are not responsible for outages or errors originating with those providers, but we will always reconcile your funds transparently and keep you informed of the status of affected transactions.</p>
    ),
  },
  {
    id: "availability",
    title: "Service availability",
    body: (
      <p>We engineer for very high availability and monitor our systems continuously, but we do not guarantee uninterrupted service. Planned maintenance is announced in advance where possible, and we are not liable for downtime caused by events outside our reasonable control.</p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>To the maximum extent permitted by law, Slikcash is not liable for indirect, incidental or consequential losses, lost profits or lost data. Our aggregate liability arising from these terms is capped at the total fees you paid us in the twelve months before the claim. Nothing in these terms excludes liability that cannot be excluded by law, including for fraud or gross negligence.</p>
    ),
  },
  {
    id: "termination",
    title: "Suspension & termination",
    body: (
      <p>You may close your account at any time from the app or by contacting support. We may suspend or close an account for legal, regulatory, security or risk reasons, with notice where lawful. On closure, remaining funds are returned to your verified settlement account after any outstanding obligations, holds or required investigations are resolved.</p>
    ),
  },
  {
    id: "law",
    title: "Governing law & disputes",
    body: (
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. Please contact <a href="mailto:support@slikcash.com">support@slikcash.com</a> first — most issues are resolved within days. Unresolved disputes are subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria, without prejudice to any mandatory consumer-protection rights.</p>
    ),
  },
  {
    id: "changes",
    title: "Changes & contact",
    body: (
      <p>We may update these terms and will give at least 14 days' notice of material changes by email and in-product notice. Continued use after the effective date constitutes acceptance. Questions about these terms: <a href="mailto:info@slikcash.com">info@slikcash.com</a>.</p>
    ),
  },
];

function TermsPage() {
  return (
    <MarketingShell active="/terms">
      <LegalHero
        kicker="Legal"
        title="Terms of Service"
        sub="The agreement between you and Slikcash — written to be read, not just accepted. It covers your account, your money, our services and where each of our responsibilities begins and ends."
        updated="10 November 2026"
      />
      <LegalDoc sections={SECTIONS} />
      <CtaBand title="Ready to move money the modern way?" sub="Open a free Slikcash account in minutes and accept these terms with full clarity." />
    </MarketingShell>
  );
}
