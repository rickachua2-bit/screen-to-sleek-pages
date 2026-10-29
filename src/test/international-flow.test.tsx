import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), send: vi.fn(), reconcile: vi.fn(), crypto: vi.fn(), balances: { NGN: 500000 } as Record<string, number> }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/international.functions", () => ({ quoteGlobalPayout: mocks.quote, sendGlobalPayout: mocks.send, reconcileGlobalPayoutsFn: mocks.reconcile }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "live", balances: mocks.balances, receipts: [] }, error: "", refresh: async () => {} }) }));
vi.mock("@/components/slikpay/CryptoBankFunding", () => ({ CryptoBankFunding: (props: unknown) => { mocks.crypto(props); return <div>Crypto bank form</div>; } }));
vi.mock("@/components/slikpay/InternationalAccounts", () => ({ ReceiveAccounts: () => <div>Receive</div>, HoldBalances: () => <div>Hold</div> }));
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
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(mocks.quote).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceCurrency: "NGN", country: "US", amount: 100 }) }));
    await waitFor(() => expect(screen.getAllByText("177,500.00 NGN").length).toBeGreaterThan(0));
  });

  it("sends one payment and reports completion without exposing provider names", async () => {
    mocks.send.mockResolvedValue({ status: "succeeded", reference: "GLB-1", trackingReference: "SWIFT-1", recipientGets: 100, fee: 5000, totalDebit: 177500, destinationCurrency: "USD" });
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(screen.getByText("Payment completed")).toBeTruthy());
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("maps failures to the safe feedback message", async () => {
    mocks.send.mockRejectedValue(new Error("Incorrect transaction PIN."));
    render(<InternationalServices initial="cross-border" />);
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

describe("foreign-wallet and coin funding", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.balances = { NGN: 500000, USD: 1000 }; });
  afterEach(() => { mocks.balances = { NGN: 500000 }; });
  it("sends USD from the USD wallet instead of debiting naira", async () => {
    mocks.quote.mockResolvedValue({ ...QUOTE, sourceCurrency: "USD", rate: null, principal: 100, fee: 5, feeCurrency: "USD", totalDebit: 105 });
    mocks.send.mockResolvedValue({ status: "succeeded", reference: "USD-1", recipientGets: 100, fee: 5, totalDebit: 105, destinationCurrency: "USD" });
    render(<InternationalServices initial="send" />);
    fireEvent.change(screen.getByLabelText("Pay from"), { target: { value: "USD" } });
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send payment" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send payment" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceCurrency: "USD", confirmedTotal: 105, country: "US" }) }));
  });
  it("does not request a quote or dispatch an unconfirmed USD to GBP conversion", async () => {
    render(<InternationalServices initial="send" />);
    fireEvent.change(screen.getByLabelText("Pay from"), { target: { value: "USD" } });
    fireEvent.click(screen.getByRole("option", { name: /United Kingdom/ }));
    fireEvent.change(screen.getByLabelText("Recipient account name"), { target: { value: "Ada Obi" } });
    fireEvent.change(screen.getByLabelText("Sort code"), { target: { value: "040004" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText("Amount (GBP)"), { target: { value: "100" } });
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(mocks.quote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send payment" })).toBeDisabled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reuses the protected stablecoin bank flow from Send", () => {
    render(<InternationalServices initial="send" />);
    fireEvent.click(screen.getByRole("button", { name: "Coins to bank" }));
    expect(mocks.crypto).toHaveBeenCalledWith({ balances: mocks.balances });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("duplicate and quote protection", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.quote.mockResolvedValue(QUOTE); });
  it("reuses the same payment reference when the user retries after an uncertain error", async () => {
    mocks.send.mockRejectedValue(new Error("network timeout"));
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Transaction PIN"), { target: { value: "1234" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    const [a, b] = mocks.send.mock.calls.map((c) => (c[0] as { data: { idempotencyKey: string; confirmedTotal: number } }).data);
    expect(a?.idempotencyKey).toBe(b?.idempotencyKey);
    expect(a?.confirmedTotal).toBe(177500);
  });
});


describe("international quote readiness", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.quote.mockResolvedValue(QUOTE); });
  it("blocks sending when the fee-inclusive total exceeds available funds", async () => {
    mocks.quote.mockResolvedValue({ ...QUOTE, totalDebit: 500001 });
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(mocks.quote).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not accept an old amount's quote after the amount changes", async () => {
    let resolveOld: ((value: typeof QUOTE) => void) | undefined;
    mocks.quote.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(mocks.quote).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "200" } });
    resolveOld?.(QUOTE);
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeDisabled());
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("blocks another dispatch once the original payment is pending", async () => {
    mocks.send.mockResolvedValue({ status: "pending", note: "Awaiting network confirmation" });
    render(<InternationalServices initial="cross-border" />);
    fillForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /Send payment/i })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Send payment/i }));
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
