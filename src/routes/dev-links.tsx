import { createFileRoute } from "@tanstack/react-router";
import { PaymentLinks } from "@/components/slikpay/PaymentLinks";

const previewLinks = [
  { reference: "SLKLINK-9f2c1a", url: "https://pay.slikpay.online/l/9f2c1a", amount: 25000, currency: "NGN", email: "ada@example.com", name: "Ada Obi", createdAt: "2026-10-01T10:00:00Z", status: "paid" as const },
  { reference: "SLKLINK-71bd42", url: "https://pay.slikpay.online/l/71bd42", amount: 120, currency: "USD", email: "sam@example.com", name: null, createdAt: "2026-10-05T10:00:00Z", status: "awaiting" as const },
  { reference: "SLKLINK-c30e88", url: "https://pay.slikpay.online/l/c30e88", amount: 8450.5, currency: "GHS", email: "kofi@example.com", name: "Kofi Mensah", createdAt: "2026-10-12T10:00:00Z", status: "unknown" as const },
];

export const Route = createFileRoute("/dev-links")({
  component: () => (
    <div className="mx-auto max-w-6xl p-6">
      <PaymentLinks previewLinks={previewLinks} />
    </div>
  ),
});
