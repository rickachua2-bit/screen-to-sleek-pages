import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/payment-links.functions", () => ({ listPaymentLinks: mocks.list, createPaymentLink: mocks.create }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
import { PaymentLinks } from "@/components/slikpay/PaymentLinks";

const LINKS = [
  { reference: "SLKLINK-1", url: "https://pay.example.com/a", amount: 25000, currency: "NGN", email: "ada@example.com", name: "Ada Obi", createdAt: "2026-10-01T10:00:00Z", status: "paid" as const },
  { reference: "SLKLINK-2", url: "https://pay.example.com/b", amount: 120, currency: "USD", email: "sam@example.com", name: null, createdAt: "2026-10-05T10:00:00Z", status: "awaiting" as const },
];

describe("payment links page", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({ mode: "sandbox", links: LINKS }); });

  it("lists created links with amounts, customers and live statuses", async () => {
    render(<PaymentLinks />);
    await waitFor(() => expect(screen.getByText("25,000.00 NGN")).toBeTruthy());
    expect(screen.getByText("120.00 USD")).toBeTruthy();
    expect(screen.getByText(/Ada Obi/)).toBeTruthy();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Awaiting payment").length).toBeGreaterThan(0);
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("creates a link through the server function with a unique reference", async () => {
    mocks.create.mockResolvedValue({ ...LINKS[0], reference: "SLKLINK-new", url: "https://pay.example.com/new", status: "awaiting" });
    render(<PaymentLinks />);
    await waitFor(() => expect(screen.getByText("25,000.00 NGN")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Create link/i }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Customer email"), { target: { value: "buyer@example.com" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Create link$/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 5000, currency: "NGN", email: "buyer@example.com", reference: expect.stringMatching(/^SLKLINK-/) }) }));
    await waitFor(() => expect(screen.getByText("Your payment link is ready")).toBeTruthy());
    expect(screen.getByText("https://pay.example.com/new")).toBeTruthy();
  });

  it("shows the safe error when loading fails", async () => {
    mocks.list.mockRejectedValue(new Error("Your payment links could not be loaded. Try again."));
    render(<PaymentLinks />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
  });

  it("keeps invoices and catalog clearly marked as not connected", async () => {
    render(<PaymentLinks />);
    fireEvent.click(screen.getByRole("button", { name: /Invoices/i }));
    expect(screen.getByText("Not connected yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Product catalog/i }));
    expect(screen.getByText("Not connected yet")).toBeTruthy();
  });
});
