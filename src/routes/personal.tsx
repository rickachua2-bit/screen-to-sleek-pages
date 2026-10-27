import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, CreditCard, Gift, Home, PiggyBank, Plus, Receipt, Send, Settings, Smartphone, Zap } from "lucide-react";
import { api, MOCK_ACCOUNT, MOCK_TXNS, naira, type Account, type Txn } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/slikpay/AppShell";
import { BalanceCard, NubanCard, Panel, QuickAction, UsdCardPanel } from "@/components/slikpay/Widgets";
import { DonutChart } from "@/components/slikpay/Charts";
import { TransactionTable } from "@/components/slikpay/TransactionTable";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "Personal Wallet — Slikpay" },
      { name: "description", content: "Your Slikpay wallet: send money, buy airtime, pay bills and shop globally with a USD virtual card." },
      { property: "og:title", content: "Personal Wallet — Slikpay" },
      { property: "og:description", content: "Everyday banking and instant payments with Slikpay Personal." },
    ],
  }),
  component: Personal,
});

const NAV = [
  { label: "Home", icon: Home }, { label: "Transfers", icon: Send }, { label: "Bills & Airtime", icon: Receipt },
  { label: "Cards", icon: CreditCard }, { label: "Savings", icon: PiggyBank }, { label: "Rewards", icon: Gift }, { label: "Settings", icon: Settings },
];

const SPEND = [
  { label: "Transfers", pct: 42, cls: "stroke-cobalt", dot: "bg-cobalt" },
  { label: "Bills", pct: 24, cls: "stroke-navy", dot: "bg-navy" },
  { label: "Shopping", pct: 21, cls: "stroke-magenta", dot: "bg-magenta" },
  { label: "Subscriptions", pct: 13, cls: "stroke-cyan", dot: "bg-cyan" },
];

function Personal() {
  const { user } = useAuth();
  const [acct, setAcct] = useState<Account>(MOCK_ACCOUNT);
  const [txns, setTxns] = useState<Txn[]>(MOCK_TXNS);
  const [modal, setModal] = useState<ActionKind | null>(null);
  useEffect(() => {
    api.accounts().then(setAcct);
    api.transactions(5, 1).then(setTxns);
  }, []);
  const first = (user?.name ?? "Patrick").split(" ")[0];

  return (
    <AppShell mode="personal" nav={NAV} greeting={`Welcome back, ${first}`}>
      <h1 className="text-2xl font-black text-foreground md:hidden">Welcome back, {first}</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <BalanceCard
          title="Personal Wallet Balance"
          balance={acct.balance}
          sub="Available balance"
          footer={
            <div className="flex gap-3">
              <Button variant="brand" onClick={() => setModal("add")}><Plus /> Add Money</Button>
              <Button variant="crisp" onClick={() => setModal("send")}><Send /> Send</Button>
            </div>
          }
        />
        <Panel title="Spending by Category"><DonutChart data={SPEND} center={naira(184500).split(".")[0]!} sub="This month" /></Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <UsdCardPanel label="PERSONAL" note="For Netflix, AWS, Spotify and international shopping." onFund={() => setModal("fund")} />
        <NubanCard nuban={acct.nuban} label="Slikpay Personal" title="Personal Sterling NUBAN" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <QuickAction icon={Send} title="Send Money" sub="To bank or friend" tone="bg-cobalt" onClick={() => setModal("send")} />
        <QuickAction icon={Smartphone} title="Airtime & Data" sub="All networks" tone="bg-gradient-brand" onClick={() => setModal("airtime")} />
        <QuickAction icon={Zap} title="Electricity & TV" sub="Power and cable" tone="bg-magenta/80" onClick={() => setModal("bills")} />
        <QuickAction icon={CreditCard} title="Fund USD Card" sub="Top up in dollars" tone="bg-magenta" onClick={() => setModal("fund")} />
        <QuickAction icon={ArrowLeftRight} title="Fiat-to-Coin Swap" sub="Multi-currency" tone="bg-gradient-tri" onClick={() => setModal("swap")} />
      </div>
      <Panel title="Recent Activity"><TransactionTable txns={txns} /></Panel>
      {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
    </AppShell>
  );
}
