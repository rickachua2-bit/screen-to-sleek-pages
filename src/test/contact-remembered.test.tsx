import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MerchantContactVerification } from "@/components/slikpay/MerchantContactVerification";

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/merchant-verification.functions", () => ({ startMerchantVerification: mocks.send, verifyMerchantContact: mocks.verify }));

describe("remembered contact verification", () => {
  it("shows an already-verified email as verified without asking for a new code", () => {
    render(<MerchantContactVerification channel="email" value="info@slikpay.com" alreadyVerified onVerified={vi.fn()} />);
    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify email" })).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
