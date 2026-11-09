import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Braces, KeyRound, Webhook } from "lucide-react";
import { API_BASE, DOCS_URL, MarketingShell } from "@/components/marketing/shell";
import { ApiProductGrid, CodeTabs, CopyButton, CtaBand, FeatureCard, PageHero, SectionHead } from "@/components/marketing/widgets";
import apiImg from "@/assets/marketing/mkt-api.jpg";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developer Documentation & API Hub — Slikcash" },
      { name: "description", content: "REST API reference, HMAC-SHA256 webhooks, SDKs for Android, iOS, React and Flutter, and automatic sandbox keys for every business account." },
      { property: "og:title", content: "Developer Documentation & API Hub — Slikcash" },
      { property: "og:description", content: "REST APIs, signed webhooks, SDKs and sandbox keys for building on Slikcash." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

const WEBHOOK_SNIPPET = `// Verify a Slikcash webhook (HMAC-SHA256)
import crypto from "node:crypto";

const signature = req.headers["x-slikcash-signature"]; // t=...,v1=...
const [t, v1] = signature.split(",").map((p) => p.split("=")[1]);

const expected = crypto
  .createHmac("sha256", process.env.SLIKCASH_WEBHOOK_SECRET)
  .update(\`\${t}.\${req.rawBody}\`)
  .digest("hex");

if (!crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))) {
  return res.status(401).end(); // reject forged events
}`;

const SDKS = [
  { name: "Node.js / TypeScript", detail: "npm install @slikcash/node" },
  { name: "Python", detail: "pip install slikcash" },
  { name: "PHP", detail: "composer require slikcash/sdk" },
  { name: "Flutter", detail: "flutter pub add slikcash" },
  { name: "Android", detail: "Kotlin SDK via Maven Central" },
  { name: "iOS", detail: "Swift SDK via Swift Package Manager" },
];

function DevelopersPage() {
  return (
    <MarketingShell active="/developers">
      <PageHero
        kicker="Developers"
        title={<>Build on rails that settle in <span className="mkt-grad-text">0.8 seconds</span></>}
        sub="A clean REST API, signed webhooks and SDKs for every stack. Sandbox keys are issued automatically when you open a business account — live keys follow KYB approval."
        image={apiImg}
        imageAlt="Developer API illustration with a code window, connected nodes and a plug"
      >
        <div className="mkt-hero-actions">
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="mkt-btn-primary">Read the documentation <ArrowRight className="h-4 w-4" /></a>
          <a href="/auth" className="mkt-btn-ghost">Get sandbox keys</a>
        </div>
      </PageHero>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Quickstart"
            title={`Charge a customer with POST /v1/gateway/charge`}
            sub={`Base URL: ${API_BASE} — authenticate with your sk_test_ or sk_live_ secret key.`}
          />
          <CodeTabs />
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="API products"
            title="Every Slikcash product, one integration away"
            sub="Payments, accounts, transfers, cards, remittance, bills, flights and events — the same rails that power our own console, documented end to end."
          />
          <ApiProductGrid />
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead
            kicker="Webhooks"
            title="Signed events you can trust"
            sub="Every webhook carries an HMAC-SHA256 signature and timestamp. Verify before you act — replayed or forged events are rejected."
          />
          <div className="mkt-codebox">
            <div className="mkt-codebox-head">
              <div className="mkt-codebox-tabs"><button data-active>Node.js</button></div>
              <CopyButton text={WEBHOOK_SNIPPET} />
            </div>
            <pre className="mkt-code"><code>{WEBHOOK_SNIPPET}</code></pre>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <SectionHead kicker="Keys & SDKs" title="Everything you need to ship" />
          <div className="mkt-grid-3">
            <FeatureCard icon={<KeyRound className="h-5 w-5" />} title="Automatic sandbox keys">
              Every business signup receives sk_test_ keys instantly. Claim, rotate or revoke them after a quick email code confirmation.
            </FeatureCard>
            <FeatureCard icon={<Braces className="h-5 w-5" />} title="60 requests per minute">
              Generous rate limits with clear 429 headers, idempotency keys on every write and 365-day key rotation windows.
            </FeatureCard>
            <FeatureCard icon={<Webhook className="h-5 w-5" />} title="Full sandbox environment">
              Test charges, payouts, cards and webhooks end-to-end before you touch live money.
            </FeatureCard>
          </div>
          <div className="mkt-grid-3" style={{ marginTop: "1rem" }}>
            {SDKS.map((s) => (
              <div key={s.name} className="mkt-card mkt-feature">
                <h3>{s.name}</h3>
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: ".74rem" }}>{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Ship your first charge this afternoon."
        sub="Open a business account, grab your sandbox keys and follow the quickstart in the docs."
      />
    </MarketingShell>
  );
}
