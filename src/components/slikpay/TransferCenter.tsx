import { useState } from "react";
import { Bitcoin, Landmark, Send, Users } from "lucide-react";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useBankingProfile } from "./PaddleConsole";
import { SendNip, type TransferPreview } from "./ActionModal";
import { TransferComposerLayout } from "./TransferComposerLayout";
import { BulkPayments } from "./BulkPayments";
import { CryptoBankFunding } from "./CryptoBankFunding";

export function TransferCenter({ initial = "single" }: { initial?: "single" | "bulk" }) {
  const { profile } = useBankingProfile();
  const live = profile?.mode === "live";
  const balance = profile?.balances?.["NGN"];
  const [tab, setTab] = useState(initial);
  const [funding, setFunding] = useState<"fiat" | "crypto">("fiat");
  const [k, setK] = useState(0);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  return <div className="transfer-center space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary">PAYMENTS</p><h1 className="mt-1 text-2xl font-bold text-foreground">Bank transfer</h1></div>
    <div role="tablist" aria-label="Transfer type" className="transfer-tabs">
      {([["single", "Single transfer", Send], ["bulk", "Bulk upload", Users]] as const).map(([id, label, Icon]) => <Button variant="ghost" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon className="h-4 w-4" />{label}</Button>)}
    </div>
    </div>
    {tab === "single" && <div role="tablist" aria-label="Transfer funding" className="flex gap-2 border-b border-border pb-4">{([["fiat", "Fiat", Landmark], ["crypto", "Crypto", Bitcoin]] as const).map(([id, label, Icon]) => <Button key={id} role="tab" aria-selected={funding === id} variant={funding === id ? "brand" : "outline"} onClick={() => setFunding(id)}><Icon className="h-4 w-4" />{label}</Button>)}</div>}
    {tab === "single" && funding === "crypto" ? <CryptoBankFunding balances={profile?.balances} /> : tab === "single"
      ? <TransferComposerLayout balance={balance} live={live} preview={preview}><SendNip key={k} live={live} balance={balance} onPreviewChange={setPreview} onClose={() => setK((x) => x + 1)} /></TransferComposerLayout>
      : <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-sm"><span className="text-muted-foreground">Available balance <strong className="ml-2 text-foreground">{balance !== undefined ? naira(balance) : "—"}</strong></span><span className="text-primary">{live ? "Live" : "Sandbox · test money"}</span></div><BulkPayments live={live} balance={balance} /></>}
  </div>;
}

