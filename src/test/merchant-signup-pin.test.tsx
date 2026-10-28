import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/slikpay/AuthCard";

const mocks = vi.hoisted(() => ({
  combine: vi.fn().mockResolvedValue({ challengeId: "contact-proof" }),
  lookup: vi.fn().mockResolvedValue({ companyName: "Verified Business" }),
  create: vi.fn().mockRejectedValue(new Error("Stopped before account creation")),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/merchant-verification.functions", () => ({ combineMerchantContacts: mocks.combine, lookupMerchantBusiness: mocks.lookup, createVerifiedMerchant: mocks.create }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ signInWithPassword: vi.fn() }) }));
vi.mock("@/components/slikpay/MerchantContactVerification", () => ({
  MerchantContactVerification: ({ channel, value, onVerified }: { channel: string; value: string; onVerified: (proof: { value: string; id: string }) => void }) =>
    <button type="button" onClick={() => onVerified({ value, id: channel })}>Verify {channel}</button>,
}));
vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({ value, onChange, maxLength }: { value: string; onChange: (value: string) => void; maxLength: number }) => <input aria-label="PIN entry" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />,
  InputOTPGroup: () => null,
  InputOTPSlot: () => null,
}));
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function reachPinStep() {
  render(<AuthCard onDone={vi.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Create Account" }));
  fireEvent.click(screen.getByRole("button", { name: /Business \/ Merchant/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Business Category" }));
  fireEvent.click(screen.getByRole("option", { name: "eCommerce" }));
  fireEvent.change(screen.getByLabelText("Full Name of Director / Owner"), { target: { value: "Test Merchant" } });
  fireEvent.change(screen.getByLabelText("Official Work Email"), { target: { value: "merchant@example.com" } });
  fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "8030000000" } });
  fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "StrongPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Business Verification/ }));
  await screen.findByLabelText("CAC Registration Number (RC / BN / IT)");
  fireEvent.change(screen.getByLabelText("CAC Registration Number (RC / BN / IT)"), { target: { value: "RC123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
  await screen.findByText("Verified Business");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Transaction PIN/ }));
}

describe("merchant sign-up PIN-only completion", () => {
  it("submits a matching four-digit PIN without requiring settlement bank details", async () => {
    await reachPinStep();
    const pins = screen.getAllByLabelText("PIN entry");
    pins.forEach((input) => fireEvent.change(input, { target: { value: "1234" } }));
    fireEvent.click(screen.getByRole("button", { name: /Launch Slikpay Business Console/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0]?.[0].data).toEqual(expect.objectContaining({ pin: "1234", rcNumber: "RC123456" }));
    expect(mocks.create.mock.calls[0]?.[0].data).not.toHaveProperty("bank");
    expect(mocks.create.mock.calls[0]?.[0].data).not.toHaveProperty("nuban");
  });

  it("blocks completion when the confirmation does not match the four-digit PIN", async () => {
    await reachPinStep();
    const pins = screen.getAllByLabelText("PIN entry");
    const [pin, confirmation] = pins;
    if (!pin || !confirmation) throw new Error("Both PIN inputs are required");
    fireEvent.change(pin, { target: { value: "1234" } });
    fireEvent.change(confirmation, { target: { value: "4321" } });
    fireEvent.click(screen.getByRole("button", { name: /Launch Slikpay Business Console/ }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});