import { describe, expect, it } from "vitest";
import { ENDPOINTS, accessFor, fillPath, movesMoney, scopeOf } from "@/lib/paddle-policy";

const ep = (method: "GET" | "POST", path: string) => ({ method, path });

describe("Paddle access rules", () => {
  it("covers every documented Paddle endpoint", () => {
    expect(ENDPOINTS.length).toBeGreaterThanOrEqual(160);
    expect(ENDPOINTS.some((e) => e.path === "/v1/flights/orders")).toBe(true);
  });
  it("never exposes the shared platform wallet or ledger to customers", () => {
    expect(accessFor(ep("GET", "/v1/wallet/balance"), "merchant", "live").allowed).toBe(false);
    expect(accessFor(ep("GET", "/v1/ledger/statements"), "merchant", "sandbox").allowed).toBe(false);
  });
  it("only allows simulated inbound credits in sandbox", () => {
    expect(accessFor(ep("POST", "/v1/test/simulate-inbound"), "merchant", "sandbox").allowed).toBe(true);
    expect(accessFor(ep("POST", "/v1/test/simulate-inbound"), "merchant", "live").allowed).toBe(false);
  });
  it("keeps bulk payouts for business accounts", () => {
    expect(accessFor(ep("POST", "/v1/payouts/bulk"), "personal", "sandbox").allowed).toBe(false);
    expect(accessFor(ep("POST", "/v1/payouts/bulk"), "merchant", "sandbox").allowed).toBe(true);
  });
  it("treats payouts, card funding and flight tickets as money movement", () => {
    expect(movesMoney(ep("POST", "/v1/payouts/transfer"))).toBe(true);
    expect(movesMoney(ep("POST", "/v1/cards/{cardId}/fund"))).toBe(true);
    expect(movesMoney(ep("POST", "/v1/flights/orders"))).toBe(true);
    expect(movesMoney(ep("POST", "/v1/accounts/resolve"))).toBe(false);
  });
  it("requires ownership for item-specific calls", () => {
    expect(scopeOf(ep("GET", "/v1/cards/{cardId}/secure-data"))).toBe("owned");
    expect(() => fillPath("/v1/cards/{cardId}/fund", { cardId: "../wallet" })).toThrow();
  });
});
