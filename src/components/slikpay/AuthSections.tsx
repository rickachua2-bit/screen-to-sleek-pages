import { useState } from "react";
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, Building2, Check, Code2, CreditCard, Landmark, QrCode, Rocket, ScanFace,
  ShieldCheck, Smartphone, Users, Wallet, Zap, type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-cobalt/20 bg-cobalt/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cobalt">{children}</span>
);

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
        <Logo sub="Pan-African Financial OS" />
        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-bold text-body lg:flex">
          {[["What We Offer", "#offer"], ["Pan-African KYC / KYB", "#kyb"], ["How It Works", "#how"], ["Regulatory Status", "#legal"]].map(([l, h]) => (
            <a key={l} href={h} className="transition-colors hover:text-cobalt">{l}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-bold text-success md:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> All systems live
          </span>
          <a href="#how" className="hidden rounded-full border-2 border-border px-3.5 py-1.5 text-xs font-bold text-foreground hover:border-cobalt sm:inline-flex">Developer Docs</a>
          <a href="#signin" className="rounded-full bg-navy px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-obsidian">Get Mobile App</a>
        </div>
      </div>
    </header>
  );
}

const RAILS = ["NGN · Nigeria", "KES · Kenya", "GHS · Ghana", "ZAR · South Africa", "RWF · Rwanda", "EGP · Egypt", "USD · Global", "GBP · UK", "EUR · Eurozone", "USDT · Stablecoin"];

export function RailsTicker() {
  const row = [...RAILS, ...RAILS];
  return (
    <div className="flex items-center overflow-hidden border-b-[1.5px] border-border bg-muted/40 py-2.5">
      <span className="z-10 shrink-0 bg-background px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt">● Pan-African Rails</span>
      <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-10">
          {row.map((r, i) => <span key={i} className="whitespace-nowrap font-mono text-xs font-semibold text-body">{r}</span>)}
        </div>
      </div>
      <span className="hidden shrink-0 px-5 font-mono text-[10px] font-bold text-success md:block">⚡ 0.8s settlement</span>
    </div>
  );
}

const PILLARS: { tag: string; title: string; icon: LucideIcon; tone: string; items: [string, string][] }[] = [
  { tag: "Core rails", title: "Point of Sale & Payments", icon: Smartphone, tone: "bg-cobalt", items: [["Tap to Pay on Mobile", "Accept contactless cards on any NFC Android phone."], ["Checkout & Payment Links", "Online checkout, dynamic QR and WhatsApp links."], ["Instant Settlement", "Sub-second reconciliation with automated sweeps."]] },
  { tag: "Bank accounts", title: "Commercial Banking & Payouts", icon: Landmark, tone: "bg-gradient-brand", items: [["Dedicated Bank Accounts", "Corporate NUBANs and virtual accounts per customer."], ["Instant Transfers", "Real-time NIP to every commercial bank."], ["Bulk Payroll", "Single-click salary and vendor disbursements."]] },
  { tag: "Cards & FX", title: "Cards, FX & Bill Payments", icon: CreditCard, tone: "bg-magenta", items: [["Virtual USD Cards", "Instant Mastercards for AWS, Meta ads and Netflix."], ["Multi-Currency FX", "Hold and convert NGN, USD, GBP, KES, GHS."], ["Bills & Utilities", "Airtime, data, power and cable in seconds."]] },
  { tag: "Ops & compliance", title: "Security, KYB & APIs", icon: ShieldCheck, tone: "bg-gradient-tri", items: [["Instant KYB", "Automated CAC, BRS, RDB and CIPC lookups."], ["2FA & Settlement PIN", "Device biometrics and dual authorization."], ["Developer APIs", "REST APIs, signed webhooks and full sandbox."]] },
];

export function HeroIntro() {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-mono text-[10px] font-bold text-success"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> LIVE + SANDBOX</span>
        <Eyebrow>12 jurisdictions</Eyebrow>
        <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] font-bold text-body">99.99% uptime SLA</span>
      </div>
      <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-foreground md:text-5xl xl:text-[56px]">
        Complete digital banking &{" "}
        <span className="text-gradient-animated">payment infrastructure</span>
      </h1>
      <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-body">
        Accept contactless payments on mobile, issue dedicated corporate accounts, disburse instant payroll, and manage multi-currency FX across Africa and global markets.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <a href="#signin" className="inline-flex items-center gap-2 rounded-xl bg-cobalt px-5 py-3 text-sm font-bold text-primary-foreground shadow-cobalt transition-all hover:-translate-y-0.5 hover:bg-cobalt-deep">Open free account →</a>
        <a href="#how" className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-background px-5 py-3 text-sm font-bold text-foreground transition-colors hover:border-cobalt">See how it works</a>
      </div>
      <dl className="mt-8 grid grid-cols-3 divide-x-[1.5px] divide-border rounded-2xl border-[1.5px] border-border bg-background/70 backdrop-blur">
        {[["₦48B+", "Processed yearly"], ["45+", "Banks connected"], ["0.8s", "Avg. settlement"]].map(([v, l]) => (
          <div key={l} className="px-4 py-3">
            <dt className="text-2xl font-black tracking-tight text-foreground md:text-3xl">{v}</dt>
            <dd className="text-[11px] font-semibold text-muted-foreground">{l}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PILLARS.map(({ tag, title, icon: Icon, tone, items }) => (
          <div key={title} className="panel group p-4 transition-all hover:-translate-y-0.5 hover:border-cobalt/40 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground ${tone}`}><Icon className="h-4 w-4" /></span>
              <div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{tag}</div>
                <div className="text-sm font-extrabold text-foreground">{title}</div>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {items.map(([t, d]) => (
                <li key={t} className="flex gap-2 text-xs">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cobalt" />
                  <span><b className="font-bold text-foreground">{t}.</b> <span className="font-medium text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="panel mt-3 flex items-center gap-3 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-xs font-black text-primary-foreground">TG</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-foreground">Travsify Global Inclusive Ltd</div>
          <div className="truncate font-mono text-[10px] font-bold text-success">● KYB verified · Corporate entity · Sterling settlement rails</div>
        </div>
        <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-bold text-body sm:inline">TLS 1.3</span>
      </div>
    </div>
  );
}

const FEATURES: { icon: LucideIcon; tone: string; title: string; desc: string; foot: string }[] = [
  { icon: Smartphone, tone: "text-cobalt bg-cobalt/10", title: "Contactless SoftPOS", desc: "Turn any NFC Android phone into a certified terminal. Accept Visa, Mastercard and Verve tap payments with zero hardware.", foot: "Instant soundbox beep + digital receipt" },
  { icon: CreditCard, tone: "text-magenta bg-magenta/10", title: "Multi-Currency Virtual Mastercards", desc: "Issue USD, GBP and local cards instantly with Apple Pay and Google Pay support for Amazon, Netflix and AWS.", foot: "3D-Secure 2FA & instant freeze" },
  { icon: Wallet, tone: "text-cobalt bg-cyan/20", title: "Free P2P & Smart Accounts", desc: "Send money instantly with zero fees using @SlikTag. Every user gets a dedicated account for inflows from any bank.", foot: "0.8s settlement velocity" },
  { icon: QrCode, tone: "text-cobalt bg-cobalt/10", title: "Dynamic QR & SmartTag Hardware", desc: "Encrypted NFC SmartTags and dynamic QR codes customers scan with any banking app.", foot: "Countertop stands & stickers" },
  { icon: Users, tone: "text-magenta bg-magenta/10", title: "Multi-Cashier & Loss Prevention", desc: "Dedicated 4-digit PINs per cashier, shift reports and flagged discrepancies in real time.", foot: "Audit trail with PDF & WhatsApp export" },
  { icon: Code2, tone: "text-cobalt bg-cyan/20", title: "Developer APIs & Treasury Sweeps", desc: "Plug Slikpay rails into your app. Accept payments via hosted checkout and automate midnight sweeps.", foot: "REST APIs, signed webhooks, idempotency" },
];

export function PartnerStrip() {
  return (
    <div className="border-y-[1.5px] border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trusted rails & partners</span>
        {["Sterling Bank", "Mastercard", "NIBSS", "Visa", "Verve", "Interswitch"].map((n) => (
          <span key={n} className="text-lg font-black tracking-tight text-muted-foreground/70 transition-colors hover:text-foreground">{n}</span>
        ))}
      </div>
    </div>
  );
}

export function FloatingChips() {
  return (
    <>
      <div className="panel animate-float absolute -top-7 -left-8 z-10 hidden items-center gap-3 p-3 shadow-xl xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success"><Check className="h-4 w-4" strokeWidth={3} /></span>
        <div><div className="text-xs font-extrabold text-foreground">+₦250,000.00</div><div className="text-[10px] font-semibold text-muted-foreground">NIP · Chukwuemeka A.</div></div>
      </div>
      <div className="panel animate-float-slow absolute -right-10 bottom-24 z-10 hidden items-center gap-3 p-3 shadow-xl xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-tri text-primary-foreground"><CreditCard className="h-4 w-4" /></span>
        <div><div className="text-xs font-extrabold text-foreground">USD card issued</div><div className="text-[10px] font-semibold text-muted-foreground">•••• 1234 · in 3s</div></div>
      </div>
    </>
  );
}

export function FeatureGrid() {
  return (
    <section id="offer" className="mx-auto max-w-7xl px-5 py-24">
      <div className="text-center">
        <Eyebrow>The complete Slikpay suite</Eyebrow>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Everything you can power with Slikpay</h2>
        <p className="mx-auto mt-3 max-w-2xl font-medium text-body">Built for individuals who want frictionless everyday banking and ambitious merchants who need enterprise-grade collections.</p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, tone, title, desc, foot }) => (
          <div key={title} className="panel group relative overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-tri transition-transform duration-300 group-hover:scale-x-100" />
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
            <h3 className="mt-5 text-lg font-extrabold text-foreground">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{desc}</p>
            <p className="mt-5 flex items-center gap-1.5 font-mono text-[11px] font-bold text-cobalt"><Check className="h-3.5 w-3.5" /> {foot}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const COUNTRIES = ["Pan-African & Global", "Nigeria", "Kenya", "Ghana", "South Africa", "Rwanda", "UK / US / Diaspora"];
const REG: Record<string, { reg: string; tax: string; id: string; phone: string }> = {
  "Pan-African & Global": { reg: "CAC, BRS, RGD, CIPC or RDB", tax: "TIN / KRA / SARS", id: "NIN, BVN, Ghana Card, Huduma or passport", phone: "+234, +254, +233, +27, +250" },
  Nigeria: { reg: "CAC (RC / BN number)", tax: "FIRS TIN", id: "NIN + BVN", phone: "+234" },
  Kenya: { reg: "BRS certificate", tax: "KRA PIN", id: "National ID / Huduma", phone: "+254" },
  Ghana: { reg: "RGD certificate", tax: "GRA TIN", id: "Ghana Card", phone: "+233" },
  "South Africa": { reg: "CIPC registration", tax: "SARS tax number", id: "SA ID / Smart ID", phone: "+27" },
  Rwanda: { reg: "RDB certificate", tax: "RRA TIN", id: "National ID", phone: "+250" },
  "UK / US / Diaspora": { reg: "Companies House / EIN", tax: "UTR / EIN", id: "Passport + proof of address", phone: "+44, +1" },
};

function Tier({ n, title, limit, desc, items }: { n: number; title: string; limit: string; desc: string; items: string[] }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-foreground">Tier {n}: {title}</div>
        <span className="font-mono text-[10px] font-bold text-success">{limit}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{desc}</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => <li key={i} className="flex gap-2 text-xs font-semibold text-body"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cobalt" />{i}</li>)}
      </ul>
    </div>
  );
}

export function KybSection() {
  const [c, setC] = useState(COUNTRIES[0]!);
  const r = REG[c]!;
  return (
    <section id="kyb" className="border-y-[1.5px] border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-5 py-24">
        <div className="text-center">
          <Eyebrow>Pan-African & global compliance</Eyebrow>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">What you need to sign up</h2>
          <p className="mx-auto mt-3 max-w-2xl font-medium text-body">Pick your country to see exactly what's required for instant verification.</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {COUNTRIES.map((x) => (
            <button key={x} onClick={() => setC(x)} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${c === x ? "bg-cobalt text-primary-foreground shadow-cobalt" : "border-[1.5px] border-border bg-background text-body hover:border-cobalt"}`}>{x}</button>
          ))}
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="panel p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt"><Building2 className="h-5 w-5" /></span>
              <div><h3 className="font-extrabold text-foreground">Business & Merchant KYB</h3><p className="text-xs font-medium text-muted-foreground">Sole traders, retail stores, supermarkets & SaaS</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <Tier n={1} title="Sole Trader / SME" limit="Up to $10,000 / day" desc="Instant SoftPOS activation on Android." items={[`Registered business name (${r.reg})`, `Tax ID (${r.tax})`, `Proprietor ID (${r.id})`]} />
              <Tier n={2} title="Registered Limited Company" limit="Up to $100,000 / day" desc="Unlocks multi-cashier, SmartTags and developer APIs." items={["Certificate of incorporation", "Memorandum & articles of association", "Corporate bank account for settlement"]} />
              <Tier n={3} title="Enterprise & Regulated" limit="Unlimited velocity" desc="Full acquiring, custom sweeps and bulk payroll." items={["Ultimate beneficial owner IDs (>5%)", "Board resolution authorizing Slikpay", "AML / CFT & sanctions attestation"]} />
            </div>
          </div>
          <div className="panel p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-magenta/10 text-magenta"><BadgeCheck className="h-5 w-5" /></span>
              <div><h3 className="font-extrabold text-foreground">Personal User Verification</h3><p className="text-xs font-medium text-muted-foreground">Individuals, freelancers & cross-border spenders</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <Tier n={1} title="Starter Explorer" limit="$500 / day" desc="Activate your account in 60 seconds." items={["Full legal name", `Verified mobile number (${r.phone})`, "Email address & date of birth"]} />
              <Tier n={2} title="Verified Smart Account" limit="$5,000 / day" desc="Unlocks USD virtual cards & @SlikTag." items={[`National ID (${r.id})`, "Real-time biometric liveness selfie"]} />
              <Tier n={3} title="Sovereign Platinum" limit="Unlimited global spend" desc="Premium limits and multi-currency wallets." items={["Government photo passport or driver's licence", "Proof of address under 90 days"]} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS: { icon: LucideIcon; title: string; desc: string; foot: string }[] = [
  { icon: Zap, title: "60-second onboarding", desc: "Enter your details and phone number, verify the SMS code and unlock your console immediately.", foot: "Instant sandbox / live access" },
  { icon: ScanFace, title: "Automated AI verification", desc: "Upload your registration certificate or national ID. Our engine checks registries and biometrics in under 30 seconds.", foot: "Sub-minute automated decisioning" },
  { icon: Rocket, title: "Go live with SoftPOS & cards", desc: "Your phone becomes a contactless terminal, your virtual USD card is issued and payouts are switched on.", foot: "Ready for live customer taps" },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-24">
      <div className="text-center">
        <Eyebrow>Frictionless onboarding</Eyebrow>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Go live in under 2 minutes</h2>
        <p className="mx-auto mt-3 max-w-2xl font-medium text-body">Engineered to match the best fintech onboarding in the world.</p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, desc, foot }, i) => (
          <div key={title} className="panel relative p-6">
            <span className="bg-gradient-tri bg-clip-text font-mono text-5xl font-black text-transparent opacity-40">0{i + 1}</span>
            <span className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-3 text-lg font-extrabold text-foreground">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{desc}</p>
            <p className="mt-5 flex items-center gap-1.5 font-mono text-[11px] font-bold text-success"><Check className="h-3.5 w-3.5" /> {foot}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Disclaimer() {
  return (
    <section id="legal" className="mx-auto max-w-5xl px-5 pb-20">
      <div className="panel flex gap-4 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/20 text-foreground"><AlertTriangle className="h-5 w-5" /></span>
        <div className="space-y-3 text-xs font-medium leading-relaxed text-body">
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">Important regulatory status & banking disclaimer</h3>
          <p><b className="text-foreground">Slikpay is a financial technology company, not a bank.</b> Banking services, dedicated virtual accounts and interbank settlement are provided by licensed partner banks, including Sterling Bank Plc, regulated by the Central Bank of Nigeria and other national regulators.</p>
          <p>Card issuing services are provided by licensed partner banks under licence from Mastercard International. Slikpay complies with PCI-DSS Level 1, the Nigeria Data Protection Regulation (NDPR), Kenya Data Protection Act and South Africa's POPIA. Funds held in user accounts are protected under the respective partner banks' deposit insurance schemes.</p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t-[1.5px] border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 md:flex-row">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xs font-semibold text-muted-foreground">© 2026 Slikpay Technologies Ltd.</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-5 text-xs font-bold text-body">
          {["Features", "KYC / KYB", "How It Works", "Developer Docs", "Terms", "Privacy"].map((l) => <a key={l} href="#offer" className="hover:text-cobalt">{l}</a>)}
        </nav>
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-muted-foreground"><ArrowLeftRight className="h-3 w-3" /> PCI-DSS L1 · TLS 1.3</span>
      </div>
    </footer>
  );
}
