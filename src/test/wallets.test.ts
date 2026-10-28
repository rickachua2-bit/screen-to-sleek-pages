import { describe, expect, it } from "vitest";
import { isNotEnabled, shouldAutoIssueStablecoins, walletCurrencyOf, walletOperation } from "@/lib/wallets";

describe("wallet rules", () => {
  it("auto-issues USDT and USDC only for live accounts with a naira account", () => {
    expect(shouldAutoIssueStablecoins("live", true, [])).toEqual(["USDT", "USDC"]);
    expect(shouldAutoIssueStablecoins("sandbox", true, [])).toEqual([]);
    expect(shouldAutoIssueStablecoins("live", false, [])).toEqual([]);
  });
  it("never issues a stablecoin wallet twice", () => {
    expect(shouldAutoIssueStablecoins("live", true, ["USDT"])).toEqual(["USDC"]);
    expect(shouldAutoIssueStablecoins("live", true, ["USDT", "USDC"])).toEqual([]);
  });
  it("tags one wallet per currency and reads it back", () => {
    expect(walletCurrencyOf(walletOperation("GHS"))).toBe("GHS");
    expect(walletCurrencyOf(walletOperation("USDC"))).toBe("USDC");
    expect(walletCurrencyOf("POST /v1/accounts/virtual")).toBeNull();
  });
  it("maps a not-enabled refusal to 'not active yet'", () => {
    expect(isNotEnabled("Currency GHS is not enabled for this merchant")).toBe(true);
    expect(isNotEnabled("Network timeout")).toBe(false);
  });
});
