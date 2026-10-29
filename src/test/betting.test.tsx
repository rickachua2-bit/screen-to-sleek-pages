import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { bettingCustomer, bettingCustomerBody } from "@/lib/betting";
import { useBettingCustomer } from "@/lib/betting-verification";
afterEach(() => vi.useRealTimers());
const body = { operator: "SPORTY", customerId: "001234" };
it("requires a returned customer identity and rejects explicit failures", () => {
  expect(bettingCustomer({ valid: true }, body)).toBeNull();
  expect(bettingCustomer({ customerName: "Ada", valid: false }, body)).toBeNull();
  expect(bettingCustomer({ customerName: "Ada", status: "INVALID" }, body)).toBeNull();
  expect(bettingCustomer({ data: { customerName: "Ada", customerId: "001234" } }, body)?.customerName).toBe("Ada");
});
it("rejects results for a different platform or ID and preserves leading zeros", () => {
  expect(bettingCustomer({ customerName: "Ada", customerId: "1234" }, body)).toBeNull();
  expect(bettingCustomer({ customerName: "Ada", operator: "BETKING" }, body)).toBeNull();
  expect(bettingCustomerBody.parse(body).customerId).toBe("001234");
  expect(bettingCustomerBody.safeParse({ ...body, customerId: "<script>" }).success).toBe(false);
});
it("automatically verifies the entered ID and discards late responses after platform changes", async () => {
  vi.useFakeTimers();
  let finish: (v: unknown) => void = () => {};
  const request = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ customerName: "New customer" });
  const { result, rerender } = renderHook(({ operator }) => useBettingCustomer(operator, "001234", request), { initialProps: { operator: "SPORTY" } });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(request).toHaveBeenCalledWith(body);
  rerender({ operator: "BETKING" });
  await act(async () => finish({ customerName: "Old customer" }));
  expect(result.current.customer).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(result.current.customer?.customerName).toBe("New customer");
});
it("does not look up missing IDs and supports explicit retry after failure", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ customerName: "Ada" });
  const { result, rerender } = renderHook(({ id }) => useBettingCustomer("SPORTY", id, request), { initialProps: { id: "" } });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(request).not.toHaveBeenCalled();
  rerender({ id: "001234" });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(result.current.status).toBe("failed");
  act(() => result.current.retry());
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(result.current.customer?.customerName).toBe("Ada");
});