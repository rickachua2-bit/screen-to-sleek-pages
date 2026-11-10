import { createFileRoute } from "@tanstack/react-router";
import { Mail, Send } from "lucide-react";
import { useState, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHero, SectionHead } from "@/components/marketing/widgets";
import { sendEnquiry } from "@/lib/enquiry.functions";
import supportImg from "@/assets/marketing/mkt-support.png";
import { CompanyDetails } from "@/components/marketing/company";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Slik Remit — Slikcash Support" },
      { name: "description", content: "Contact Slik Remit, the company behind Slikcash, at our Abuja and United States addresses, by phone or at info@slikcash.com." },
      { property: "og:title", content: "Contact Slik Remit — Slikcash Support" },
      { property: "og:description", content: "Slikcash enquiries, Abuja and United States contact details, and NDPC registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    setSending(true);
    try {
      await sendEnquiry({
        data: {
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          topic: String(data.get("topic") ?? ""),
          message: String(data.get("message") ?? ""),
        },
      });
      setSent(true);
      toast.success("Message received — our team replies within a few hours.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't send your message — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <MarketingShell active="/contact">
      <PageHero
        kicker="Contact"
        title={<>Talk to the <span className="mkt-grad-text">Slikcash team</span></>}
        sub="Slikcash is a product of Slik Remit. Reach us for account support, business enquiries or questions about your data."
        image={supportImg}
        imageAlt="A support headset with chat bubbles and an envelope"
      />

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container mkt-grid-2" style={{ alignItems: "start" }}>
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="mkt-card mkt-contact-card mkt-reveal">
              <h3><Mail className="h-4 w-4" /> Verified support email</h3>
              <a href="mailto:info@slikcash.com">info@slikcash.com</a>
              <p>We only ever email you from slikcash.com addresses.</p>
            </div>
            <CompanyDetails />
          </div>

          <div className="mkt-card mkt-reveal" style={{ padding: "1.5rem", "--mkt-d": "120ms" } as CSSProperties}>
            <SectionHead kicker="Send a message" title="How can we help?" />
            {sent ? (
              <p className="mkt-note" style={{ fontSize: ".9rem" }}>
                Thanks — your message is with our team. Watch your inbox for a reply from info@slikcash.com.
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
                <button type="submit" className="mkt-btn-primary" disabled={sending}>{sending ? "Sending…" : "Send message"} <Send className="h-4 w-4" /></button>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
