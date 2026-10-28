import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantContactVerification } from "@/components/slikpay/MerchantContactVerification";

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/merchant-verification.functions", () => ({ startMerchantVerification: mocks.send, verifyMerchantContact: mocks.verify }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("contact retry", () => {
  it("disables resending for the provider retry period without sending automatically", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Paddle temporarily refused this verification request (HTTP 429). [retry-after:120]"));
    render(<MerchantContactVerification channel="phone" value="+2348030000000" onVerified={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify phone" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again in 120s" })).toBeDisabled());
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).not.toHaveTextContent("retry-after");
  });
});