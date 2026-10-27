import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftRight, ArrowUpRight, BarChart3, CreditCard, Download, FileText, Globe, HandCoins, LayoutDashboard,
  Receipt, Send, Settings, Smartphone, Users, Wallet,
} from "lucide-react";
import { api, exportTransactionsCsv, MOCK_ACCOUNT, MOCK_TXNS, naira, type Account, type Txn } from "@/lib/api";
import { AppShell } from "@/components/slikpay/AppShell";
import { BalanceCard, NubanCard, Panel, QuickAction, UsdCardPanel } from "@/components/slikpay/Widgets";
import { BarChart, DonutChart } from "@/components/slikpay/Charts";
import { TransactionTable } from "@/components/slikpay/TransactionTable";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Business Console — Slikpay" },
      { name: "description", content: "Settlement balance, inflows, dedicated NUBAN, USD treasury card and transaction ledger for Slikpay merchants." },
      { property: "og:title", content: "Business Console — Slikpay" },
      { property: "og:description", content: "Institutional banking console for Slikpay Business merchants." },
    ],
  }),
  component: Dashboard,
});

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard }, { label: "Transactions", icon: ArrowLeftRight },
  { label: "Payments", icon: Send }, { label: "Receivables", icon: HandCoins }, { label: "Cards", icon: CreditCard },
  { label: "POS & Devices", icon: Smartphone }, { label: "Forex & Treasury", icon: Globe }, { label: "Reports", icon: BarChart3 },
  { label: "Beneficiaries", icon: Users }, { label: "Settings", icon: Settings },
];

function Dashboard() {
  const [acct, setAcct] = useState<Account>(MOCK_ACCOUNT);
  const [txns, setTxns] = useState<Txn[]>(MOCK_TXNS);
  const [modal, setModal] = useState<ActionKind | null>(null);

  useEffect(() => {
    api.accounts().then(setAcct);
    api.transactions(20, 1).then(setTxns);
  }, []);

  return (
    <AppShell mode="merchant" nav={NAV}>
      <div className="grid gap-5 lg:grid-cols-3">
        <BalanceCard
          title="Settlement Balance"
          balance={acct.balance}
          sub="Available for settlement"
          footer={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-extrabold text-foreground">{naira(acct.inflow30d)}</div>
                <div className="text-xs font-semibold text-muted-foreground">Total inflow (30 days)</div>
              </div>
              <span className="flex items-center gap-0.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success"><ArrowUpRight className="h-3 w-3" />+{acct.inflowChange}%</span>
            </div>
          }
        />
        <Panel title="Inflow by Channel"><DonutChart /></Panel>
        <Panel title="Inflow Trend"><BarChart /></Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <NubanCard nuban={acct.nuban} />
        <UsdCardPanel onFund={() => setModal("fund")} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <QuickAction icon={Send} title="Send Money" sub="To beneficiaries" tone="bg-cobalt" onClick={() => setModal("send")} />
        <QuickAction icon={Receipt} title="Pay Utilities" sub="Bills and services" tone="bg-magenta/80" onClick={() => setModal("bills")} />
        <QuickAction icon={CreditCard} title="Virtual Dollar Card" sub="Shop and pay globally" tone="bg-magenta" onClick={() => setModal("fund")} />
        <QuickAction icon={Smartphone} title="SoftPOS" sub="Accept payments" tone="bg-gradient-brand" onClick={() => setModal("softpos")} />
        <QuickAction icon={ArrowLeftRight} title="Currency Swap" sub="Convert currencies" tone="bg-gradient-tri" onClick={() => setModal("swap")} />
      </div>

      <Panel
        title="Recent Transactions"
        action={
          <div className="flex items-center gap-3">
            <Button variant="crisp" size="sm" onClick={() => exportTransactionsCsv(txns)}><Download /> Export CSV</Button>
            <span className="text-sm font-bold text-cobalt">View all →</span>
          </div>
        }
      >
        <TransactionTable txns={txns} />
      </Panel>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileText className="h-3.5 w-3.5" /><Wallet className="h-3.5 w-3.5" /> Settled via Sterling Bank NIP rails. Licensed by the CBN.</p>
      {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
    </AppShell>
  );
}
