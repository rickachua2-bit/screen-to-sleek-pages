import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Mail, MapPin, MessageCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHero, SectionHead } from "@/components/marketing/widgets";
import supportImg from "@/assets/marketing/mkt-support.jpg";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & 24/7 Priority Support — Slikcash" },
      { name: "description", content: "Reach the Slikcash team: 24/7 priority support, WhatsApp live chat, our Lagos office and verified support email." },
      { property: "og:title", content: "Contact & 24/7 Priority Support — Slikcash" },
      { property: "og:description", content: "24/7 support, WhatsApp chat and our Lagos office." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
    toast.success("Message received — our team replies within a few hours.");
  };

  return (
    <MarketingShell active="/contact">
      <PageHero
        kicker="Contact"
        title={<>Talk to a <span className="mkt-grad-text">human</span>, any time</>}
        sub="24/7 priority support for every account — and a dedicated success team for business customers."
        image={supportImg}
        imageAlt="A support headset with chat bubbles and an envelope"
      />

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container mkt-grid-2" style={{ alignItems: "start" }}>
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="mkt-card mkt-contact-card">
              <h3><Mail className="h-4 w-4" /> Verified support email</h3>
              <a href="mailto:support@slikcash.com">support@slikcash.com</a>
              <p>We only ever email you from slikcash.com addresses.</p>
            </div>
            <div className="mkt-card mkt-contact-card">
              <h3><MessageCircle className="h-4 w-4" /> WhatsApp live chat</h3>
              <a href="https://wa.me/2347000000000" target="_blank" rel="noreferrer">Chat with support on WhatsApp</a>
              <p>Average first response under five minutes.</p>
            </div>
            <div className="mkt-card mkt-contact-card">
              <h3><MapPin className="h-4 w-4" /> Office</h3>
              <p>Victoria Island, Lagos, Nigeria</p>
            </div>
            <div className="mkt-card mkt-contact-card">
              <h3><Clock3 className="h-4 w-4" /> Hours</h3>
              <p>24/7 priority support, every day of the year.</p>
            </div>
          </div>

          <div className="mkt-card" style={{ padding: "1.5rem" }}>
            <SectionHead kicker="Send a message" title="How can we help?" />
            {sent ? (
              <p className="mkt-note" style={{ fontSize: ".9rem" }}>
                Thanks — your message is with our team. Watch your inbox for a reply from support@slikcash.com.
              </p>
            ) : (
              <form className="mkt-form" onSubmit={submit}>
                <label className="mkt-field-group">
                  <span>Full name</span>
                  <input className="mkt-field" required name="name" autoComplete="name" placeholder="Adaeze Okafor" />
                </label>
                <label className="mkt-field-group">
                  <span>Email</span>
                  <input className="mkt-field" required type="email" name="email" autoComplete="email" placeholder="you@company.com" />
                </label>
                <label className="mkt-field-group">
                  <span>Topic</span>
                  <select className="mkt-field" name="topic" defaultValue="General support">
                    {["General support", "Business accounts", "Developer integration", "Cards", "Compliance & verification"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="mkt-field-group">
                  <span>Message</span>
                  <textarea className="mkt-field" required name="message" placeholder="Tell us what you need…" />
                </label>
                <button type="submit" className="mkt-btn-primary">Send message <Send className="h-4 w-4" /></button>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
