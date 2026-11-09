import { ArrowLeftRight, ArrowRight, Check, Copy, Minus, Plus, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { API_BASE, DOCS_URL } from "./shell";

/* ------------------------------ copy button ------------------------------ */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="mkt-copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setDone(false), 1600);
        });
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

/* ------------------------------- rate ticker ------------------------------ */

const TICKER = [
  { pair: "USD/NGN", rate: "₦1,612.40", delta: "+0.42%" },
  { pair: "GBP/NGN", rate: "₦2,048.15", delta: "+0.18%" },
  { pair: "EUR/NGN", rate: "₦1,746.30", delta: "-0.09%" },
  { pair: "CAD/NGN", rate: "₦1,154.80", delta: "+0.11%" },
  { pair: "USDT/NGN", rate: "₦1,613.90", delta: "+0.05%" },
  { pair: "GHS/NGN", rate: "₦103.90", delta: "-0.22%" },
  { pair: "KES/NGN", rate: "₦12.47", delta: "+0.08%" },
  { pair: "ZAR/NGN", rate: "₦88.40", delta: "+0.14%" },
];

export function RateTicker() {
  const row = [...TICKER, ...TICKER];
  return (
    <div className="mkt-ticker" aria-label="Indicative FX rates">
      <div className="mkt-ticker-track">
        {row.map((t, i) => (
          <span key={`${t.pair}-${i}`} className="mkt-ticker-item">
            <span className="mkt-live-dot" />
            <strong>{t.pair}</strong> {t.rate}
            <em data-down={t.delta.startsWith("-") || undefined}>{t.delta}</em>
          </span>
        ))}
        <span className="mkt-ticker-item mkt-ticker-tps">
          <Zap className="h-3 w-3" /> 12,480 tx/s throughput · indicative rates
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- currency converter --------------------------- */

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "KES", "GHS", "ZAR", "USDT"] as const;
type Currency = (typeof CURRENCIES)[number];
const NGN_PER: Record<Currency, number> = {
  NGN: 1, USD: 1612.4, GBP: 2048.15, EUR: 1746.3, CAD: 1154.8,
  AUD: 1039.6, KES: 12.47, GHS: 103.9, ZAR: 88.4, USDT: 1613.9,
};
const SYMBOL: Record<Currency, string> = {
  NGN: "₦", USD: "$", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$", KES: "KSh", GHS: "GH₵", ZAR: "R", USDT: "₮",
};

export function Converter() {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState<Currency>("USD");
  const [to, setTo] = useState<Currency>("NGN");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);

  const parsed = Number(amount.replace(/,/g, "")) || 0;
  const received = (parsed * NGN_PER[from]) / NGN_PER[to];
  const formatted = useMemo(
    () => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(received),
    [received],
  );

  return (
    <div className="mkt-converter mkt-card">
      <div className="mkt-converter-row">
        <label className="mkt-field-group">
          <span>You send</span>
          <div className="mkt-field-combo">
            <input
              className="mkt-field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
              aria-label="Amount to send"
            />
            <select className="mkt-field mkt-select" value={from} onChange={(e) => setFrom(e.target.value as Currency)} aria-label="Currency you send">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </label>
        <button
          type="button"
          className="mkt-swap"
          aria-label="Swap currencies"
          onClick={() => { setFrom(to); setTo(from); }}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <label className="mkt-field-group">
          <span>Recipient receives</span>
          <div className="mkt-field-combo">
            <output className="mkt-field mkt-output">{SYMBOL[to]}{formatted}</output>
            <select className="mkt-field mkt-select" value={to} onChange={(e) => setTo(e.target.value as Currency)} aria-label="Currency received">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </label>
      </div>
      <div className="mkt-converter-meta">
        <span><ShieldCheck className="h-3.5 w-3.5" /> 0 hidden fees</span>
        <span>1 {from} = {SYMBOL[to]}{new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(NGN_PER[from] / NGN_PER[to])} · indicative</span>
        <span className="mkt-delivery">
          <span key={tick} className="mkt-delivery-bar" />
          Delivered in 0.8s
        </span>
      </div>
    </div>
  );
}

/* -------------------------------- code tabs -------------------------------- */

const SNIPPETS: { lang: string; code: string }[] = [
  {
    lang: "cURL",
    code: `curl -X POST ${API_BASE}/gateway/charge \\
  -H "Authorization: Bearer sk_test_9f2c…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 8450000,
    "currency": "NGN",
    "reference": "trav_order_8X2K1",
    "channels": ["card", "apple_pay", "nip_transfer"],
    "customer": { "email": "billing@travsify.com" }
  }'`,
  },
  {
    lang: "Node.js",
    code: `import Slikcash from "@slikcash/node";

const slikcash = new Slikcash(process.env.SLIKCASH_SECRET_KEY);

const charge = await slikcash.gateway.charge({
  amount: 8_450_000, // kobo
  currency: "NGN",
  reference: "trav_order_8X2K1",
  channels: ["card", "apple_pay", "nip_transfer"],
  customer: { email: "billing@travsify.com" },
});

console.log(charge.data.authorization_url);`,
  },
  {
    lang: "Python",
    code: `from slikcash import Slikcash

client = Slikcash(os.environ["SLIKCASH_SECRET_KEY"])

charge = client.gateway.charge(
    amount=8_450_000,  # kobo
    currency="NGN",
    reference="trav_order_8X2K1",
    channels=["card", "apple_pay", "nip_transfer"],
    customer={"email": "billing@travsify.com"},
)

print(charge["data"]["authorization_url"])`,
  },
  {
    lang: "PHP",
    code: `$slikcash = new \\Slikcash\\Client(getenv('SLIKCASH_SECRET_KEY'));

$charge = $slikcash->gateway->charge([
  'amount' => 8450000, // kobo
  'currency' => 'NGN',
  'reference' => 'trav_order_8X2K1',
  'channels' => ['card', 'apple_pay', 'nip_transfer'],
  'customer' => ['email' => 'billing@travsify.com'],
]);

echo $charge->data->authorization_url;`,
  },
  {
    lang: "Flutter",
    code: `final slikcash = Slikcash(Platform.environment['SLIKCASH_SECRET_KEY']!);

final charge = await slikcash.gateway.charge(
  amount: 8450000, // kobo
  currency: 'NGN',
  reference: 'trav_order_8X2K1',
  channels: ['card', 'apple_pay', 'nip_transfer'],
  customer: {'email': 'billing@travsify.com'},
);

launchUrl(Uri.parse(charge.data.authorizationUrl));`,
  },
];

export function CodeTabs() {
  const [active, setActive] = useState(0);
  const snippet = SNIPPETS[active];
  return (
    <div className="mkt-codebox">
      <div className="mkt-codebox-head">
        <div className="mkt-codebox-tabs" role="tablist" aria-label="Code languages">
          {SNIPPETS.map((s, i) => (
            <button
              key={s.lang}
              role="tab"
              aria-selected={active === i}
              data-active={active === i || undefined}
              onClick={() => setActive(i)}
            >
              {s.lang}
            </button>
          ))}
        </div>
        <CopyButton text={snippet.code} />
      </div>
      <pre className="mkt-code"><code>{snippet.code}</code></pre>
      <div className="mkt-codebox-foot">
        <span><span className="mkt-live-dot" /> Sandbox environment</span>
        <a href={DOCS_URL} target="_blank" rel="noreferrer">View Developer Docs <ArrowRight className="h-3.5 w-3.5" /></a>
      </div>
    </div>
  );
}

/* --------------------------------- FAQ ------------------------------------ */

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mkt-faq">
      {items.map((item, i) => (
        <div key={item.q} className="mkt-faq-item" data-open={open === i || undefined}>
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span>{item.q}</span>
            {open === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          {open === i ? <p>{item.a}</p> : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ hero visuals ------------------------------- */

export function VirtualCard() {
  return (
    <div className="mkt-vcard" aria-label="Slikcash virtual USD Mastercard">
      <div className="mkt-vcard-top">
        <span className="mkt-vcard-brand">Slikcash</span>
        <span className="mkt-vcard-cur">USD</span>
      </div>
      <div className="mkt-vcard-chip" />
      <div className="mkt-vcard-number">5312&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;8471</div>
      <div className="mkt-vcard-bottom">
        <span>ACME TECHNOLOGIES LTD</span>
        <span className="mkt-vcard-mc"><i /><i /></span>
      </div>
    </div>
  );
}

const PAY_METHODS = ["Card", "Apple Pay", "NIP Transfer"] as const;

export function CheckoutWidget() {
  const [method, setMethod] = useState<(typeof PAY_METHODS)[number]>("Card");
  return (
    <div className="mkt-checkout mkt-card" aria-label="Slikcash checkout preview">
      <div className="mkt-checkout-head">
        <div>
          <strong>Travsify Global</strong>
          <span>Checkout · #trav_order_8X2K1</span>
        </div>
        <span className="mkt-pill-live"><span className="mkt-live-dot" /> Live</span>
      </div>
      <div className="mkt-checkout-amount">₦84,500.00</div>
      <div className="mkt-checkout-methods" role="tablist" aria-label="Payment methods">
        {PAY_METHODS.map((m) => (
          <button key={m} role="tab" aria-selected={method === m} data-active={method === m || undefined} onClick={() => setMethod(m)}>
            {m}
          </button>
        ))}
      </div>
      {method === "Card" ? (
        <div className="mkt-checkout-fields">
          <div className="mkt-field mkt-field-ro">Card number · 5312 •• •• 8471</div>
          <div className="mkt-checkout-split">
            <div className="mkt-field mkt-field-ro">12 / 28</div>
            <div className="mkt-field mkt-field-ro">•••</div>
          </div>
        </div>
      ) : null}
      {method === "Apple Pay" ? (
        <div className="mkt-checkout-fields"><div className="mkt-field mkt-field-ro">Pay securely with Apple Pay — Face ID confirmed</div></div>
      ) : null}
      {method === "NIP Transfer" ? (
        <div className="mkt-checkout-fields"><div className="mkt-field mkt-field-ro">NUBAN 0071 4429 05 · expires in 09:41</div></div>
      ) : null}
      <button type="button" className="mkt-btn-grad mkt-checkout-pay" onClick={() => toast.success("Demo checkout — sign up to go live")}>
        Pay ₦84,500.00
      </button>
      <p className="mkt-checkout-foot"><ShieldCheck className="h-3 w-3" /> Secured by Slikcash · PCI-DSS Level 1 · 0.8s NIP settlement</p>
    </div>
  );
}

/* ------------------------------ shared sections ---------------------------- */

export function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mkt-section-head">
      <span className="mkt-kicker">{kicker}</span>
      <h2>{title}</h2>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

export function CtaBand({ title, sub }: { title: string; sub?: string }) {
  return (
    <section className="mkt-ctaband">
      <div className="mkt-container">
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
        <div className="mkt-ctaband-actions">
          <a href="/auth" className="mkt-btn-primary">Open a free account <ArrowRight className="h-4 w-4" /></a>
          <a href="/contact" className="mkt-btn-ghost">Talk to sales</a>
        </div>
      </div>
    </section>
  );
}

export function FeatureCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mkt-card mkt-feature">
      <span className="mkt-feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
