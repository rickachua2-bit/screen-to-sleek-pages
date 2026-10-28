import { describe, expect, it } from "vitest";
import { isOwnPayoutAccount, learnRate, nairaValue, walletActions } from "@/lib/wallet-actions";

const on = (code: string, status: "active" | "not_active" | "not_issued", bal: number) => Object.fromEntries(walletActions(code, status, bal).map((a) => [a.id, a.enabled]));

describe("wallet actions", () => {
  it("swap is always available, even when the account isn't issued or active", () => {
    expect(on("GHS", "not_issued", 0)["swap"]).toBe(true);
    expect(on("GHS", "not_active", 0)["swap"]).toBe(true);
  });
  it("locks receive and send when the account is not active", () => {
    const a = on("GHS", "not_active", 500);
    expect([a["receive"], a["send"]]).toEqual([false, false]);
    expect(a["withdraw"]).toBe(true);
  });
  it("active fiat wallet with balance can receive, send and withdraw", () => {
    const a = on("KES", "active", 10);
    expect([a["receive"], a["send"], a["withdraw"]]).toEqual([true, true, true]);
  });
  it("crypto wallets cannot send out or withdraw directly", () => {
    const a = on("USDT", "active", 10);
    expect([a["send"], a["withdraw"], a["receive"]]).toEqual([false, false, true]);
  });
});

describe("naira value", () => {
  it("learns naira-per-unit from an NGN→USDT swap", () => {
    const r = learnRate({}, "NGN", "USDT", 0.000705);
    expect(nairaValue("USDT", 10, r)).toBeCloseTo(14184.4, 1);
  });
  it("chains through a known rate", () => {
    const r = learnRate({ USDT: 1500 }, "USDT", "GHS", 15);
    expect(r["GHS"]).toBe(100);
  });
  it("returns null without a rate", () => { expect(nairaValue("ZAR", 5, {})).toBeNull(); });
});

describe("withdraw ownership", () => {
  it("allows only accounts in the holder's name", () => {
    expect(isOwnPayoutAccount("TRAVSIFY GLOBAL INCLUSIVE LIMITED", "Travsify Global Inclusive Ltd")).toBe(true);
    expect(isOwnPayoutAccount("TRAVSIFY GLOBAL INCLUSIVE LIMITED", "John Doe")).toBe(false);
  });
});
