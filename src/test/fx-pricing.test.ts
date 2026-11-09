import { describe, expect, it } from "vitest";
import { extractNipFlatFee } from "@/lib/fx-pricing.server";

const livePayload = {
  success: true,
  feeStructure: {
    transfers: {
      nipDomestic: { flatFeeNgn: 10.75, speed: "0.8s Instant NIP", description: "Central bank inter-bank settlement" },
      sliktagP2P: { fee: 0, speed: "Instant" },
    },
  },
};

describe("live NIP transfer fee", () => {
  it("reads the flat fee from the pricing service payload", () => {
    expect(extractNipFlatFee(livePayload)).toBe(10.75);
  });
  it("accepts a numeric string fee", () => {
    expect(extractNipFlatFee({ feeStructure: { transfers: { nipDomestic: { flatFeeNgn: "12.50" } } } })).toBe(12.5);
  });
  it("rounds the fee to the kobo", () => {
    expect(extractNipFlatFee({ feeStructure: { transfers: { nipDomestic: { flatFeeNgn: 10.756 } } } })).toBe(10.76);
  });
  it("never guesses when the fee is missing or invalid", () => {
    const badPayloads: unknown[] = [
      null,
      {},
      { feeStructure: {} },
      { feeStructure: { transfers: {} } },
      { feeStructure: { transfers: { nipDomestic: {} } } },
      { feeStructure: { transfers: { nipDomestic: { flatFeeNgn: 0 } } } },
      { feeStructure: { transfers: { nipDomestic: { flatFeeNgn: -5 } } } },
      { feeStructure: { transfers: { nipDomestic: { flatFeeNgn: "abc" } } } },
    ];
    for (const bad of badPayloads) expect(() => extractNipFlatFee(bad)).toThrow();
  });
});
