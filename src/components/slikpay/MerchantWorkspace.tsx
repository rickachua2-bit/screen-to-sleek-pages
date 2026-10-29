import { useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MERCHANT_NAV } from "@/lib/merchant";
import { API_BASE_URL, DOCS_URL } from "@/lib/business-api";
import type { Account } from "@/lib/api";
import type { ActionKind } from "./ActionModal";
import { NubanCard, UsdCardPanel } from "./Widgets";
import { GoLive, PaddleConsole } from "./PaddleConsole";
import { ServicesHub } from "./ServicesHub";
import { KybFlow } from "./KybFlow";
import { TransferCenter } from "./TransferCenter";
import { InternationalServices } from "./InternationalServices";
import { PaymentLinks } from "./PaymentLinks";
import { SmartTag } from "./SmartTag";
import { DirectDebits } from "./DirectDebits";
import { Escrow } from "./Escrow";
import { Cards } from "./Cards";
import { Airtime } from "./Airtime";
import { MobileData } from "./MobileData";
import { BillsService } from "./BillsService";
import { GovernmentPayments } from "./GovernmentPayments";
import { TeamSecurity } from "./TeamSecurity";
import { DisputesManager } from "./DisputesManager";
import { StatementsManager } from "./StatementsManager";
import { CashierShiftsManager } from "./CashierShiftsManager";
import { ApprovalsManager } from "./ApprovalsManager";
import { TreasuryAutomation } from "./TreasuryAutomation";
import { FlightBooking } from "./FlightBooking";

const BILLS_MODULES: Record<string, string> = { "svc-power": "power", "svc-tv": "tv", "svc-internet": "internet", "svc-betting": "betting", "svc-education": "education" };

const CONFIG: Record<string, { tabs: string[]; action: string; fields: string[]; columns: string[] }> = {
  softpos: { tabs: ["Terminals", "Cashiers"], action: "Add terminal", fields: ["Terminal name", "Cashier name", "Location"], columns: ["Terminal", "Cashier", "Location"] },
  payroll: { tabs: ["Batch payouts", "Beneficiary book"], action: "Add beneficiary draft", fields: ["Beneficiary name", "Bank", "Account number"], columns: ["Beneficiary", "Bank", "Account number"] },
  shifts: { tabs: ["Shifts", "Cashiers", "Reconciliation"], action: "Draft shift", fields: ["Shift name", "Cashier", "Opening till (NGN)"], columns: ["Shift", "Cashier", "Opening till"] },
  disputes: { tabs: ["Open cases", "Evidence", "Resolution timeline"], action: "Prepare evidence", fields: ["Transaction reference", "Case reference", "Evidence summary"], columns: ["Transaction", "Case", "Summary"] },
  approvals: { tabs: ["Pending approvals", "Approval history", "Policies"], action: "Draft policy", fields: ["Policy name", "Payout threshold (NGN)", "Approver"], columns: ["Policy", "Threshold", "Approver"] },
  compliance: { tabs: ["Business verification", "Director KYC", "Account tiers"], action: "Prepare submission", fields: ["Registered business name", "CAC number", "Director name"], columns: ["Business", "CAC number", "Director"] },
  statements: { tabs: ["Bank statements", "Tax exports", "Monthly ledgers"], action: "Draft statement request", fields: ["Account number", "Period from", "Period to"], columns: ["Account", "From", "To"] },
  developer: { tabs: ["API keys", "Webhooks", "Delivery logs"], action: "Draft webhook", fields: ["Endpoint name", "HTTPS callback URL", "Events"], columns: ["Name", "Endpoint", "Events"] },
};

export function MerchantWorkspace({ module, account, onAction, search = "" }: { module: string; account: Account; onAction: (kind: ActionKind) => void; search?: string }) {
  const item = MERCHANT_NAV.find((n) => n.id === module);
  const config = CONFIG[module];
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<{ values: string[]; tab: number }[]>([]);
  if (!item) return null;
  if (module === "services") return <ServicesHub role="merchant" />;
  if (module === "settings") return <TeamSecurity />;
  if (module === "flights" || module === "svc-flights") return <FlightBooking role="merchant" />;
  if (module === "svc-escrow") return <Escrow />;
  if (module === "svc-airtime") return <Airtime />;
  if (module === "svc-data") return <MobileData />;
  if (module === "svc-firs" || module === "svc-remita") return <GovernmentPayments service={module === "svc-firs" ? "firs" : "remita"} />;
  if (BILLS_MODULES[module]) return <BillsService serviceId={BILLS_MODULES[module]} />;
  if (module.startsWith("svc-")) return <ServicesHub key={module} role="merchant" only={[module.slice(4)]} title={item.label} autoOpen />;
  if (module === "developer") return <PaddleConsole role="merchant" />;
  if (module === "golive") return <KybFlow />;
  if (module === "banking") return <TransferCenter key="single" />;
  if (module === "payroll") return <TransferCenter key="bulk" initial="bulk" />;
  if (module === "cards") return <Cards />;
  if (module === "treasury") return <TreasuryAutomation />;
  if (module === "links") return <PaymentLinks />;
  if (module === "smarttag") return <SmartTag />;
  if (module === "mandates") return <DirectDebits />;
  if (module === "disputes") return <DisputesManager />;
  if (module === "statements") return <StatementsManager />;
  if (module === "shifts" || module === "softpos") return <CashierShiftsManager />;
  if (module === "approvals") return <ApprovalsManager />;
  if (!config) return null;
  const rows = drafts.filter((d) => d.tab === tab && d.values.join(" ").toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-1">
      <div className="flex max-w-full gap-3 sm:gap-5 overflow-x-auto scrollbar-none">{config.tabs.map((t, i) => <Button key={t} variant="ghost" onClick={() => setTab(i)} className={`h-12 rounded-none border-b-2 px-0 ${tab === i ? "border-cyan text-cyan" : "border-transparent text-muted-foreground"}`}>{t}</Button>)}</div>
      <Button className="mb-3" onClick={() => setAdding(true)}><Plus />{config.action}</Button>
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-chart-4" />Not connected · drafts are kept only in this workspace session</div>
    <div className="overflow-x-auto rounded-lg border border-border bg-card w-full max-w-full -webkit-overflow-scrolling-touch"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{config.columns.map((c) => <th key={c} className="p-4">{c}</th>)}<th className="p-4">Status</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b border-border">{row.values.map((v, j) => <td key={j} className="p-4">{v}</td>)}<td className="p-4 text-cyan">Draft</td></tr>)}</tbody></table>{!rows.length && <div className="flex flex-col items-center py-16"><item.icon className="mb-4 h-10 w-10 text-cobalt" /><h2 className="font-bold">No {config.tabs[tab]?.toLowerCase()} yet</h2><p className="mt-2 max-w-sm px-4 text-center text-sm text-muted-foreground">Live records will appear when this module is connected.</p></div>}</div>
    {module === "compliance" && <div className="border-t border-border py-4 text-sm text-muted-foreground">CAC verification: not verified · Director KYC: not submitted · Tier limits: awaiting verification</div>}
    {module === "developer" && <div className="flex flex-wrap items-center gap-3 border-t border-border py-4"><code className="text-xs text-cyan">{API_BASE_URL}</code><Button variant="ghost" size="icon" aria-label="Copy API URL" onClick={async () => { try { await navigator.clipboard.writeText(API_BASE_URL); toast.success("API URL copied"); } catch { toast.error("Copy unavailable"); } }}><Copy /></Button><a href={DOCS_URL} target="_blank" rel="noreferrer noopener" className="text-xs font-bold text-cobalt underline underline-offset-4">Read the documentation ↗</a><span className="text-xs text-muted-foreground">Keys and signing secrets are issued to your business automatically.</span></div>}
    {adding && <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={() => setAdding(false)}><div role="dialog" aria-modal="true" aria-label={config.action} className="slik-popup w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">{config.action}</h2><Button variant="ghost" size="icon" aria-label="Close draft" onClick={() => setAdding(false)}><X /></Button></div><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setDrafts((prev) => [...prev, { tab, values: config.fields.map((_, i) => String(f.get(`field${i}`) || "")) }]); setAdding(false); toast.success("Draft prepared — not submitted"); }}>{config.fields.map((f, i) => <label key={f} className="block text-sm text-body">{f}<input className="field mt-1" name={`field${i}`} required /></label>)}<p className="text-xs text-muted-foreground">This prepares a draft only. Nothing is submitted or enforced.</p><Button type="submit" className="w-full"><Check />Prepare draft</Button></form></div></div>}
  </>;
}
