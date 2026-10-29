import { createFileRoute } from "@tanstack/react-router";
import { InternationalServices } from "@/components/slikpay/InternationalServices";

const previewProfile = {
  mode: "sandbox",
  balances: { NGN: 250000, USD: 120.5 },
  receipts: [],
};

export const Route = createFileRoute("/dev-treasury")({
  component: () => (
    <div className="mx-auto max-w-6xl p-6">
      <InternationalServices previewProfile={previewProfile} />
    </div>
  ),
});
