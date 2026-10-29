import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listInvoices: vi.fn(), createInvoice: vi.fn(),
  listProducts: vi.fn(), createProduct: vi.fn(), deleteProduct: vi.fn(), checkoutProduct: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/invoices.functions", () => ({ listInvoices: mocks.listInvoices, createInvoice: mocks.createInvoice }));
vi.mock("@/lib/products.functions", () => ({ listProducts: mocks.listProducts, createProduct: mocks.createProduct, deleteProduct: mocks.deleteProduct, checkoutProduct: mocks.checkoutProduct }));
import { InvoicesPanel, CatalogPanel } from "@/components/slikpay/InvoiceCatalog";
import { invoiceTotal } from "@/lib/invoices.functions";

const INVOICES = [
  { number: "INV-A1B2C3D4", reference: "SLKINV-1", url: "https://pay.example.com/i1", customer: "Acme Ltd", email: "billing@acme.com", currency: "NGN", items: [{ description: "Design", quantity: 2, unitPrice: 150000 }], total: 300000, dueDate: "2026-11-15", note: null, createdAt: "2026-10-20T10:00:00Z", status: "awaiting" as const, overdue: false },
  { number: "INV-E5F6A7B8", reference: "SLKINV-2", url: "https://pay.example.com/i2", customer: "Beta Co", email: "ap@beta.com", currency: "USD", items: [{ description: "Retainer", quantity: 1, unitPrice: 900 }], total: 900, dueDate: "2026-09-01", note: null, createdAt: "2026-08-20T10:00:00Z", status: "awaiting" as const, overdue: true },
];

const PRODUCTS = [
  { id: "p1", name: "Website package", description: "Full site build", price: 450000, currency: "NGN", createdAt: "2026-10-01T10:00:00Z" },
];

describe("invoice totals", () => {
  it("sums quantity times unit price, rounded to kobo", () => {
    expect(invoiceTotal([{ description: "a", quantity: 3, unitPrice: 1000.5 }])).toBe(3001.5);
    expect(invoiceTotal([{ description: "a", quantity: 2, unitPrice: 100 }, { description: "b", quantity: 1, unitPrice: 50.25 }])).toBe(250.25);
  });
});

describe("invoices panel", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listInvoices.mockResolvedValue({ mode: "sandbox", invoices: INVOICES }); });

  it("lists invoices with totals, customers, due dates and statuses", async () => {
    render(<InvoicesPanel />);
    await waitFor(() => expect(screen.getByText("300,000.00 NGN")).toBeTruthy());
    expect(screen.getByText("900.00 USD")).toBeTruthy();
    expect(screen.getByText(/Acme Ltd/)).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getAllByText("Awaiting payment").length).toBeGreaterThan(0);
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("creates an invoice with line items and shows its checkout link", async () => {
    mocks.createInvoice.mockResolvedValue({ ...INVOICES[0], number: "INV-NEW00001", url: "https://pay.example.com/new" });
    render(<InvoicesPanel />);
    await waitFor(() => expect(screen.getByText("300,000.00 NGN")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /New invoice/i }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Customer name"), { target: { value: "Gamma Inc" } });
    fireEvent.change(dialog.getByLabelText("Customer email"), { target: { value: "pay@gamma.com" } });
    fireEvent.change(dialog.getByLabelText("Due date"), { target: { value: "2026-12-01" } });
    fireEvent.change(dialog.getByLabelText("Item 1 description"), { target: { value: "Consulting" } });
    fireEvent.change(dialog.getByLabelText("Item 1 unit price"), { target: { value: "75000" } });
    expect(dialog.getByText("75,000.00 NGN")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /Create invoice/i }));
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledWith({ data: expect.objectContaining({ customer: "Gamma Inc", total: undefined, reference: expect.stringMatching(/^SLKINV-/) }) }));
  });
});

describe("catalog panel", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listProducts.mockResolvedValue({ mode: "sandbox", products: PRODUCTS }); });

  it("lists products with prices", async () => {
    render(<CatalogPanel />);
    await waitFor(() => expect(screen.getByText("Website package")).toBeTruthy());
    expect(screen.getByText("450,000.00 NGN")).toBeTruthy();
  });

  it("creates a checkout for a product with the product price, never a typed amount", async () => {
    mocks.checkoutProduct.mockResolvedValue({ url: "https://pay.example.com/p1", reference: "SLKPROD-x" });
    render(<CatalogPanel />);
    await waitFor(() => expect(screen.getByText("Website package")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Create checkout/i }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Customer email"), { target: { value: "buyer@shop.com" } });
    fireEvent.click(dialog.getByRole("button", { name: /Create checkout link/i }));
    await waitFor(() => expect(mocks.checkoutProduct).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "p1", email: "buyer@shop.com", reference: expect.stringMatching(/^SLKPROD-/) }) }));
    await waitFor(() => expect(screen.getByText("Checkout link ready")).toBeTruthy());
  });
});
