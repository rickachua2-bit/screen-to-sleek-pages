import { createFileRoute } from "@tanstack/react-router";
import { CatalogPanel, InvoicesPanel } from "@/components/slikpay/InvoiceCatalog";

const previewInvoices = [
  { number: "INV-A1B2C3D4", reference: "SLKINV-1", url: "https://pay.slikpay.online/i/a1b2c3d4", customer: "Acme Ltd", email: "billing@acme.com", currency: "NGN", items: [{ description: "Brand design", quantity: 2, unitPrice: 150000 }], total: 300000, dueDate: "2026-11-15", note: null, createdAt: "2026-10-20T10:00:00Z", status: "awaiting" as const, overdue: false },
  { number: "INV-E5F6A7B8", reference: "SLKINV-2", url: "https://pay.slikpay.online/i/e5f6a7b8", customer: "Beta Co", email: "ap@beta.com", currency: "USD", items: [{ description: "Monthly retainer", quantity: 1, unitPrice: 900 }], total: 900, dueDate: "2026-09-01", note: null, createdAt: "2026-08-20T10:00:00Z", status: "awaiting" as const, overdue: true },
  { number: "INV-C9D0E1F2", reference: "SLKINV-3", url: "https://pay.slikpay.online/i/c9d0e1f2", customer: "Kofi Mensah", email: "kofi@example.com", currency: "GHS", items: [{ description: "Consulting", quantity: 5, unitPrice: 1200 }], total: 6000, dueDate: "2026-10-01", note: null, createdAt: "2026-09-15T10:00:00Z", status: "paid" as const, overdue: false },
];

const previewProducts = [
  { id: "p1", name: "Website design package", description: "Full responsive site, copy and launch support", price: 450000, currency: "NGN", createdAt: "2026-10-01T10:00:00Z" },
  { id: "p2", name: "Monthly retainer", description: null, price: 900, currency: "USD", createdAt: "2026-10-05T10:00:00Z" },
  { id: "p3", name: "Social media kit", description: "30 branded templates for launch month", price: 75000, currency: "NGN", createdAt: "2026-10-12T10:00:00Z" },
];

export const Route = createFileRoute("/dev-links")({
  component: () => (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      <InvoicesPanel previewInvoices={previewInvoices} />
      <CatalogPanel previewProducts={previewProducts} />
    </div>
  ),
});
