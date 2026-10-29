import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins, CreditCard, Plane, Plus, Receipt, Send, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PERSONAL_NAV, PERSONAL_TABS, personalModule } from "@/lib/personal";
import { AppShell } from "@/components/slikpay/AppShell";
import { PersonalWorkspace } from "@/components/slikpay/PersonalWorkspace";
import { GoLiveProgress, useBankingProfile } from "@/components/slikpay/PaddleConsole";
import { personalTier } from "@/lib/go-live";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";
import { QuickActionFab, type QuickItem } from "@/components/slikpay/DashboardPlus";

export const Route = createFileRoute("/personal")({
  validateSearch: (s: Record<string, unknown>) => ({ module: personalModule(s["module"]) }),
  head: () => ({
    meta: [
      { title: "Personal Wallet — Slikpay" },
      { name: "description", content: "Your Slikpay wallet: send money, buy airtime, pay bills, save with Ajo and shop globally with a USD virtual card." },
      { property: "og:title", content: "Personal Wallet — Slikpay" },
      { property: "og:description", content: "Everyday banking and instant payments with Slikpay Personal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Personal,
});

function Personal() {
  const { user, refresh: authRefresh } = useAuth();
  const { module } = Route.useSearch();
  const navigate = useNavigate();
  const [modal, setModal] = useState<ActionKind | null>(null);
  const first = (user?.name ?? "there").split(" ")[0];
  const { profile: banking } = useBankingProfile();
  const tier = personalTier(banking?.kyc ?? []);
  const tierText = tier ? `Tier ${tier} Verified` : "Verification not started";
  const setModule = (id: string) => navigate({ to: "/personal", search: { module: id } });

  const personalQuick: QuickItem[] = [
    { label: "Send Money", sub: "Instant NIP or @SlikTag transfer", badge: "Instant", icon: Send, run: () => setModal("send") },
    { label: "Add Money", sub: "Fund wallet via instant NUBAN", icon: Plus, run: () => setModal("add") },
    { label: "Pay Bills", sub: "Airtime, internet, power & betting", icon: Receipt, run: () => setModal("bills") },
    { label: "Book Flights", sub: "450+ airlines & instant PNR", badge: "Wholesale", icon: Plane, run: () => setModule("flights") },
    { label: "Virtual USD Card", sub: "Shop globally with zero limits", badge: "USD", icon: CreditCard, run: () => setModule("cards") },
    { label: "Ajo Daily Savings", sub: "Earn high-yield daily returns", badge: "Yield", icon: Coins, run: () => setModule("ajo") },
  ];

  return (
    <AppShell
      mode="personal"
      nav={PERSONAL_NAV}
      activeModule={module}
      onModuleChange={setModule}
      greeting={`Welcome back, ${first} 👋`}
      tierBadge={tierText}
      onAddMoney={() => setModal("add")}
      onRefresh={authRefresh}
      bottomNav={PERSONAL_TABS}
    >
      {module === "home" || !module ? <GoLiveProgress role="personal" onOpen={() => setModule("golive")} /> : null}
      <PersonalWorkspace module={module} open={setModal} />
      {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
      <QuickActionFab items={personalQuick} raised />
    </AppShell>
  );
}
