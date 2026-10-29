import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({ inputValidator: () => ({ handler: () => ({}) }), handler: () => ({}) }) }));
vi.mock("@/lib/mandates.functions", () => ({
  listDirectDebits: mocks.list, createDirectDebit: mocks.create,
  DEBIT_CURRENCIES: ["USD", "EUR", "GBP"],
}));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
import { DirectDebits } from "@/components/slikpay/DirectDebits";

const DEBITS = [
  { reference: "SLKDD-1", customerName: "Johnathan Edwards", customerEmail: "j@example.com", amount: 250, currency: "USD", description: "October subscription", accountHint: "Acct ···9283", createdAt: "2026-10-01T10:00:00Z", status: "paid" as const },
  { reference: "SLKDD-2", customerName: "Greta Müller", customerEmail: "g@example.de", amount: 99, currency: "EUR", description: "", accountHint: "IBAN ···3000", createdAt: "2026-10-05T10:00:00Z", status: "awaiting" as const },
];

describe("Direct debits page", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({ mode: "sandbox", debits: DEBITS }); });

  it("lists debits with live statuses and stats", async () => {
    render(<DirectDebits />);
    await waitFor(() => expect(screen.getByText("Johnathan Edwards")).toBeTruthy());
    expect(screen.getByText("Greta Müller")).toBeTruthy();
    expect(screen.getAllByText("Collected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
    expect(screen.getByText("250.00 USD")).toBeTruthy();
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("collects a US ACH debit with routing and account number", async () => {
    mocks.create.mockResolvedValue({ reference: "SLKDD-3", customerName: "New Customer", customerEmail: "n@example.com", amount: 150, currency: "USD", description: "", accountHint: "Acct ···9283", createdAt: "2026-10-29T00:00:00Z", status: "awaiting" });
    render(<DirectDebits />);
    await waitFor(() => expect(screen.getByText("Johnathan Edwards")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Collect a direct debit" });
    fireEvent.change(within(form).getByLabelText("Customer name"), { target: { value: "New Customer" } });
    fireEvent.change(within(form).getByLabelText("Customer email"), { target: { value: "n@example.com" } });
    fireEvent.change(within(form).getByLabelText("Amount"), { target: { value: "150" } });
    fireEvent.change(within(form).getByLabelText("Routing number"), { target: { value: "021000021" } });
    fireEvent.change(within(form).getByLabelText("Account number"), { target: { value: "0284719283" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Collect now$/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ currency: "USD", amount: 150, routingNumber: "021000021", accountNumber: "0284719283", reference: expect.stringMatching(/^SLKDD-/) }) }));
    await waitFor(() => expect(screen.getByText("New Customer")).toBeTruthy());
  });

  it("asks for an IBAN on EU SEPA debits and blocks invalid ones", async () => {
    render(<DirectDebits />);
    await waitFor(() => expect(screen.getByText("Johnathan Edwards")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Collect a direct debit" });
    fireEvent.click(within(form).getByRole("button", { name: /EUR/ }));
    expect(within(form).getByLabelText("Customer IBAN")).toBeTruthy();
    fireEvent.change(within(form).getByLabelText("Customer name"), { target: { value: "Greta Müller" } });
    fireEvent.change(within(form).getByLabelText("Customer email"), { target: { value: "g@example.de" } });
    fireEvent.change(within(form).getByLabelText("Amount"), { target: { value: "99" } });
    fireEvent.change(within(form).getByLabelText("Customer IBAN"), { target: { value: "INVALID" } });
    expect((within(form).getByRole("button", { name: /^Collect now$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("shows the safe error when loading fails", async () => {
    mocks.list.mockRejectedValue(new Error("Your direct debits could not be loaded. Try again."));
    render(<DirectDebits />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
  });

  it("marks recurring billing schedules as not connected", async () => {
    render(<DirectDebits />);
    await waitFor(() => expect(screen.getByText("Johnathan Edwards")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Billing schedules/i }));
    await waitFor(() => expect(screen.getByText("Recurring schedules are not connected yet")).toBeTruthy());
  });
});
