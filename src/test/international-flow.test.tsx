import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), send: vi.fn(), reconcile: vi.fn(), crypto: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/international.functions", () => ({ quoteGlobalPayout: mocks.quote, sendGlobalPayout: mocks.send, reconcileGlobalPayoutsFn: mocks.reconcile }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "live", balances: { NGN: 500000 }, receipts: [] }, error: "", refresh: vi.fn() }) }));
vi.mock("@/components/slikpay/CryptoBankFunding", () => ({ CryptoBankFunding: (props: unknown) => { mocks.crypto(props); return <div>Crypto bank form</div>; } }));
import { InternationalServices } from "@/components/slikpay/InternationalServices";

const QUOTE = { country: "US", corridorLabel: "United States", sourceCurrency: "NGN", target: "USD", rate: 1725, recipientGets: 100, principal: 172500, fee: 5000, feeCurrency: "NGN", totalDebit: 177500, minimum: 17.25, rule: "0.5% of the naira amount, minimum ₦5,000" };

const fillForm = () => {
  fireEvent.change(screen.getByLabelText("Recipient account name"), { target: { value: "Ada Obi" } });
  fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "First Bank" } });
  fireEvent.change(screen.getByLabelText("Routing number"), { target: { value: "021000021" } });
  fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "123456789" } });
  fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Transaction PIN"), { target: { value: "1234" } });
};

describe("cross-border payment composer", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.quote.mockResolvedValue(QUOTE); });

  it("quotes the exact fee-inclusive total from live inputs", async () => {
    render(<InternationalServices />);
    fillForm();
    await waitFor(() => expect(mocks.quote).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceCurrency: "NGN", country: "US", amount: 100 }) }));
    await waitFor(() => expect(screen.getAllByText("177,500.00 NGN").length).toBeGreaterThan(0));
  });

  it("sends one payment and reports completion without exposing provider names", async () => {
    mocks.send.mockResolvedValue({ status: "succeeded", reference: "GLB-1", trackingReference: "SWIFT-1", recipientGets: 100, fee: 5000, totalDebit: 177500, destinationCurrency: "USD" });
    render(<InternationalServices />);
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(screen.getByText("Payment completed")).toBeTruthy());
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("maps failures to the safe feedback message", async () => {
    mocks.send.mockRejectedValue(new Error("Incorrect transaction PIN."));
    render(<InternationalServices />);
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(screen.getByText(/Incorrect transaction PIN/i)).toBeTruthy());
  });

  it("routes crypto cash-out to the existing protected flow", () => {
    render(<InternationalServices initial="crypto" />);
    expect(mocks.crypto).toHaveBeenCalledWith({ balances: { NGN: 500000 } });
  });
});
