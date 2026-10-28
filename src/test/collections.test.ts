import { describe, expect, it } from "vitest";
import { inboundCredit } from "@/lib/collections.server";

const tx = { id: "1f8", reference: "582b", amount: 100, netAmount: 99.2, currency: "NGN", status: "SUCCESSFUL", metadata: { recipientAccountNumber: "9747648649", senderAccountName: "PATRICK OTU ACHUA" } };

describe("inbound collections", () => {
  it("credits a successful transfer into an owned account, net of fee", () => {
    const c = inboundCredit(tx, new Set(["9747648649"]));
    expect(c?.amount).toBe(100);
    expect(c?.net).toBe(99.2);
    expect(c?.sender).toBe("PATRICK OTU ACHUA");
  });
  it("ignores transfers to accounts the user does not own", () => {
    expect(inboundCredit(tx, new Set(["0000000000"]))).toBeNull();
  });
  it("ignores pending or failed transfers", () => {
    expect(inboundCredit({ ...tx, status: "PENDING" }, new Set(["9747648649"]))).toBeNull();
  });
});
