import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meterCustomer, useMeterCustomer } from "@/lib/electricity-verification";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.run }));
vi.mock("@/lib/paddle.functions", () => ({ runPaddleOperation: {} }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: { NGN: 50000 } } }) }));
vi.mock("@/components/slikpay/ServicesHub", () => ({ FieldInput: ({ field, value, onChange }: { field: { name: string; label: string }; value: string; onChange: (value: string, item?: Record<string, unknown>) => void }) => <label>{field.label}<input aria-label={field.label} value={value} onChange={(event) => onChange(event.target.value, field.name === "disco" ? { code: event.target.value, name: "Eko" } : undefined)} /></label> }));
import { BillsService } from "@/components/slikpay/BillsService";

describe("electricity customer lookup", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  afterEach(() => vi.useRealTimers());

  it("automatically retrieves the name and address before an amount is entered", async () => {
    mocks.run.mockResolvedValue({ resultJson: JSON.stringify({ customerName: "Ada Okafor", address: "12 Marina, Lagos" }) });
    render(<BillsService serviceId="power" />);
    fireEvent.change(screen.getByLabelText("Electricity company"), { target: { value: "EKO" } });
    fireEvent.change(screen.getByLabelText("Meter number"), { target: { value: "45028192019" } });
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "post-bills-electricity-validate", body: { meterNumber: "45028192019", billerCode: "EKO", itemCode: "" } }) }));
    expect(await screen.findByText("Ada Okafor")).toBeTruthy();
    expect(screen.getByText("12 Marina, Lagos")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Meter number"), { target: { value: "45028192020" } });
    expect(screen.queryByText("Ada Okafor")).toBeNull();
  });

  it("does not request customer details without a valid meter and company", async () => {
    vi.useFakeTimers();
    const request = vi.fn();
    renderHook(() => useMeterCustomer("123", "EKO", "", request));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(request).not.toHaveBeenCalled();
  });

  it("discards an old company's late result and verifies the new selection", async () => {
    vi.useFakeTimers();
    let finish: (value: unknown) => void = () => {};
    const request = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ customerName: "New customer", address: "New address" });
    const { result, rerender } = renderHook(({ code }) => useMeterCustomer("45028192019", code, "", request), { initialProps: { code: "EKO" } });
    await act(() => vi.advanceTimersByTimeAsync(600));
    rerender({ code: "IKEJA" });
    await act(async () => finish({ customerName: "Old customer", address: "Old address" }));
    expect(result.current.details).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(request).toHaveBeenLastCalledWith({ meterNumber: "45028192019", billerCode: "IKEJA", itemCode: "" });
    expect(result.current.details?.customerName).toBe("New customer");
  });

  it("never confirms missing identity fields or rejected verification", () => {
    expect(meterCustomer({ customerName: "Ada" })).toBeNull();
    expect(meterCustomer({ valid: false, customerName: "Ada", address: "Lagos" })).toBeNull();
    expect(meterCustomer({ data: { customer: { name: "Ada", address: "Lagos" } } })).toMatchObject({ customerName: "Ada", address: "Lagos" });
  });

  it("allows a manual lookup retry after a service failure", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ customerName: "Ada", address: "Lagos" });
    const { result } = renderHook(() => useMeterCustomer("45028192019", "EKO", "", request));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(result.current.status).toBe("failed");
    act(() => result.current.retry());
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(result.current.details).toMatchObject({ customerName: "Ada", address: "Lagos" });
  });
});