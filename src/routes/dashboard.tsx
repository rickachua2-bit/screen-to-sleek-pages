import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowUpRight, CreditCard, FileText, Receipt, Send, Smartphone } from "lucide-react";
import { naira, type Account } from "@/lib/api";
import { ConnectionBadge } from "@/components/slikpay/ConnectionBadge";
import { merchantModule, MERCHANT_NAV } from "@/lib/merchant";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/slikpay/AppShell";
import { Panel, UsdCardPanel } from "@/components/slikpay/Widgets";
import { BarChart, CHANNEL_STYLES, DonutChart } from "@/components/slikpay/Charts";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GoLiveProgress, useBankingProfile } from "@/components/slikpay/PaddleConsole";
import { runPaddleOperation } from "@/lib/paddle.functions";
import { MerchantLedger } from "@/components/slikpay/MerchantLedger";
import { MerchantWorkspace } from "@/components/slikpay/MerchantWorkspace";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency-store";
import { CurrencyWallet } from "@/components/slikpay/CurrencyWallet";
import { ActivityFeed, CommandPalette, CustomiseButton, DashboardHero, EmptyState, FlipNubanCard, InsightsStrip, QuickActionFab, merchantQuickActions, useTiles } from "@/components/slikpay/DashboardPlus";
import { ArrowRightLeft, BarChart3, LayoutDashboard, Rocket, Settings } from "lucide-react";

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
  const { user, profile, txns, refresh: authRefresh } = useAuth();
  const since = Date.now() - 30 * 864e5;
  const inflow30d = txns.filter((t) => t.direction === "credit" && t.status === "Successful" && new Date(t.date).getTime() >= since).reduce((a, t) => a + t.amount, 0);
  const { profile: banking, refresh } = useBankingProfile();
  const issue = useServerFn(runPaddleOperation);
  const [issuing, setIssuing] = useState(false);
  const credits = txns.filter((t) => t.direction === "credit" && t.status === "Successful" && new Date(t.date).getTime() >= since);
  const byChannel = Object.entries(credits.reduce<Record<string, number>>((m, t) => ({ ...m, [t.channel]: (m[t.channel] ?? 0) + t.amount }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const donut = byChannel.map(([label, v], i) => ({ label, pct: Math.round(v / inflow30d * 1000) / 10, ...CHANNEL_STYLES[i]! }));
  const days = Array.from({ length: 15 }, (_, i) => { const start = since + i * 2 * 864e5; const d = new Date(start); return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: credits.filter((t) => { const x = new Date(t.date).getTime(); return x >= start && x < start + 2 * 864e5; }).reduce((a, t) => a + t.amount, 0) }; });
  const issueAccount = async () => {
    setIssuing(true);
    try { await issue({ data: { id: "post-accounts-virtual", params: {}, body: { accountName: profile?.company_name ?? user?.name ?? "Slikpay Business", accountType: "corporate", bank: "sterling" }, idempotencyKey: crypto.randomUUID(), currency: "NGN" } }); toast.success("Account number issued"); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not issue account"); }
    finally { setIssuing(false); }
  };
  const acct: Account = { balance: banking?.balances["NGN"] ?? 0, nuban: banking?.virtualAccount ?? "", bank: "Slikpay", inflow30d, inflowChange: 0 };
  const [modal, setModal] = useState<ActionKind | null>(null);
  const [search, setSearch] = useState("");
  const connected = !!profile;
  const changeModule = (id: string) => { navigate({ to: "/dashboard", search: { module: id } }); };
  const current = MERCHANT_NAV.find((n) => n.id === module);
  const [cmd, setCmd] = useState(false);
  const currency = useCurrency();
  const tiles = useTiles(user?.id);
  const quick = merchantQuickActions(setModal, changeModule, () => { void Promise.all([refresh(), authRefresh()]).then(() => toast.success("Dashboard refreshed")); });
  const bottomNav = [{ label: "Home", icon: LayoutDashboard, id: "overview" }, { label: "Ledger", icon: ArrowRightLeft, id: "transactions" }, { label: "Go Live", icon: Rocket, id: "golive" }, { label: "Settings", icon: Settings, id: "settings" }];
  return <AppShell mode="merchant" nav={MERCHANT_NAV} activeModule={module} onModuleChange={changeModule} search={search} onSearchChange={setSearch} onRefresh={authRefresh} bottomNav={bottomNav}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-2 text-[10px] font-bold uppercase text-cyan">SLIKPAY BUSINESS / {module === "overview" ? "OVERVIEW" : "WORKSPACE"}</p><h1 className="text-2xl font-extrabold">{current?.label ?? "Dashboard"}</h1>{module !== "overview" && <p className="mt-2 text-xs text-muted-foreground">{profile?.company_name ?? "Your business"} · Merchant workspace</p>}</div>
      <div className="flex items-center gap-2">{module === "overview" && <CustomiseButton tiles={tiles} />}<ConnectionBadge /></div>
    </div>
    {module === "overview" ? <>
      {currency === "NGN" && <DashboardHero name={user?.name ?? "there"} business={profile?.company_name} balance={acct.balance} mode={banking?.mode} txns={txns} onOpenCommand={() => setCmd(true)} onGoLive={() => changeModule("golive")} />}
      {currency === "NGN" && <CurrencyWallet code="NGN" mode={banking?.mode} onNavigate={changeModule} compact />}
      <GoLiveProgress role="merchant" onOpen={() => changeModule("golive")} />
      {tiles.show("insights") && <InsightsStrip txns={txns} />}
      <div className="grid gap-4 xl:grid-cols-3">
        {tiles.show("charts") && <><Panel title="Inflow 30-Day Trend" className="hover-lift xl:col-span-2"><BarChart days={days} /></Panel>
        <Panel title="Inflow by Channel" className="hover-lift">{donut.length ? <DonutChart data={donut} center={naira(inflow30d)} /> : <EmptyState icon={BarChart3} title="No inflow yet" text="Your channel mix shows up after your first payment." />}</Panel></>}
        {tiles.show("activity") && <div className="xl:col-span-1 xl:row-span-2"><ActivityFeed txns={txns} onViewAll={() => changeModule("transactions")} /></div>}
        {tiles.show("accounts") && <><div className="hover-lift rounded-2xl">{banking?.virtualAccount ? <FlipNubanCard nuban={banking.virtualAccount} sandbox={banking.mode !== "live"} accountName={banking.accountDetails?.accountName ?? profile?.company_name} bankName={banking.accountDetails?.bankName} status={banking.accountDetails?.status} /> : <Panel title="Dedicated Account Number"><p className="text-sm text-muted-foreground">You don't have an account number yet. Issue one to start receiving payments{banking?.mode === "sandbox" ? " (sandbox)" : ""}.</p><Button variant="brand" className="mt-4" disabled={issuing || !banking} onClick={issueAccount}>{issuing && <Loader2 className="animate-spin" />}Issue my account number</Button></Panel>}</div>
        <div className="hover-lift rounded-2xl"><UsdCardPanel onFund={() => changeModule("services")} label="CORPORATE" note={banking?.cardIssued ? undefined : "No card issued yet — issue one in All Banking Services."} /></div></>}
      </div>
      <div className="flex flex-wrap gap-2.5">{[{ icon: Send, title: "Send Money", kind: "send", tint: "tint-cobalt" }, { icon: Receipt, title: "Pay Utilities", kind: "bills", tint: "tint-magenta" }, { icon: CreditCard, title: "Virtual USD Card", kind: "fund", tint: "tint-cyan" }, { icon: Smartphone, title: "SoftPOS", kind: "softpos", tint: "tint-cobalt" }, { icon: ArrowLeftRight, title: "Currency Swap", kind: "swap", tint: "tint-cyan" }].map(({ icon: Icon, title, kind, tint }) => <button key={kind} type="button" className="quick-chip flex h-11 items-center gap-2.5 rounded-full py-0 pl-1.5 pr-4 text-xs font-extrabold text-foreground" onClick={() => setModal(kind as ActionKind)}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${tint}`}><Icon className="h-4 w-4" strokeWidth={2.2} /></span>{title}</button>)}</div>
      {tiles.show("ledger") && <MerchantLedger txns={txns} globalSearch={search} recent onViewAll={() => changeModule("transactions")} />}
      <p className="flex items-center gap-2 text-[10px] text-muted-foreground"><FileText className="h-3 w-3" />Instant NIP settlement · {connected ? (txns.length ? "Live account data" : "No transactions yet") : "Profile not loaded"} · Balance <ArrowUpRight className="h-3 w-3" />{txns.length} txns</p>
    </> : module === "transactions" ? <MerchantLedger txns={txns} globalSearch={search} /> : <MerchantWorkspace key={module} module={module} account={acct} onAction={setModal} search={search} />}
    {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
    <QuickActionFab items={quick} raised />
    <CommandPalette open={cmd} onOpenChange={setCmd} actions={quick} go={changeModule} txns={txns} />
  </AppShell>;
}
