import { Link } from "@tanstack/react-router";
import { ArrowRight, Instagram, Linkedin, Mail, MapPin, Menu, Twitter, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FlameMark } from "@/components/slikpay/Logo";

export const DOCS_URL = "https://docs.slikpay.online";
export const API_BASE = "https://api.slikpay.online/v1";

const NAV = [
  { to: "/personal", label: "Personal" },
  { to: "/business", label: "Business" },
  { to: "/developers", label: "Developers" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

const FOOTER_COLS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Personal Wallet", to: "/personal" },
      { label: "Business Console", to: "/business" },
      { label: "Payment Gateway", to: "/business" },
      { label: "Virtual Cards", to: "/personal" },
      { label: "SoftPOS & SmartTag", to: "/business" },
      { label: "Pricing & FX", to: "/pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: DOCS_URL },
      { label: "API Reference", to: "/developers" },
      { label: "Webhooks", to: "/developers" },
      { label: "SDKs & Libraries", to: "/developers" },
      { label: "Sandbox Keys", to: "/developers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Slikcash", to: "/about" },
      { label: "Regulatory & Licensing", to: "/about" },
      { label: "Security", to: "/about" },
      { label: "Contact & Support", to: "/contact" },
    ],
  },
];

function FooterLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  if (href) return <a className="mkt-footer-link" href={href} target="_blank" rel="noreferrer">{label}</a>;
  return <Link className="mkt-footer-link" to={to ?? "/"}>{label}</Link>;
}

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-grid">
          <div className="mkt-footer-brand">
            <Link to="/" className="mkt-brand" aria-label="Slikcash home">
              <FlameMark className="h-8 w-8" />
              <span>Slikcash</span>
            </Link>
            <p>
              Next-generation global banking and payments for Africa and beyond — multi-currency wallets,
              instant NUBAN accounts, virtual USD cards and a universal payment gateway.
            </p>
            <div className="mkt-footer-contact">
              <span><MapPin className="h-3.5 w-3.5" /> Lagos, Nigeria</span>
              <a href="mailto:support@slikcash.com"><Mail className="h-3.5 w-3.5" /> support@slikcash.com</a>
            </div>
            <div className="mkt-socials">
              <a href="https://x.com/slikcash" target="_blank" rel="noreferrer" aria-label="Slikcash on X"><Twitter className="h-4 w-4" /></a>
              <a href="https://instagram.com/slikcash" target="_blank" rel="noreferrer" aria-label="Slikcash on Instagram"><Instagram className="h-4 w-4" /></a>
              <a href="https://linkedin.com/company/slikcash" target="_blank" rel="noreferrer" aria-label="Slikcash on LinkedIn"><Linkedin className="h-4 w-4" /></a>
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l) => <li key={l.label}><FooterLink {...l} /></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mkt-footer-legal">
          <p>
            Slikcash is not a bank, but a financial service provider, and every service is provided by licensed
            bank partners. Deposits are held with NDIC-insured partner banks and payments move over CBN-licensed
            clearing rails. Card services are PCI-DSS Level 1 certified.
          </p>
          <p>© {new Date().getFullYear()} Slikcash Technologies Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({ active, children }: { active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mkt">
      <div className="mkt-aurora" aria-hidden />
      <div className="mkt-wrap">
        <header className="mkt-header">
          <div className="mkt-header-inner">
            <Link to="/" className="mkt-brand" aria-label="Slikcash home">
              <FlameMark className="h-8 w-8" />
              <span>Slikcash</span>
            </Link>
            <nav className="mkt-nav" aria-label="Primary">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className="mkt-nav-link" data-active={active === n.to || undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="mkt-header-fx"><span className="mkt-live-dot" /> USD/NGN ₦1,612.40</span>
            <div className="mkt-header-actions">
              <Link to="/auth" className="mkt-btn-ghost mkt-btn-sm">Sign In</Link>
              <Link to="/auth" className="mkt-btn-primary mkt-btn-sm">Get Started <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <button type="button" className="mkt-burger" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {open ? (
          <div className="mkt-drawer-root" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" className="mkt-drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="mkt-drawer">
              <div className="mkt-drawer-head">
                <span className="mkt-brand"><FlameMark className="h-7 w-7" /><span>Slikcash</span></span>
                <button type="button" className="mkt-burger" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mkt-drawer-nav" aria-label="Mobile">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="mkt-drawer-link" data-active={active === n.to || undefined} onClick={() => setOpen(false)}>
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="mkt-drawer-actions">
                <Link to="/auth" className="mkt-btn-ghost" onClick={() => setOpen(false)}>Sign In</Link>
                <Link to="/auth" className="mkt-btn-primary" onClick={() => setOpen(false)}>Get Started <ArrowRight className="h-4 w-4" /></Link>
              </div>
              <p className="mkt-drawer-fx"><span className="mkt-live-dot" /> USD/NGN ₦1,612.40 · indicative</p>
            </div>
          </div>
        ) : null}

        <main>{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
