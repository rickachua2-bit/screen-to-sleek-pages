import { createFileRoute } from "@tanstack/react-router";
import { PaymentLinks } from "@/components/slikpay/PaymentLinks";

export const Route = createFileRoute("/dev-links")({
  component: () => <div className="min-h-screen bg-background p-6"><PaymentLinks /></div>,
});
