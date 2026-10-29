import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Landmark, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCryptoOfframpPreview } from "@/lib/crypto-offramp.functions";
import type { CryptoOfframpPreview } from "@/lib/crypto-offramp";
import { naira } from "@/lib/api";
import { slikpayTransferFee } from "@/lib/transfer-validation";
import { getWalletExtras, swapCurrency } from "@/lib/wallets.functions";
import { createCryptoBankFlow, type CryptoBankState, type CryptoBankRecipient } from "@/lib/crypto-bank-flow";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { baasService } from "@/lib/baas.functions";
import { listBanks } from "@/lib/transfers.functions";
import { RecipientBankPicker, type RecipientBank } from "./RecipientBankPicker";
import coins from "@/assets/crypto-bank-coins.jpg";
import { paymentFeedback } from "@/lib/payment-feedback";

export function CryptoBankFunding({ balances }: { balances?: Record<string, number> | undefined }) {
  const [coin, setCoin] = useState<"USDT" | "USDC">("USDT"); const [amount, setAmount] = useState("");
  const getPreview = useServerFn(getCryptoOfframpPreview);
  const swap = useServerFn(swapCurrency);
  const run = useServerFn(runPaddleOperation);
  const resolve = useServerFn(baasService);
  const banksFn = useServerFn(listBanks);
  const getExtras = useServerFn(getWalletExtras);
  const flow = useRef<ReturnType<typeof createCryptoBankFlow> | null>(null);
  const [payment, setPayment] = useState<CryptoBankState | null>(null);
  const [pin, setPin] = useState("");
  const [destination, setDestination] = useState<CryptoBankRecipient | null>(null);
  const [banks, setBanks] = useState<RecipientBank[] | null>(null);
  const [bank, setBank] = useState<RecipientBank | null>(null);
  const [account, setAccount] = useState("");
  const [bankError, setBankError] = useState("");
  const [lookup, setLookup] = useState("");
  const loadBanks = () => {
    setBanks(null); setBankError("");
    void banksFn().then(setBanks).catch(() => { setBanks([]); setBankError("Could not load supported banks. Please retry."); });
  };
  useEffect(() => { loadBanks(); }, [banksFn]);
  useEffect(() => {
    let active = true;
    setDestination(null); setLookup("");
    if (!bank || account.length !== 10) return;
    setLookup("Checking recipient account…");
    void resolve({ data: { operation: "resolve-account", bankCode: bank.code, accountNumber: account } }).then((r) => {
      if (active) { setDestination({ bankCode: bank.code, accountNumber: account, accountName: r.accountName }); setLookup(""); }
    }).catch(() => { if (active) setLookup("The bank could not confirm this account. Check the details."); });
    return () => { active = false; };
  }, [bank, account, resolve]);
  const withdraw = async (data: { amount: number; pin: string; idempotencyKey: string; recipient?: CryptoBankRecipient }) => {
    if (!data.recipient) throw new Error("Choose a verified recipient account.");
    const result = await run({ data: {
      id: "post-payouts-transfer", params: {}, currency: "NGN", pin: data.pin, idempotencyKey: data.idempotencyKey,
      body: { amount: data.amount, destinationBankCode: data.recipient.bankCode, destinationAccountNumber: data.recipient.accountNumber, destinationAccountName: data.recipient.accountName, narration: "Slikpay crypto cash-out" },
    } });
    if (result.receipt?.status === "failed") throw new Error("The bank declined this withdrawal.");
    if (result.receipt?.status !== "succeeded") throw new Error("Bank payment is awaiting confirmation. Check your ledger.");
    return result;
  };
  const [preparing, setPreparing] = useState(false);
  const [recoveries, setRecoveries] = useState<Array<{ idempotency_key: string; operation: string; amount: number }>>([]);
  useEffect(() => {
    let active = true;
    void getExtras().then((extras) => {
      if (active) setRecoveries(extras.receipts.filter((r) => r.status === "pending" && ["SWAP USDT->NGN", "SWAP USDC->NGN"].includes(r.operation)).map((r) => ({ idempotency_key: r.idempotency_key, operation: r.operation, amount: Number(r.amount) })));
    }).catch(() => {});
    return () => { active = false; };
  }, [getExtras]);
  const locked = payment !== null && payment.stage !== "ready";
  async function convert() {
    if (preparing || (locked && payment?.stage !== "conversion_pending")) return;
    setPreparing(true); setError("");
    try {
      if (!destination && payment?.stage !== "conversion_pending") throw new Error("Select a bank and verify the recipient account first.");
      if (!flow.current) flow.current = createCryptoBankFlow({
        swap: (data) => swap({ data }), withdraw,
        id: () => crypto.randomUUID(), changed: setPayment,
      });
      await flow.current.convert(coin, Number(amount), pin);
    } catch (e) { setError(paymentFeedback(e, "conversion")); }
    finally { setPin(""); setPreparing(false); }
  }
  async function pay() {
    if (!flow.current) return;
    setError("");
    try {
      if (!destination) throw new Error("Choose a verified recipient account.");
      await flow.current.pay(pin, destination);
    }
    catch (e) { setError(paymentFeedback(e)); }
    finally { setPin(""); }
  }
  const [preview, setPreview] = useState<CryptoOfframpPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let current = true;
    setPreview(null); setError(""); setLoading(false);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const timer = setTimeout(() => {
      setLoading(true);
      void getPreview({ data: { coin, amount: value } }).then((q) => {
        if (current) setPreview(q);
      }).catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : "Conversion rates are unavailable.");
      }).finally(() => { if (current) setLoading(false); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [coin, amount, getPreview]);
  const estimate = preview ? { amount: preview.netNgn, rate: preview.effectiveRate } : null;
  const recovering = payment?.stage === "conversion_pending";
  const step = payment?.stage === "completed" ? 3 : payment?.stage === "converted" || payment?.stage === "paying" || payment?.stage === "payout_pending" ? 2 : 1;
  const fee = payment?.stage === "converted" ? (payment.payoutAmount > 0 ? slikpayTransferFee(payment.payoutAmount) : 0) : estimate ? slikpayTransferFee(estimate.amount) : null;
  return <section className="transfer-center crypto-composer space-y-5">
    <div><h2 className="text-2xl font-bold text-foreground">Crypto to bank</h2><p className="mt-1 text-sm text-muted-foreground">USDT or USDC → NGN → bank account</p></div>
    <div className="transfer-composer-layout">
      <aside className="transfer-story crypto-story">
        <span className="transfer-eyebrow"><ShieldCheck className="h-4 w-4" />CRYPTO TO BANK</span>
        <h2>From crypto<br />to your bank account</h2>
        <p className="crypto-story-description">Convert USDT or USDC to NGN and pay any supported Nigerian bank account.</p>
        <img src={coins} alt="USDT and USDC coins connected to a bank" width={1152} height={576} className="crypto-coins" />
        <div className="crypto-coin-labels"><span>USDT</span><span>USDC</span><span>NGN</span></div>
        <ol className="crypto-stages">{[["Convert", "Convert crypto to your NGN balance."], ["Review", "Review the confirmed credit and bank fee."], ["Pay", "Confirm the bank payout with your PIN."]].map(([title, detail], i) => <li key={title} aria-current={step === i + 1 ? "step" : undefined}><span className="crypto-stage-number">{step > i + 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol>
        <p className="crypto-story-security"><Lock className="h-3.5 w-3.5" />PIN protected · Verified recipients</p>
      </aside>
      <section className="transfer-composer space-y-4" aria-label="Crypto bank transfer form">
        {!payment && recoveries.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold text-foreground">Pending conversions</p>{recoveries.map((r) => <Button key={r.idempotency_key} variant="outline" className="max-w-full" onClick={() => {
          const originalCoin = r.operation === "SWAP USDC->NGN" ? "USDC" : "USDT";
          setCoin(originalCoin); setAmount(String(r.amount));
          flow.current = createCryptoBankFlow({ swap: (data) => swap({ data }), withdraw, id: () => crypto.randomUUID(), changed: setPayment, resume: { coin: originalCoin, amount: r.amount, swapId: r.idempotency_key } });
          setPayment({ stage: "conversion_pending", credited: 0, payoutAmount: 0, swapId: r.idempotency_key, payoutId: "", message: "Recover the original conversion." });
        }}>Recover {r.amount} {r.operation.includes("USDC") ? "USDC" : "USDT"}</Button>)}</div>}
        <div><p className="crypto-field-label">Select crypto asset</p><div className="grid grid-cols-2 gap-2" role="group" aria-label="Crypto funding currency">{(["USDT", "USDC"] as const).map((c) => <Button key={c} disabled={locked || preparing} variant="outline" className="crypto-asset" aria-pressed={coin === c} onClick={() => { setCoin(c); setAmount(""); }}><span className={c === "USDT" ? "crypto-asset-symbol crypto-tether" : "crypto-asset-symbol"}>{c === "USDT" ? "₮" : "$"}</span><span className="text-left"><strong className="block">{c}</strong><span className="block text-xs font-normal text-muted-foreground">{c === "USDT" ? "Tether" : "USD Coin"}</span></span></Button>)}</div></div>
        <label className="block"><span className="crypto-field-label">Amount <span className="float-right font-normal text-muted-foreground">Available: {balances?.[coin] !== undefined ? balances[coin]?.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}</span></span><div className="crypto-amount"><input aria-label="Crypto conversion amount" disabled={locked || preparing} inputMode="decimal" className="field" placeholder="0.00" value={amount} onChange={(e) => { if (/^\d*(\.\d{0,8})?$/.test(e.target.value)) setAmount(e.target.value); }} /><span>{coin}</span></div></label>
        <dl className="crypto-estimates"><div><dt>{payment?.stage === "converted" ? "Confirmed NGN credit" : "Estimated NGN"}</dt><dd>{payment?.stage === "converted" ? naira(payment.credited) : estimate ? naira(estimate.amount) : "—"}</dd></div><div><dt>Conversion fee · included</dt><dd>{preview ? naira(preview.conversionFee) : "—"}</dd></div></dl>
        {preview && <p className="text-xs text-muted-foreground">Effective rate {naira(preview.effectiveRate)} · Wholesale {naira(preview.wholesaleRate)} · Indicative, not locked.</p>}
        {loading && <p role="status" className="text-xs text-muted-foreground">Fetching conversion rates…</p>}
        {(!payment || ["ready", "converted", "conversion_pending"].includes(payment.stage)) && <><RecipientBankPicker banks={banks} bank={bank} error={bankError} onRetry={loadBanks} onSelect={(selected) => { setDestination(null); setBank(selected); }} /><label className="block"><span className="crypto-field-label">Account number</span><input aria-label="Cash-out recipient account number" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="Enter account number" className="field" value={account} onChange={(e) => { setDestination(null); setAccount(e.target.value.replace(/\D/g, "")); }} /></label></>}
        <div><p className="crypto-field-label">Recipient name</p><div className="crypto-recipient">{destination ? <><CheckCircle2 className="h-4 w-4 shrink-0 text-success" /><span>{destination.accountName}</span></> : <span>{lookup || "—"}</span>}</div></div>
        <div className="crypto-bank-fee"><span>Bank fee · 1% capped at ₦80</span><strong>{fee !== null ? naira(fee) : "—"}</strong></div>
        {payment && <div role="status" className="crypto-payment-status"><p>{payment.message}</p>{payment.stage === "converted" && <p className="mt-1">Bank receives {naira(payment.payoutAmount)} · Total debit {naira(payment.payoutAmount + (fee ?? 0))}</p>}<p className="mt-2 break-all text-xs text-muted-foreground">{payment.stage === "payout_pending" || payment.stage === "completed" ? payment.payoutId : payment.swapId}</p></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {(!locked || recovering || payment?.stage === "converted") && <label className="block"><span className="crypto-field-label">Enter your PIN</span><input aria-label="Crypto bank transaction PIN" type="password" inputMode="numeric" placeholder="4-digit transaction PIN" autoComplete="off" maxLength={4} className="field" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>}
        {payment?.stage === "converted" ? <Button variant="brand" disabled={pin.length !== 4 || payment.payoutAmount <= 0 || !destination} onClick={() => void pay()} className="crypto-submit"><Landmark className="h-4 w-4" />Confirm bank withdrawal</Button> : <Button variant="brand" disabled={(locked && !recovering) || preparing || (!recovering && (loading || !preview || !destination)) || pin.length !== 4} onClick={() => void convert()} className="crypto-submit">{preparing ? "Preparing conversion…" : recovering ? "Recover original conversion" : "Convert and review"}<ArrowRight className="h-4 w-4" /></Button>}
      </section>
    </div>
  </section>;
}
