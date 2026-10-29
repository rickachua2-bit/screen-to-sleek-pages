import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), charge: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({ inputValidator: () => ({ handler: () => ({}) }), handler: () => ({}) }) }));
vi.mock("@/lib/smarttag.functions", () => ({
  listSmartTags: mocks.list, createSmartTag: mocks.create, chargeSmartTag: mocks.charge,
  tagUrl: (h: string) => `https://pay.slikpay.africa/@${h}`,
}));
vi.mock("@/lib/checkout-links.server", () => ({ LINK_CURRENCIES: ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
import { SmartTag } from "@/components/slikpay/SmartTag";

const TAGS = [
  { handle: "adaeze-kitchen", name: "Adaeze Kitchen — Counter 1", amount: 5000, currency: "NGN", checkoutUrl: "https://pay.example.com/t1", createdAt: "2026-10-01T10:00:00Z" },
  { handle: "table-7", name: "Table 7", amount: null, currency: "NGN", checkoutUrl: null, createdAt: "2026-10-05T10:00:00Z" },
];
const CHARGES = [
  { reference: "SLKTAG-1", url: "https://pay.example.com/c1", amount: 2500, currency: "NGN", handle: "table-7", createdAt: "2026-10-06T10:00:00Z", status: "paid" as const },
];

describe("QR & SmartTag page", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({ mode: "sandbox", tags: TAGS, charges: CHARGES }); });

  it("lists tags with fixed/open amounts and live charge statuses", async () => {
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    expect(screen.getByText("@table-7")).toBeTruthy();
    expect(screen.getByText(/Fixed · 5,000.00 NGN/)).toBeTruthy();
    expect(screen.getByText(/Open amount · NGN/)).toBeTruthy();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("creates a tag through the server function", async () => {
    mocks.create.mockResolvedValue({ handle: "new-stand", name: "New Stand", amount: null, currency: "NGN", checkoutUrl: null, createdAt: "2026-10-29T00:00:00Z" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Create SmartTag" });
    fireEvent.change(within(form).getByLabelText("Display name"), { target: { value: "New Stand" } });
    fireEvent.change(within(form).getByLabelText("Tag name"), { target: { value: "new-stand" } });
    fireEvent.change(within(form).getByLabelText("Contact email"), { target: { value: "ada@example.com" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Create SmartTag$/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ handle: "new-stand", name: "New Stand", currency: "NGN" }) }));
    await waitFor(() => expect(screen.getByText("@new-stand")).toBeTruthy());
  });

  it("charges an open-amount tag and shows the payment QR", async () => {
    mocks.charge.mockResolvedValue({ reference: "SLKTAG-new", url: "https://pay.example.com/new", amount: 1500, currency: "NGN", handle: "table-7", createdAt: "2026-10-29T00:00:00Z", status: "awaiting" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@table-7")).toBeTruthy());
    const card = screen.getByText("@table-7").closest("li")!;
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "New charge" }));
    const dialog = await screen.findByRole("dialog", { name: "Charge @table-7" });
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: "1500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Start charge$/i }));
    await waitFor(() => expect(mocks.charge).toHaveBeenCalledWith({ data: expect.objectContaining({ handle: "table-7", amount: 1500, reference: expect.stringMatching(/^SLKTAG-/) }) }));
    await waitFor(() => expect(screen.getByText(/Charge ready — 1,500.00 NGN/)).toBeTruthy());
  });

  it("shows the safe error when loading fails", async () => {
    mocks.list.mockRejectedValue(new Error("Your SmartTags could not be loaded. Try again."));
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
  });

  it("renders the QR stand builder and the soundbox empty state", async () => {
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /QR stands/i }));
    await waitFor(() => expect(screen.getByText("Printable QR stand")).toBeTruthy());
    expect(screen.getByLabelText("QR stand preview for @adaeze-kitchen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Soundboxes/i }));
    await waitFor(() => expect(screen.getByText("Soundboxes are not connected yet")).toBeTruthy());
  });
});
