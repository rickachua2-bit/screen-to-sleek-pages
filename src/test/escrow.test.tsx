import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), fund: vi.fn(), release: vi.fn(), dispute: vi.fn(), refund: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({ inputValidator: () => ({ handler: () => ({}) }), handler: () => ({}) }) }));
vi.mock("@/lib/escrow.functions", () => ({
  listEscrows: mocks.list, createEscrow: mocks.create, fundEscrow: mocks.fund,
  releaseMilestone: mocks.release, disputeEscrow: mocks.dispute, refundEscrow: mocks.refund,
  ESCROW_CURRENCIES: ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"],
}));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
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

describe("Escrow page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ mode: "sandbox", escrows: DEALS });
  });

  it("lists deals with statuses, milestones and progress", async () => {
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Supply of 200 bags of rice")).toBeTruthy());
    expect(screen.getByText("Website redesign")).toBeTruthy();
    expect(screen.getAllByText("In escrow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Awaiting funding").length).toBeGreaterThan(0);
    expect(screen.getByText("500,000.00 NGN")).toBeTruthy();
    expect(screen.getByText("1 of 2 milestones released")).toBeTruthy();
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("opens a deal with balanced milestones", async () => {
    mocks.create.mockResolvedValue({ ...DEALS[1], id: "ESC-1003", title: "New deal" });
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Supply of 200 bags of rice")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Open an escrow deal" });
    fireEvent.change(within(form).getByLabelText("What is this deal for?"), { target: { value: "New deal" } });
    fireEvent.change(within(form).getByLabelText("Deal amount"), { target: { value: "1000" } });
    fireEvent.change(within(form).getByLabelText("Buyer name"), { target: { value: "Buyer One" } });
    fireEvent.change(within(form).getByLabelText("Buyer email"), { target: { value: "b@example.com" } });
    fireEvent.change(within(form).getByLabelText("Seller name"), { target: { value: "Seller One" } });
    fireEvent.change(within(form).getByLabelText("Seller email"), { target: { value: "s@example.com" } });
    fireEvent.change(within(form).getByLabelText("Milestone 1 amount"), { target: { value: "1000" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Open escrow$/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 1000, currency: "NGN", reference: expect.stringMatching(/^SLKESC-/) }) }));
    await waitFor(() => expect(screen.getByText("New deal")).toBeTruthy());
  });

  it("blocks unbalanced milestones", async () => {
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Supply of 200 bags of rice")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Open an escrow deal" });
    fireEvent.change(within(form).getByLabelText("What is this deal for?"), { target: { value: "Unbalanced deal" } });
    fireEvent.change(within(form).getByLabelText("Deal amount"), { target: { value: "1000" } });
    fireEvent.change(within(form).getByLabelText("Buyer name"), { target: { value: "Buyer One" } });
    fireEvent.change(within(form).getByLabelText("Buyer email"), { target: { value: "b@example.com" } });
    fireEvent.change(within(form).getByLabelText("Seller name"), { target: { value: "Seller One" } });
    fireEvent.change(within(form).getByLabelText("Seller email"), { target: { value: "s@example.com" } });
    fireEvent.change(within(form).getByLabelText("Milestone 1 amount"), { target: { value: "400" } });
    const submit = within(form).getByRole("button", { name: /^Open escrow$/i });
    expect(submit).toHaveProperty("disabled", true);
    expect(within(form).getByText(/Milestones total 400\.00 NGN of 1,000\.00 NGN/)).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("funds a created deal through the confirm dialog", async () => {
    mocks.fund.mockResolvedValue({ ...DEALS[1], status: "funded" });
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Website redesign")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Fund 1,200\.00 USD/i }));
    const dialog = screen.getByRole("dialog", { name: /Lock 1,200\.00 USD into escrow/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(mocks.fund).toHaveBeenCalledWith({ data: { escrowId: "ESC-1002" } }));
  });

  it("releases a pending milestone on a funded deal", async () => {
    mocks.release.mockResolvedValue({ ...DEALS[0], milestones: DEALS[0].milestones.map((m) => ({ ...m, status: "released" as const })), status: "released" });
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Supply of 200 bags of rice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^Release$/i }));
    const dialog = screen.getByRole("dialog", { name: /Release "Final delivery" to the seller/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith({ data: { escrowId: "ESC-1001", milestoneId: "ms-2" } }));
  });

  it("opens a dispute with a reason", async () => {
    mocks.dispute.mockResolvedValue({ ...DEALS[0], status: "disputed" });
    render(<Escrow />);
    await waitFor(() => expect(screen.getByText("Supply of 200 bags of rice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^Dispute$/i }));
    const dialog = screen.getByRole("dialog", { name: /Open a dispute/i });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Goods not delivered" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Open dispute$/i }));
    await waitFor(() => expect(mocks.dispute).toHaveBeenCalledWith({ data: { escrowId: "ESC-1001", reason: "Goods not delivered" } }));
  });

  it("shows a safe error when deals cannot be loaded", async () => {
    mocks.list.mockRejectedValue(new Error("Sign in to use banking services."));
    render(<Escrow />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sign in"));
  });
});
