import { createFileRoute } from "@tanstack/react-router";
import { Cards } from "@/components/slikpay/Cards";
import type { CardView } from "@/lib/cards.functions";

const CARDS: CardView[] = [
  {
    id: "card-1", holderName: "Tunde Adeleke", brand: "MASTERCARD", currency: "USD", balance: 250,
    last4: "4421", status: "active", controls: { online: true, atm: false, international: true, spendingLimit: 5000 }, createdAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "card-2", holderName: "Greta Müller", brand: "VISA", currency: "NGN", balance: 0,
    last4: "9908", status: "frozen", controls: { online: false, atm: false, international: false, spendingLimit: 100000 }, createdAt: "2026-10-10T10:00:00Z",
  },
];

export const Route = createFileRoute("/dev-cards")({
  component: () => (
    <div className="mx-auto max-w-6xl p-6">
      <Cards preview={{ cards: CARDS }} />
    </div>
  ),
});
