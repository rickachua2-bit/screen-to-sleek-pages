import { createFileRoute } from "@tanstack/react-router";
import { DirectDebits } from "@/components/slikpay/DirectDebits";

const DEBITS = [
  { reference: "SLKDD-9f2c", customerName: "Johnathan Edwards", customerEmail: "j@example.com", amount: 250, currency: "USD" as const, description: "October subscription", accountHint: "Acct ···9283", createdAt: "2026-10-01T10:00:00Z", status: "paid" as const },
  { reference: "SLKDD-41ab", customerName: "Greta Müller", customerEmail: "g@example.de", amount: 99, currency: "EUR" as const, description: "", accountHint: "IBAN ···3000", createdAt: "2026-10-05T10:00:00Z", status: "awaiting" as const },
];

export const Route = createFileRoute("/dev-debits")({
  component: () => <main className="mx-auto max-w-6xl p-6"><DirectDebits preview={{ debits: DEBITS }} /></main>,
});
