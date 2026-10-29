import { createFileRoute } from "@tanstack/react-router";
import { Escrow } from "@/components/slikpay/Escrow";
import type { EscrowView } from "@/lib/escrow.functions";

const DEALS: EscrowView[] = [
  {
    id: "ESC-1001", reference: "SLKESC-a", title: "Supply of 200 bags of rice", amount: 500000, currency: "NGN",
    buyerName: "Adebayo Tunde", buyerEmail: "buyer@example.com", sellerName: "Kano Grains Ltd", sellerEmail: "seller@example.com",
    milestones: [
      { id: "ms-1", title: "First delivery", amount: 300000, status: "released" },
      { id: "ms-2", title: "Final delivery", amount: 200000, status: "pending" },
    ],
    status: "funded", createdAt: "2026-10-20T10:00:00Z",
  },
  {
    id: "ESC-1002", reference: "SLKESC-b", title: "Website redesign", amount: 1200, currency: "USD",
    buyerName: "Greta Müller", buyerEmail: "g@example.de", sellerName: "Studio Nine", sellerEmail: "s@example.com",
    milestones: [{ id: "ms-1", title: "Full delivery", amount: 1200, status: "pending" }],
    status: "created", createdAt: "2026-10-25T10:00:00Z",
  },
];

export const Route = createFileRoute("/dev-escrow")({
  component: () => (
    <div className="mx-auto max-w-6xl p-6">
      <Escrow preview={{ escrows: DEALS }} />
    </div>
  ),
});
