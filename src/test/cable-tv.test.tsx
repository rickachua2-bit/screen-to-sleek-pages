import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cableCustomer, cableValidationBody } from "@/lib/cable-tv";
import { useCableCustomer } from "@/components/slikpay/CableCustomerLookup";
import { ENDPOINTS, movesMoney, scopeOf } from "@/lib/paddle-policy";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.run }));
vi.mock("@/lib/paddle.functions", () => ({ runPaddleOperation: {} }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: { NGN: 50000 } } }) }));
vi.mock("@/components/slikpay/ServicesHub", () => ({ FieldInput: ({ field, value, onChange }: { field: { name: string; label: string }; value: string; onChange: (value: string, item?: Record<string, unknown>) => void }) => <label>{field.label}<input aria-label={field.label} value={value} onChange={(event) => onChange(event.target.value, { itemCode: event.target.value, billerCode: "DSTV", amount: 5000, name: "Compact" })} /></label> }));
import { BillsService } from "@/components/slikpay/BillsService";

describe("Cable customer verification", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  afterEach(() => vi.useRealTimers());

  it("accepts only 10–11 digits and the four confirmed provider values", () => {
    for (const provider of ["DSTV", "GOTV", "STARTIMES", "SHOWMAX"]) {
      expect(cableValidationBody.safeParse({ provider, smartcardNumber: "7028192831" }).success).toBe(true);
      expect(cableValidationBody.safeParse({ provider, smartcardNumber: "70281928311" }).success).toBe(true);
    }
    expect(cableValidationBody.safeParse({ provider: "DSTV", smartcardNumber: "702819283" }).success).toBe(false);
    expect(cableValidationBody.safeParse({ provider: "DSTV", smartcardNumber: "702819283111" }).success).toBe(false);
  });

  it("registers the confirmed endpoint as a non-money customer inquiry", () => {
    const endpoint = ENDPOINTS.find((e) => e.id === "post-bills-cable-validate");
    expect(endpoint?.path).toBe("/v1/bills/cable/validate");
    if (!endpoint) throw new Error("Missing endpoint");
    expect(movesMoney(endpoint)).toBe(false);
    expect(scopeOf(endpoint)).toBe("reference");
  });

  it("automatically verifies at 10 digits then reveals packages, without a payment", async () => {
    mocks.run.mockResolvedValue({ resultJson: JSON.stringify({ customerName: "CHINEDU OKAFOR", currentBouquet: "Compact", expiryDate: "2026-11-01" }) });
    render(<BillsService serviceId="tv" />);
    expect(screen.queryByLabelText("Package")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "DStv" }));
    fireEvent.change(screen.getByLabelText("Smartcard / IUC number"), { target: { value: "7028192831" } });
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "post-bills-cable-validate", body: { provider: "DSTV", smartcardNumber: "7028192831" } }) }));
    expect(await screen.findByLabelText("Package")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renew Subscription" })).toBeDisabled();
    expect(mocks.run).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Package"), { target: { value: "COMPACT" } });
    fireEvent.click(screen.getByRole("button", { name: "Renew Subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "GOtv" }));
    expect(screen.queryByLabelText("Package")).toBeNull();
  });

  it("rejects invalid responses and never invents a customer identity", () => {
    expect(cableCustomer({ valid: false, customerName: "Wrong customer" })).toBeNull();
    expect(cableCustomer({ status: "INVALID", customerName: "Wrong customer" })).toBeNull();
    expect(cableCustomer({ success: true })).toBeNull();
    expect(cableCustomer({ data: { customerName: "CHINEDU OKAFOR", bouquet: "Compact", dueDate: "2026-11-01" } })).toEqual({ customerName: "CHINEDU OKAFOR", currentPlan: "Compact", dueDate: "2026-11-01" });
  });

  it("ignores a late result after the smartcard or provider changes", async () => {
    vi.useFakeTimers();
    let finish: (value: unknown) => void = () => {};
    const request = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ customerName: "New customer" });
    const { result, rerender } = renderHook(({ provider }) => useCableCustomer(provider, "7028192831", request), { initialProps: { provider: "dstv" } });
    await act(() => vi.advanceTimersByTimeAsync(400));
    rerender({ provider: "gotv" });
    await act(async () => finish({ customerName: "Old customer" }));
    expect(result.current.customer).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(request).toHaveBeenLastCalledWith({ provider: "GOTV", smartcardNumber: "7028192831" });
    expect(result.current.customer?.customerName).toBe("New customer");
  });

  it("runs a pending valid-number lookup immediately on blur", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValue({ customerName: "CHINEDU OKAFOR" });
    const { result, rerender } = renderHook(({ number }) => useCableCustomer("dstv", number, request), { initialProps: { number: "702819283" } });
    rerender({ number: "7028192831" });
    act(() => result.current.onBlur());
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(request).toHaveBeenCalledTimes(1);
  });
});