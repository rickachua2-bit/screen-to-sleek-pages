import { createFileRoute } from "@tanstack/react-router";
import { SmartTag } from "@/components/slikpay/SmartTag";

export const Route = createFileRoute("/dev-smarttag")({
  component: () => (
    <div className="mx-auto max-w-6xl p-6">
      <SmartTag preview={{
        tags: [
          { handle: "adaeze-kitchen", name: "Adaeze Kitchen — Counter 1", amount: 5000, currency: "NGN", checkoutUrl: "https://pay.example.com/t1", createdAt: "2026-10-01T10:00:00Z" },
          { handle: "table-7", name: "Table 7", amount: null, currency: "NGN", checkoutUrl: null, createdAt: "2026-10-05T10:00:00Z" },
        ],
        charges: [
          { reference: "SLKTAG-1", url: "https://pay.example.com/c1", amount: 2500, currency: "NGN", handle: "table-7", createdAt: "2026-10-06T10:00:00Z", status: "paid" },
          { reference: "SLKTAG-2", url: "https://pay.example.com/c2", amount: 12000, currency: "NGN", handle: "adaeze-kitchen", createdAt: "2026-10-07T10:00:00Z", status: "awaiting" },
        ],
      }} />
    </div>
  ),
});
