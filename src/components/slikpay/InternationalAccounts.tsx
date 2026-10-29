import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Landmark, Loader2, Share2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWallets, issueCurrencyWallet, type WalletView } from "@/lib/wallets.functions";
import { currencyDef, NOT_ACTIVE } from "@/lib/wallets";

const fmt = (n: number, code: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: code === "USDT" || code === "USDC" ? 6 : 2 })} ${code}`;

function useWallets() {
  const load = useServerFn(getWallets);
  const [wallets, setWallets] = useState<WalletView[] | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { setWallets((await load()).wallets); setError(""); }
    catch { setError("Your currency accounts could not be loaded. Refresh to try again."); }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { wallets, error, refresh };
}

/** Receive tab: foreign bank accounts and stablecoin addresses issued to this business. */
export function ReceiveAccounts({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState("USD");
  const { wallets, error, refresh } = useWallets();
  const issue = useServerFn(issueCurrencyWallet);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");

  const request = async (code: WalletView["code"]) => {
    setBusy(code);
    try {
      const r = await issue({ data: { currency: code as "USD" } });
      if (!r.ok) setNote((p) => ({ ...p, [code]: r.note ?? NOT_ACTIVE }));
      await refresh();
    } catch (e) { setNote((p) => ({ ...p, [code]: e instanceof Error ? e.message : "This account could not be issued. Try again." })); }
    finally { setBusy(""); }
  };
  const details = (w: WalletView) => [w.accountName, w.bankName, w.accountNumber && `${w.network ? "Address" : "Account"}: ${w.accountNumber}`, w.routing && `Routing / sort: ${w.routing}`, w.network && `Network: ${w.network}`].filter(Boolean).join("\n");
  const copy = async (w: WalletView) => { try { await navigator.clipboard.writeText(details(w)); setCopied(w.code); setTimeout(() => setCopied(""), 1600); } catch { /* clipboard blocked */ } };
  const share = async (w: WalletView) => {
    const text = details(w);
    if (navigator.share) { try { await navigator.share({ title: `${w.code} account details`, text }); } catch { /* cancelled */ } } else await copy(w);
  };

  if (error) return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>;
  if (!wallets) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your accounts…</p>;
  return <div className={compact ? "international-receive-details" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
    {compact && <label className="mb-4 block text-xs font-semibold text-muted-foreground">Receiving currency<select aria-label="Receiving currency" value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">{wallets.map((w) => <option key={w.code} value={w.code}>{currencyDef(w.code)?.flag} {w.code} · {currencyDef(w.code)?.name}</option>)}</select></label>}
    {wallets.filter((w) => !compact || w.code === selected).map((w) => {
      const def = currencyDef(w.code);
      const blocked = w.status === "not_active" || Boolean(note[w.code]);
      return <article key={w.code} className={compact ? "min-w-0" : "rounded-lg border border-border bg-card p-4"}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold"><span aria-hidden="true">{def?.flag}</span>{w.code} <span className="text-xs font-normal text-muted-foreground">{def?.name}</span></p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${w.status === "active" ? "bg-success/10 text-success" : blocked ? "bg-magenta/10 text-magenta" : "bg-muted text-muted-foreground"}`}>
            {w.status === "active" ? "Active" : blocked ? "Not active" : "Not issued"}
          </span>
        </div>
        {w.status === "active" ? <>
          <dl className="mt-3 space-y-1 text-xs">
            {w.accountName && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Name</dt><dd className="min-w-0 break-words text-right font-semibold">{w.accountName}</dd></div>}
            {w.bankName && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Bank</dt><dd className="min-w-0 break-words text-right">{w.bankName}</dd></div>}
            {w.accountNumber && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{w.network ? "Address" : "Account"}</dt><dd className="break-all font-mono">{w.accountNumber}</dd></div>}
            {w.routing && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Routing / sort</dt><dd className="font-mono">{w.routing}</dd></div>}
            {w.network && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Network</dt><dd>{w.network}</dd></div>}
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy(w)}>{copied === w.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === w.code ? "Copied" : "Copy"}</Button>
            <Button size="sm" variant="outline" onClick={() => void share(w)}><Share2 className="h-3.5 w-3.5" />Share</Button>
          </div>
        </> : blocked ? <p className="mt-3 text-sm text-magenta">{note[w.code] && note[w.code] !== NOT_ACTIVE ? note[w.code] : NOT_ACTIVE}</p>
          : <Button size="sm" className="mt-3" disabled={busy === w.code} onClick={() => void request(w.code)}>{busy === w.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}Get {w.code} account</Button>}
      </article>;
    })}
  </div>;
}

/** Hold tab: every currency balance, provider-reported first with ledger filling the gaps. */
export function HoldBalances({ ngn }: { ngn: number | undefined }) {
  const { wallets, error } = useWallets();
  if (error) return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>;
  if (!wallets) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading balances…</p>;
  const rows = [{ code: "NGN", balance: ngn ?? 0, status: "active" as const }, ...wallets];
  return <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
    {rows.map((w) => <div key={w.code} className={`rounded-2xl border p-4 ${w.code === "NGN" ? "hero-surface border-transparent text-white" : "border-border bg-card"}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold opacity-90"><Wallet className="h-3.5 w-3.5" />{currencyDef(w.code)?.flag} {w.code}</p>
      <p className="mt-2 text-lg font-extrabold tabular-nums">{fmt(w.balance, w.code)}</p>
      <p className="mt-0.5 text-[11px] opacity-80">{w.status === "active" ? "Available" : w.status === "not_active" ? NOT_ACTIVE : "Not issued"}</p>
    </div>)}
  </div>;
}
