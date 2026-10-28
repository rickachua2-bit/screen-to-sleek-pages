import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowUpRight, CreditCard, FileText, Receipt, Send, Smartphone } from "lucide-react";
import { naira, type Account } from "@/lib/api";
import { ConnectionBadge } from "@/components/slikpay/ConnectionBadge";
import { merchantModule, MERCHANT_NAV } from "@/lib/merchant";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/slikpay/AppShell";
import { BalanceCard, NubanCard, Panel, UsdCardPanel } from "@/components/slikpay/Widgets";
import { BarChart, DonutChart } from "@/components/slikpay/Charts";
import { MerchantLedger } from "@/components/slikpay/MerchantLedger";
import { MerchantWorkspace } from "@/components/slikpay/MerchantWorkspace";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({ module: merchantModule(search["module"]) }),
  head: ({ match }) => {
    const label = MERCHANT_NAV.find((n) => n.id === match.search.module)?.label ?? "Business Console";
    const title = `${label} — Slikpay Business`;
    const description = "Slikpay merchant console for collections, commercial banking, treasury and business operations.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: Dashboard,
});
function Dashboard() {
  const { module } = Route.useSearch();
  const navigate = useNavigate();
  const { user, profile, txns } = useAuth();
  const since = Date.now() - 30 * 864e5;
  const inflow30d = txns.filter((t) => t.direction === "credit" && t.status === "Successful" && new Date(t.date).getTime() >= since).reduce((a, t) => a + t.amount, 0);
  const acct: Account = { balance: profile?.wallet_balance ?? 0, nuban: profile?.nuban ?? "—", bank: profile?.bank_name ?? "Sterling Bank", inflow30d, inflowChange: 0 };
  const [modal, setModal] = useState<ActionKind | null>(null);
  const [search, setSearch] = useState("");
  const connected = !!profile;
  const changeModule = (id: string) => { navigate({ to: "/dashboard", search: { module: id } }); };
  const current = MERCHANT_NAV.find((n) => n.id === module);
  return <AppShell mode="merchant" nav={MERCHANT_NAV} activeModule={module} onModuleChange={changeModule} search={search} onSearchChange={setSearch}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-2 text-[10px] font-bold uppercase text-cyan">SLIKPAY BUSINESS / {module === "overview" ? "OVERVIEW" : "WORKSPACE"}</p><h1 className="text-2xl font-extrabold">{current?.label ?? "Dashboard"}</h1><p className="mt-2 text-xs text-muted-foreground">{module === "overview" ? `Welcome back, ${user?.name.split(" ")[0] ?? "there"}. Here’s your business at a glance.` : `${profile?.company_name ?? "Your business"} · Merchant workspace`}</p></div>
      <ConnectionBadge />
    </div>
    {module === "overview" ? <>
      <div className="grid gap-4 xl:grid-cols-3">
        <BalanceCard title="Settlement Balance" balance={acct.balance} sub="Available for settlement" footer={<div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-base font-extrabold">{naira(acct.inflow30d)}</div><div className="mt-1 text-[10px] text-muted-foreground">Total inflow (30 days)</div></div><span className="flex items-center rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold text-success"><ArrowUpRight className="h-3 w-3" />{txns.length} txns</span></div>} />
        <Panel title="Inflow by Channel"><DonutChart /></Panel>
        <Panel title="Inflow 30-Day Trend"><BarChart /></Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2"><div><NubanCard nuban={acct.nuban} /><p className="mt-2 text-[10px] text-muted-foreground">Account status: {connected ? "active" : "profile not loaded"}</p></div><UsdCardPanel onFund={() => setModal("fund")} label="CORPORATE" /></div>
      <div className="flex flex-wrap gap-2">{[{ icon: Send, title: "Send Money", kind: "send" }, { icon: Receipt, title: "Pay Utilities", kind: "bills" }, { icon: CreditCard, title: "Virtual USD Card", kind: "fund" }, { icon: Smartphone, title: "SoftPOS", kind: "softpos" }, { icon: ArrowLeftRight, title: "Currency Swap", kind: "swap" }].map(({ icon: Icon, title, kind }) => <Button key={kind} variant="crisp" className="h-10 rounded-full px-4 text-xs" onClick={() => setModal(kind as ActionKind)}><Icon className="text-cyan" />{title}</Button>)}</div>
      <MerchantLedger txns={txns} globalSearch={search} recent onViewAll={() => changeModule("transactions")} />
      <p className="flex items-center gap-2 text-[10px] text-muted-foreground"><FileText className="h-3 w-3" />Sterling Bank NIP settlement rails · {connected ? (txns.length ? "Live account data" : "No transactions yet") : "Profile not loaded"}</p>
    </> : module === "transactions" ? <MerchantLedger txns={txns} globalSearch={search} /> : <MerchantWorkspace key={module} module={module} account={acct} onAction={setModal} search={search} />}
    {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
  </AppShell>;
}
