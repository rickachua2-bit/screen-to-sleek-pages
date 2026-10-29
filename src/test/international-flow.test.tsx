import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ check: vi.fn(), crypto: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/international.functions", () => ({ getInternationalAvailability: mocks.check }));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "live", balances: { USDT: 10 }, receipts: [] }, error: "" }) }));
vi.mock("@/components/slikpay/CryptoBankFunding", () => ({ CryptoBankFunding: (props: unknown) => { mocks.crypto(props); return <div>Crypto bank form</div>; } }));
import { InternationalServices } from "@/components/slikpay/InternationalServices";
describe("international service navigation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.check.mockResolvedValue({ mode: "live", active: false, crossBorderListed: true, tuitionListed: true }); });
  it("allows remittance discovery and routes crypto cash-out to the existing protected flow", async () => {
    const screen = render(<InternationalServices />);
    await waitFor(() => expect(mocks.check).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Remittances" }));
    expect(screen.getByRole("button", { name: "Remittances" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Crypto to NGN bank" }));
    await waitFor(() => expect(mocks.crypto).toHaveBeenCalledWith({ balances: { USDT: 10 } }));
  });
});