import { useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MERCHANT_NAV } from "@/lib/merchant";
import type { Account } from "@/lib/api";
import type { ActionKind } from "./ActionModal";
import { NubanCard, UsdCardPanel } from "./Widgets";
import { GoLive, PaddleConsole } from "./PaddleConsole";
import { ServicesHub } from "./ServicesHub";
import { KybFlow } from "./KybFlow";

const CONFIG: Record<string, { tabs: string[]; action: string; fields: string[]; columns: string[] }> = {
  softpos: { tabs: ["Terminals", "Cashiers"], action: "Add terminal", fields: ["Terminal name", "Cashier name", "Location"], columns: ["Terminal", "Cashier", "Location"] },
  smarttag: { tabs: ["QR stands", "Soundboxes", "Merchant tag"], action: "Pair hardware", fields: ["Device name", "Serial number", "Location"], columns: ["Device", "Serial number", "Location"] },
  links: { tabs: ["Payment links", "Invoices", "Product catalog"], action: "Create draft", fields: ["Title", "Customer email", "Amount (NGN)"], columns: ["Title", "Customer", "Amount"] },
  mandates: { tabs: ["Mandates", "Billing schedules"], action: "Draft mandate", fields: ["Customer name", "Amount (NGN)", "Billing frequency"], columns: ["Customer", "Amount", "Frequency"] },
  payroll: { tabs: ["Batch payouts", "Beneficiary book"], action: "Add beneficiary draft", fields: ["Beneficiary name", "Bank", "Account number"], columns: ["Beneficiary", "Bank", "Account number"] },
  shifts: { tabs: ["Shifts", "Cashiers", "Reconciliation"], action: "Draft shift", fields: ["Shift name", "Cashier", "Opening till (NGN)"], columns: ["Shift", "Cashier", "Opening till"] },
  disputes: { tabs: ["Open cases", "Evidence", "Resolution timeline"], action: "Prepare evidence", fields: ["Transaction reference", "Case reference", "Evidence summary"], columns: ["Transaction", "Case", "Summary"] },
  approvals: { tabs: ["Pending approvals", "Approval history", "Policies"], action: "Draft policy", fields: ["Policy name", "Payout threshold (NGN)", "Approver"], columns: ["Policy", "Threshold", "Approver"] },
  compliance: { tabs: ["Business verification", "Director KYC", "Account tiers"], action: "Prepare submission", fields: ["Registered business name", "CAC number", "Director name"], columns: ["Business", "CAC number", "Director"] },
  statements: { tabs: ["Bank statements", "Tax exports", "Monthly ledgers"], action: "Draft statement request", fields: ["Account number", "Period from", "Period to"], columns: ["Account", "From", "To"] },
  developer: { tabs: ["API keys", "Webhooks", "Delivery logs"], action: "Draft webhook", fields: ["Endpoint name", "HTTPS callback URL", "Events"], columns: ["Name", "Endpoint", "Events"] },
  settings: { tabs: ["Business profile", "Team members", "Security"], action: "Draft team invitation", fields: ["Full name", "Work email", "Team role"], columns: ["Name", "Email", "Role"] },
};

export function MerchantWorkspace({ module, account, onAction, search = "" }: { module: string; account: Account; onAction: (kind: ActionKind) => void; search?: string }) {
  const item = MERCHANT_NAV.find((n) => n.id === module);
  const config = CONFIG[module];
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<{ values: string[]; tab: number }[]>([]);
  if (!item) return null;
  if (module === "services") return <ServicesHub role="merchant" />;
  if (module.startsWith("svc-")) return <ServicesHub key={module} role="merchant" only={[module.slice(4)]} title={item.label} autoOpen />;
  if (module === "developer") return <PaddleConsole role="merchant" />;
  if (module === "golive") return <KybFlow />;
  if (module === "banking") return <div className="grid gap-5 xl:grid-cols-2"><NubanCard nuban={account.nuban} /><section className="rounded-lg border border-border bg-card p-6"><h2 className="font-bold">Bank settlement</h2><p className="mt-3 text-sm text-muted-foreground">Slikpay · NGN</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => onAction("send")}>Bank transfer</Button><Button variant="crisp" onClick={() => onAction("add")}>Account details</Button></div><p className="mt-6 text-xs text-muted-foreground">Sub-wallets and settlement schedules await your banking service connection.</p></section></div>;
  if (module === "cards") return <><UsdCardPanel onFund={() => onAction("fund")} label="CORPORATE" /><section className="border-t border-border py-6"><h2 className="font-bold">Card controls</h2><p className="mt-2 text-sm text-muted-foreground">NGN issuance, card freeze and spending controls are not connected yet.</p></section></>;
  if (module === "treasury") return <><div className="flex flex-wrap gap-3">{["NGN", "KES", "GHS", "ZAR", "USD", "EUR", "GBP", "USDT"].map((c) => <span key={c} className="rounded-lg border border-border bg-card px-5 py-4 font-mono font-bold">{c}</span>)}</div><section className="border-t border-border py-6"><h2 className="font-bold">Currency exchange</h2><p className="my-3 text-sm text-muted-foreground">Execute an exchange through your connected Slikpay service.</p><Button onClick={() => onAction("swap")}>Open currency swap</Button></section></>;
  if (!config) return null;
  const rows = drafts.filter((d) => d.tab === tab && d.values.join(" ").toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border">
      <div className="flex max-w-full gap-5 overflow-x-auto">{config.tabs.map((t, i) => <Button key={t} variant="ghost" onClick={() => setTab(i)} className={`h-12 rounded-none border-b-2 px-0 ${tab === i ? "border-cyan text-cyan" : "border-transparent text-muted-foreground"}`}>{t}</Button>)}</div>
      <Button className="mb-3" onClick={() => setAdding(true)}><Plus />{config.action}</Button>
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-chart-4" />Not connected · drafts are kept only in this workspace session</div>
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{config.columns.map((c) => <th key={c} className="p-4">{c}</th>)}<th className="p-4">Status</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b border-border">{row.values.map((v, j) => <td key={j} className="p-4">{v}</td>)}<td className="p-4 text-cyan">Draft</td></tr>)}</tbody></table>{!rows.length && <div className="flex flex-col items-center py-16"><item.icon className="mb-4 h-10 w-10 text-cobalt" /><h2 className="font-bold">No {config.tabs[tab]?.toLowerCase()} yet</h2><p className="mt-2 max-w-sm px-4 text-center text-sm text-muted-foreground">Live records will appear when this module is connected.</p></div>}</div>
    {module === "compliance" && <div className="border-t border-border py-4 text-sm text-muted-foreground">CAC verification: not verified · Director KYC: not submitted · Tier limits: awaiting verification</div>}
    {module === "developer" && <div className="flex flex-wrap items-center gap-3 border-t border-border py-4"><code className="text-xs text-cyan">https://business.slikpay.online/api</code><Button variant="ghost" size="icon" aria-label="Copy API URL" onClick={async () => { try { await navigator.clipboard.writeText("https://business.slikpay.online/api"); toast.success("API URL copied"); } catch { toast.error("Copy unavailable"); } }}><Copy /></Button><span className="text-xs text-muted-foreground">Keys and signing secrets must be issued by your Slikpay service.</span></div>}
    {adding && <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={() => setAdding(false)}><div role="dialog" aria-modal="true" aria-label={config.action} className="slik-popup w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">{config.action}</h2><Button variant="ghost" size="icon" aria-label="Close draft" onClick={() => setAdding(false)}><X /></Button></div><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setDrafts((prev) => [...prev, { tab, values: config.fields.map((_, i) => String(f.get(`field${i}`) || "")) }]); setAdding(false); toast.success("Draft prepared — not submitted"); }}>{config.fields.map((f, i) => <label key={f} className="block text-sm text-body">{f}<input className="field mt-1" name={`field${i}`} required /></label>)}<p className="text-xs text-muted-foreground">This prepares a draft only. Nothing is submitted or enforced.</p><Button type="submit" className="w-full"><Check />Prepare draft</Button></form></div></div>}
  </>;
}