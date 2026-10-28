import type { ReactNode } from "react";
import { ArrowUpRight, CheckCircle2, Landmark, LockKeyhole, Send, ShieldCheck, Wallet } from "lucide-react";
import globe from "@/assets/transfer-globe.jpg";
import { naira } from "@/lib/api";
import type { TransferPreview } from "./ActionModal";

export function TransferComposerLayout({ balance, live, preview, children }: { balance?: number | undefined; live: boolean; preview: TransferPreview | null; children: ReactNode }) {
  return <div className="transfer-composer-layout">
    <aside className="transfer-story">
      <div className="transfer-story-top"><span className="transfer-eyebrow"><ArrowUpRight className="h-4 w-4" />MOVE MONEY FORWARD</span><span className="transfer-mode"><span />{live ? "Live" : "Sandbox"}</span></div>
      <h2>Bank transfers.<br /><span>Beautifully simple.</span></h2>
      <div className="transfer-balance"><Wallet className="h-5 w-5" /><div><p>Available Naira balance</p><strong>{balance !== undefined ? naira(balance) : "—"}</strong></div><span className="transfer-currency">NGN</span></div>
      <div className="transfer-preview">
        <div className="transfer-preview-title"><span>Transfer overview</span><Send className="h-4 w-4" /></div>
        <strong className="transfer-preview-amount">{preview && preview.amount > 0 ? naira(preview.amount) : "₦0.00"}</strong>
        <dl><div><dt>Recipient</dt><dd>{preview?.name || "—"}</dd></div><div><dt>Bank</dt><dd>{preview?.bank || "—"}</dd></div><div><dt>Account</dt><dd className="font-mono">{preview?.account || "—"}</dd></div><div><dt>Transfer fee</dt><dd>{preview?.fee || "Available at review"}</dd></div></dl>
        {preview?.name && <p className="transfer-recipient-verified"><CheckCircle2 className="h-4 w-4" />Recipient verified</p>}
      </div>
      <div className="transfer-assurances"><span><ShieldCheck />Verified recipient</span><span><LockKeyhole />PIN protected</span></div>
      <img className="transfer-globe" src={globe} alt="" width={1152} height={576} />
    </aside>
    <section className="transfer-composer" aria-label="Bank transfer form">
      <div className="transfer-composer-heading"><div><h2>{preview?.step === "done" ? "Transfer receipt" : preview?.step === "review" ? "Review transfer" : "Send Money"}</h2><p>{preview?.step === "review" ? "Check the details before confirming." : "Transfer to a verified bank account."}</p></div><span className="transfer-heading-icon"><Landmark className="h-5 w-5" /></span></div>
      {children}
    </section>
  </div>;
}