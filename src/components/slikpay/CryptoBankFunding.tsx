import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeftRight, Landmark, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCryptoOfframpPreview } from "@/lib/crypto-offramp.functions";
import type { CryptoOfframpPreview } from "@/lib/crypto-offramp";
import { naira } from "@/lib/api";
import { slikpayTransferFee } from "@/lib/transfer-validation";

export function CryptoBankFunding({ balances }: { balances?: Record<string, number> | undefined }) {
  const [coin, setCoin] = useState<"USDT" | "USDC">("USDT"); const [amount, setAmount] = useState("");
  const getPreview = useServerFn(getCryptoOfframpPreview);
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
  return <section className="space-y-5 border-t border-border pt-5">
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ArrowLeftRight className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-foreground">Crypto to bank</h2><p className="mt-1 text-sm text-muted-foreground">USDT or USDC → NGN → bank account</p></div></div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-4"><div className="flex gap-2" role="group" aria-label="Crypto funding currency">{(["USDT", "USDC"] as const).map((c) => <Button key={c} variant={coin === c ? "brand" : "outline"} aria-pressed={coin === c} onClick={() => { setCoin(c); setAmount(""); }}><Wallet className="h-4 w-4" />{c}</Button>)}</div><p className="text-xs text-muted-foreground">Available {coin}: <strong className="text-foreground">{balances?.[coin] !== undefined ? balances[coin]?.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}</strong></p><label className="block text-sm font-semibold text-foreground">Amount in {coin}<input aria-label="Crypto conversion amount" inputMode="decimal" className="field mt-2" placeholder="0.00" value={amount} onChange={(e) => { if (/^\d*(\.\d{0,8})?$/.test(e.target.value)) setAmount(e.target.value); }} /></label><div className="rounded-lg border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Estimated NGN after conversion spread</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{estimate ? naira(estimate.amount) : "—"}</p><p className="mt-2 text-xs text-muted-foreground">{estimate ? `Indicative live rate: 1 ${coin} = ${naira(estimate.rate)}. Not a locked quote.` : "No executable quote available for this pair."}</p>{estimate && <p className="mt-2 text-xs text-muted-foreground">Estimated bank fee: {naira(slikpayTransferFee(estimate.amount))} · 1% capped at ₦80</p>}</div></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Fetching conversion rates…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview && <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-2">
      {[["Wholesale rate", naira(preview.wholesaleRate)], ["Effective rate", naira(preview.effectiveRate)], ["Conversion fee · included in rate", naira(preview.conversionFee)], ["Estimated net NGN", naira(preview.netNgn)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{value}</dd></div>)}
    </dl>}
    <div className="space-y-4 border-l-2 border-primary/20 pl-5"><div className="flex items-center gap-2 text-sm font-bold text-foreground"><ArrowLeftRight className="h-4 w-4 text-primary" />Convert to your NGN balance</div><ArrowDown className="h-4 w-4 text-muted-foreground" /><div className="flex items-center gap-2 text-sm font-bold text-foreground"><Landmark className="h-4 w-4 text-primary" />Pay your bank or another recipient</div><div role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-4"><p className="flex items-center gap-2 text-sm font-bold text-primary"><Lock className="h-4 w-4" />Cash-out not active yet</p><p className="mt-2 text-sm text-muted-foreground">Rates include the service’s conversion spread. Payment execution still requires a confirmed amount and recovery after interrupted conversion. No crypto is debited by this preview.</p></div><Button variant="outline" disabled className="w-full"><Lock className="h-4 w-4" />Convert and review bank payout</Button></div></div>
  </section>;
}