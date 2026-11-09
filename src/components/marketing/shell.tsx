import { Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, Home, Instagram, Linkedin, Mail, MapPin, Menu, ReceiptText, Rocket, Twitter, Wallet, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FlameMark } from "@/components/slikpay/Logo";
import { useLiveFxRates } from "@/hooks/use-live-fx-rates";
import fullLogoAsset from "@/assets/slikcash-logo-full.png.asset.json";

export const DOCS_URL = "https://docs.slikpay.online";
export const API_BASE = "https://api.slikpay.online/v1";
/** Where the actual app (sign-in / console / wallet) lives. */
export const APP_SIGNIN = "https://business.slikcash.com/auth";

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
      { label: "Security", to: "/security" },
      { label: "Regulatory & Licensing", to: "/licensing" },
      { label: "Contact & Support", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Security", to: "/security" },
      { label: "Regulatory & Licensing", to: "/licensing" },
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
              <img src={fullLogoAsset.url} alt="Slikcash" className="h-16 w-auto" draggable={false} />
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
          <nav className="mkt-footer-legal-links" aria-label="Legal">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/security">Security</Link>
            <Link to="/licensing">Regulatory & Licensing</Link>
          </nav>
          <p>© {new Date().getFullYear()} Slikcash Technologies Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/personal", label: "Personal", icon: Wallet },
  { to: "/business", label: "Business", icon: Briefcase },
  { to: "/pricing", label: "Pricing", icon: ReceiptText },
] as const;

/** Floating bottom tab bar — mobile only, on every marketing page. */
function MarketingMobileNav({ active }: { active: string }) {
  return (
    <nav aria-label="Mobile navigation" className="mkt-tabbar">
      {MOBILE_TABS.slice(0, 2).map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="mkt-tab" data-active={active === to || undefined} aria-current={active === to ? "page" : undefined}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
          <span>{label}</span>
        </Link>
      ))}
      <a href={APP_SIGNIN} className="mkt-tab-cta" aria-label="Get Started — open the app">
        <Rocket className="h-5 w-5" strokeWidth={2.4} />
      </a>
      {MOBILE_TABS.slice(2).map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="mkt-tab" data-active={active === to || undefined} aria-current={active === to ? "page" : undefined}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Live USD/NGN badge — never shows a hardcoded rate. */
function FxBadge({ suffix = "" }: { suffix?: string }) {
  const { rates, loading, unavailable } = useLiveFxRates();
  const usdNgn = rates?.["USD_NGN"];
  const text = usdNgn != null
    ? `USD/NGN ₦${usdNgn.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`
    : loading ? "Live FX loading…" : unavailable ? "Live FX unavailable" : "Live FX";
  return <span className="mkt-header-fx"><span className="mkt-live-dot" /> {text}</span>;
}

export function MarketingShell({ active, children }: { active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Scroll-reveal choreography: every .mkt-reveal element fades up as it enters the viewport.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".mkt-reveal:not([data-revealed])"));
    if (els.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.setAttribute("data-revealed", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [active]);

  // Spotlight hover: cards glow toward the cursor via --mx/--my custom properties.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.(".mkt-card");
      if (!(card instanceof HTMLElement)) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

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
            <FxBadge />
            <div className="mkt-header-actions">
              <a href={APP_SIGNIN} className="mkt-btn-ghost mkt-btn-sm">Sign In</a>
              <a href={APP_SIGNIN} className="mkt-btn-primary mkt-btn-sm">Get Started <ArrowRight className="h-4 w-4" /></a>
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
                <a href={APP_SIGNIN} className="mkt-btn-ghost" onClick={() => setOpen(false)}>Sign In</a>
                <a href={APP_SIGNIN} className="mkt-btn-primary" onClick={() => setOpen(false)}>Get Started <ArrowRight className="h-4 w-4" /></a>
              </div>
              <p className="mkt-drawer-fx"><FxBadge suffix=" · indicative" /></p>
            </div>
          </div>
        ) : null}

        <main>{children}</main>
        <MarketingFooter />
        <MarketingMobileNav active={active} />
      </div>
    </div>
  );
}
