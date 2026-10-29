import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeftRight, Landmark, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCryptoOfframpPreview } from "@/lib/crypto-offramp.functions";
import type { CryptoOfframpPreview } from "@/lib/crypto-offramp";
import { naira } from "@/lib/api";
import { slikpayTransferFee } from "@/lib/transfer-validation";
import { getWalletExtras, swapCurrency, withdrawFunds, type PayoutAccount } from "@/lib/wallets.functions";
import { createCryptoBankFlow, type CryptoBankState } from "@/lib/crypto-bank-flow";

export function CryptoBankFunding({ balances }: { balances?: Record<string, number> | undefined }) {
  const [coin, setCoin] = useState<"USDT" | "USDC">("USDT"); const [amount, setAmount] = useState("");
  const getPreview = useServerFn(getCryptoOfframpPreview);
  const swap = useServerFn(swapCurrency);
  const withdraw = useServerFn(withdrawFunds);
  const getExtras = useServerFn(getWalletExtras);
  const flow = useRef<ReturnType<typeof createCryptoBankFlow> | null>(null);
  const [payment, setPayment] = useState<CryptoBankState | null>(null);
  const [pin, setPin] = useState("");
  const [destination, setDestination] = useState<PayoutAccount | null>(null);
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
      const extras = await getExtras();
      const account = extras.payouts.NGN;
      if (!account) throw new Error("Verify your settlement account in KYB first.");
      setDestination(account);
      if (!flow.current) flow.current = createCryptoBankFlow({
        swap: (data) => swap({ data }), withdraw: (data) => withdraw({ data }),
        id: () => crypto.randomUUID(), changed: setPayment,
      });
      await flow.current.convert(coin, Number(amount), pin);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare conversion."); }
    finally { setPin(""); setPreparing(false); }
  }
  async function pay() {
    if (!flow.current) return;
    setError("");
    try { await flow.current.pay(pin); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare bank withdrawal."); }
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
  return <section className="space-y-5 border-t border-border pt-5">
    {!payment && recoveries.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold text-foreground">Pending conversions</p>{recoveries.map((r) => <Button key={r.idempotency_key} variant="outline" className="max-w-full" onClick={() => {
      const originalCoin = r.operation === "SWAP USDC->NGN" ? "USDC" : "USDT";
      setCoin(originalCoin); setAmount(String(r.amount));
      flow.current = createCryptoBankFlow({ swap: (data) => swap({ data }), withdraw: (data) => withdraw({ data }), id: () => crypto.randomUUID(), changed: setPayment, resume: { coin: originalCoin, amount: r.amount, swapId: r.idempotency_key } });
      setPayment({ stage: "conversion_pending", credited: 0, payoutAmount: 0, swapId: r.idempotency_key, payoutId: "", message: "Recover the original conversion." });
    }}>Recover {r.amount} {r.operation.includes("USDC") ? "USDC" : "USDT"} conversion</Button>)}</div>}
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ArrowLeftRight className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-foreground">Crypto to bank</h2><p className="mt-1 text-sm text-muted-foreground">USDT or USDC → NGN → bank account</p></div></div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-4"><div className="flex gap-2" role="group" aria-label="Crypto funding currency">{(["USDT", "USDC"] as const).map((c) => <Button key={c} disabled={locked || preparing} variant={coin === c ? "brand" : "outline"} aria-pressed={coin === c} onClick={() => { setCoin(c); setAmount(""); }}><Wallet className="h-4 w-4" />{c}</Button>)}</div><p className="text-xs text-muted-foreground">Available {coin}: <strong className="text-foreground">{balances?.[coin] !== undefined ? balances[coin]?.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}</strong></p><label className="block text-sm font-semibold text-foreground">Amount in {coin}<input aria-label="Crypto conversion amount" disabled={locked || preparing} inputMode="decimal" className="field mt-2" placeholder="0.00" value={amount} onChange={(e) => { if (/^\d*(\.\d{0,8})?$/.test(e.target.value)) setAmount(e.target.value); }} /></label><div className="rounded-lg border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Estimated NGN after conversion spread</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{estimate ? naira(estimate.amount) : "—"}</p><p className="mt-2 text-xs text-muted-foreground">{estimate ? `Indicative live rate: 1 ${coin} = ${naira(estimate.rate)}. Not a locked quote.` : "No executable quote available for this pair."}</p>{estimate && <p className="mt-2 text-xs text-muted-foreground">Estimated bank fee: {naira(slikpayTransferFee(estimate.amount))} · 1% capped at ₦80</p>}</div></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Fetching conversion rates…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview && <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-2">
      {[["Wholesale rate", naira(preview.wholesaleRate)], ["Effective rate", naira(preview.effectiveRate)], ["Conversion fee · included in rate", naira(preview.conversionFee)], ["Estimated net NGN", naira(preview.netNgn)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{value}</dd></div>)}
    </dl>}
    <div className="space-y-4 border-l-2 border-primary/20 pl-5"><div className="flex items-center gap-2 text-sm font-bold text-foreground"><ArrowLeftRight className="h-4 w-4 text-primary" />Convert to your NGN balance</div><ArrowDown className="h-4 w-4 text-muted-foreground" /><div className="flex items-center gap-2 text-sm font-bold text-foreground"><Landmark className="h-4 w-4 text-primary" />Withdraw to your verified settlement account</div><div role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-4"><p className="flex items-center gap-2 text-sm font-bold text-primary"><Lock className="h-4 w-4" />{payment && payment.stage !== "ready" ? payment.message : "Conversion approval required"}</p><p className="mt-2 text-sm text-muted-foreground">{payment?.stage === "converted" ? `${naira(payment.credited)} credited to NGN. Bank payment: ${naira(payment.payoutAmount)} · Fee: ${naira(slikpayTransferFee(payment.payoutAmount))}.` : "Rates include the service’s conversion spread. Conversion remains protected until confirmed quotes and recovery are supported."}</p>{destination && <p className="mt-2 text-sm text-foreground">{destination.accountName} · {destination.accountNumber}</p>}{payment && <p className="mt-2 break-all text-xs text-muted-foreground">{payment.stage === "payout_pending" || payment.stage === "completed" ? payment.payoutId : payment.swapId}</p>}</div>
    {(!locked || recovering || payment?.stage === "converted") && <label className="block text-sm font-semibold text-foreground">Transaction PIN<input aria-label="Crypto bank transaction PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="field mt-2" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>}
    {payment?.stage === "converted" ? <Button variant="brand" disabled={pin.length !== 4 || payment.payoutAmount <= 0} onClick={() => void pay()} className="w-full"><Landmark className="h-4 w-4" />Confirm bank withdrawal</Button> : <Button variant="outline" disabled={(locked && !recovering) || preparing || (!recovering && (loading || !preview)) || pin.length !== 4} onClick={() => void convert()} className="w-full"><Lock className="h-4 w-4" />{preparing ? "Checking settlement account…" : recovering ? "Recover original conversion" : "Convert and review bank payout"}</Button>}</div></div>
  </section>;
}