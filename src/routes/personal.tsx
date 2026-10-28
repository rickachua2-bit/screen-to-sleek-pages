import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PERSONAL_NAV, PERSONAL_TABS, personalModule } from "@/lib/personal";
import { AppShell } from "@/components/slikpay/AppShell";
import { PersonalWorkspace } from "@/components/slikpay/PersonalWorkspace";
import { GoLiveProgress } from "@/components/slikpay/PaddleConsole";
import { ActionModal, type ActionKind } from "@/components/slikpay/ActionModal";

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
  const first = (user?.name ?? "Patrick").split(" ")[0];
  const setModule = (id: string) => navigate({ to: "/personal", search: { module: id } });

  return (
    <AppShell
      mode="personal"
      nav={PERSONAL_NAV}
      activeModule={module}
      onModuleChange={setModule}
      greeting={`Welcome back, ${first} 👋`}
      tierBadge="Tier 2 Verified · ₦5,000,000/day limit"
      onAddMoney={() => setModal("add")}
      bottomNav={PERSONAL_TABS}
    >
      {module === "home" || !module ? <GoLiveProgress role="personal" onOpen={() => setModule("golive")} /> : null}
      <PersonalWorkspace module={module} open={setModal} />
      {modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}
    </AppShell>
  );
}
