import { describe, expect, it } from "vitest";
import { detectedNetwork, normalizeNgPhone } from "@/components/slikpay/Airtime";

describe("airtime phone normalisation", () => {
  it("converts +234 and 234 formats to the 11-digit local form", () => {
    expect(normalizeNgPhone("+2348012345678")).toBe("08012345678");
    expect(normalizeNgPhone("2348012345678")).toBe("08012345678");
    expect(normalizeNgPhone("08012345678")).toBe("08012345678");
  });
  it("strips spaces and dashes", () => {
    expect(normalizeNgPhone("0801 234 5678")).toBe("08012345678");
    expect(normalizeNgPhone("0801-234-5678")).toBe("08012345678");
  });
});

describe("airtime network detection payload", () => {
  it("reads the network name from common payload shapes", () => {
    expect(detectedNetwork({ network: "MTN" })).toBe("MTN");
    expect(detectedNetwork({ operatorName: "Glo" })).toBe("Glo");
    expect(detectedNetwork([{ provider: "Airtel" }])).toBe("Airtel");
  });
  it("returns empty when nothing is recognisable so no wrong network is pre-picked", () => {
    expect(detectedNetwork(null)).toBe("");
    expect(detectedNetwork({})).toBe("");
    expect(detectedNetwork([])).toBe("");
  });
});
