import { describe, expect, it } from "vitest";
import { cryptoOfframpPreview } from "@/lib/crypto-offramp";
const rates = { success: true, rates: { USDT_NGN: 1359.23, USDC_NGN: 1359.23 }, wholesaleRates: { USDT_NGN: 1368.13, USDC_NGN: 1368.13 } };
describe("provider-backed crypto preview", () => {
  it("uses effective proceeds with the embedded provider spread only once", () => {
    const q = cryptoOfframpPreview(rates, "USDT", 10);
    expect(q.grossNgn).toBe(13681.3);
    expect(q.conversionFee).toBe(89);
    expect(q.netNgn).toBe(13592.3);
  });
  it("uses the USDC sell pair returned by the service", () => {
    expect(cryptoOfframpPreview(rates, "USDC", 1).netNgn).toBe(1359.23);
  });
  it("never falls back to an invented rate", () => {
    expect(() => cryptoOfframpPreview({ rates: {} }, "USDT", 10)).toThrow("did not confirm");
  });
  it("rejects missing wholesale data instead of inventing a fee", () => {
    expect(() => cryptoOfframpPreview({ rates: rates.rates }, "USDT", 10)).toThrow("did not confirm");
  });
  it("rejects failed responses even if they contain rates", () => {
    expect(() => cryptoOfframpPreview({ ...rates, success: false }, "USDT", 10)).toThrow("unavailable");
  });
});