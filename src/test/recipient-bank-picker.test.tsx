import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipientBankPicker } from "@/components/slikpay/RecipientBankPicker";

describe("recipient bank selection", () => {
  it("lets users search and change the selected bank", () => {
    const onSelect = vi.fn();
    render(<RecipientBankPicker banks={[{ code: "058", name: "GTBank" }, { code: "035", name: "Wema Bank" }]} bank={{ code: "058", name: "GTBank" }} error="" onSelect={onSelect} onRetry={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Search recipient bank" });
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "wema" } });
    fireEvent.click(screen.getByRole("option", { name: "Wema Bank 035" }));
    expect(onSelect).toHaveBeenCalledWith({ code: "035", name: "Wema Bank" });
  });
});