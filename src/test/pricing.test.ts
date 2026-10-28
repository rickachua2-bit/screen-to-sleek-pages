import { describe, expect, it } from "vitest";
import { feeIsFlat } from "@/lib/pricing";

describe("Flat fees", () => {
  it("reads flatness from the provider's own formula, never assumes it", () => {
    expect(feeIsFlat("Flat ₦80.00 per NIP outflow transfer (capped at ₦80.00) on STARTER tier")).toBe(true);
    expect(feeIsFlat("Flat GH₵ 5.00 per Ghana MoMo/GhIPSS payout on STARTER tier")).toBe(true);
  });
  it("keeps percentage-priced movements live per amount", () => {
    expect(feeIsFlat("0.35% OTC wholesale corridor spread on STARTER tier")).toBe(false);
    expect(feeIsFlat("1.50% crypto liquidation spread on STARTER tier")).toBe(false);
    expect(feeIsFlat("$1.00 + 1.2% (Cap $15.00) on STARTER tier")).toBe(false);
  });
  it("never marks an empty or unknown formula flat", () => {
    expect(feeIsFlat("")).toBe(false);
    expect(feeIsFlat("flat")).toBe(true);
  });
});
