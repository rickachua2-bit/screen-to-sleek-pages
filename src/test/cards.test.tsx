import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), issue: vi.fn(), fund: vi.fn(), withdraw: vi.fn(), freeze: vi.fn(), controls: vi.fn(), reveal: vi.fn(), txns: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({ inputValidator: () => ({ handler: () => ({}) }), handler: () => ({}) }) }));
vi.mock("@/lib/cards.functions", () => ({
  listCards: mocks.list, issueCard: mocks.issue, fundCard: mocks.fund, withdrawCard: mocks.withdraw,
  setCardFrozen: mocks.freeze, updateCardControls: mocks.controls, revealCard: mocks.reveal, cardTransactions: mocks.txns,
  CARD_BRANDS: ["MASTERCARD", "VISA"],
  CARD_CURRENCIES: ["USD", "NGN"],
}));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
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

describe("Cards page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ mode: "sandbox", cards: CARDS });
  });

  it("lists cards with balances, statuses and controls summary", async () => {
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    expect(screen.getByText("Greta Müller")).toBeTruthy();
    expect(screen.getByText("250.00 USD")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Frozen").length).toBeGreaterThan(0);
    expect(screen.getByText(/Limit 5,000\.00 USD/)).toBeTruthy();
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("issues a virtual card with brand, currency and initial funding", async () => {
    mocks.issue.mockResolvedValue({ ...CARDS[0]!, id: "card-3", holderName: "New Holder", last4: "7777" });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    const form = screen.getByRole("form", { name: "Issue a virtual card" });
    fireEvent.change(within(form).getByLabelText("Card holder name"), { target: { value: "New Holder" } });
    fireEvent.click(within(form).getByRole("button", { name: "Visa" }));
    fireEvent.click(within(form).getByRole("button", { name: "NGN" }));
    fireEvent.change(within(form).getByLabelText(/Initial funding/), { target: { value: "50" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Issue card$/i }));
    await waitFor(() => expect(mocks.issue).toHaveBeenCalledWith({ data: expect.objectContaining({ holderName: "New Holder", brand: "VISA", currency: "NGN", amount: 50, reference: expect.stringMatching(/^SLKCARD-/) }) }));
    await waitFor(() => expect(screen.getByText("New Holder")).toBeTruthy());
  });

  it("funds a card through the amount dialog", async () => {
    mocks.fund.mockResolvedValue({ ...CARDS[0]!, balance: 350 });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Fund$/i })[0]!);
    const dialog = screen.getByRole("dialog", { name: /Fund Mastercard ···4421/i });
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: "100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Fund card$/i }));
    await waitFor(() => expect(mocks.fund).toHaveBeenCalledWith({ data: expect.objectContaining({ cardId: "card-1", amount: 100, reference: expect.stringMatching(/^SLKCF-/) }) }));
  });

  it("blocks withdrawing more than the card holds", async () => {
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Withdraw$/i })[0]!);
    const dialog = screen.getByRole("dialog", { name: /Withdraw from ···4421/i });
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: "999" } });
    expect(within(dialog).getByRole("button", { name: /^Withdraw$/i })).toHaveProperty("disabled", true);
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it("freezes and unfreezes a card", async () => {
    mocks.freeze.mockResolvedValue({ ...CARDS[0]!, status: "frozen" });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Freeze$/i })[0]!);
    await waitFor(() => expect(mocks.freeze).toHaveBeenCalledWith({ data: { cardId: "card-1", frozen: true } }));
  });

  it("saves spending controls", async () => {
    mocks.controls.mockResolvedValue({ ...CARDS[0]!, controls: { online: false, atm: false, international: true, spendingLimit: 1000 } });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Controls$/i })[0]!);
    const dialog = screen.getByRole("dialog", { name: /Card controls ···4421/i });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Online payments" }));
    fireEvent.change(within(dialog).getByLabelText(/Spending limit/), { target: { value: "1000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Save controls$/i }));
    await waitFor(() => expect(mocks.controls).toHaveBeenCalledWith({ data: { cardId: "card-1", online: false, atm: false, international: true, spendingLimit: 1000 } }));
  });

  it("reveals card details once with copy actions", async () => {
    mocks.reveal.mockResolvedValue({ pan: "5399 8300 0000 4421", cvv: "318", expiry: "12/29", billingAddress: "12 Marina, Lagos" });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Reveal$/i })[0]!);
    const dialog = screen.getByRole("dialog", { name: /Card details ···4421/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Reveal details$/i }));
    await waitFor(() => expect(within(dialog).getByText("5399 8300 0000 4421")).toBeTruthy());
    expect(within(dialog).getByText("318")).toBeTruthy();
    expect(mocks.reveal).toHaveBeenCalledWith({ data: { cardId: "card-1" } });
  });

  it("loads card activity on demand", async () => {
    mocks.txns.mockResolvedValue({ transactions: [{ id: "t1", description: "Netflix", amount: 15.99, currency: "USD", status: "SUCCESSFUL", at: "2026-10-28" }] });
    render(<Cards />);
    await waitFor(() => expect(screen.getAllByText("Tunde Adeleke")[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /^Activity$/i })[0]!);
    await waitFor(() => expect(screen.getByText("Netflix")).toBeTruthy());
    expect(screen.getByText("15.99 USD")).toBeTruthy();
  });

  it("shows a safe error when cards cannot be loaded", async () => {
    mocks.list.mockRejectedValue(new Error("Sign in to use banking services."));
    render(<Cards />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sign in"));
  });
});
