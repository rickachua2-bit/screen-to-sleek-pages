import { describe, expect, it } from "vitest";
import { QUOTE_TTL_MS, quoteSecondsLeft, quoteStillMatches, savedRecipientsFrom, trackSteps } from "@/lib/international";

describe("international quote and tracking rules", () => {
  it("holds a quote for 60 seconds", () => {
    expect(QUOTE_TTL_MS).toBe(60_000);
    expect(quoteSecondsLeft(0, 59_000)).toBe(1);
    expect(quoteSecondsLeft(0, 60_000)).toBe(0);
  });
  it("rejects a send whose fresh total differs from the confirmed total", () => {
    expect(quoteStillMatches(177500, 177500)).toBe(true);
    expect(quoteStillMatches(177500, 177650)).toBe(false);
  });
  it("keeps unknown payments pending, never paid", () => {
    expect(trackSteps("pending").at(-1)!.state).toBe("todo");
    expect(trackSteps("failed").at(-1)!.state).toBe("failed");
    expect(trackSteps("succeeded").at(-1)!.state).toBe("done");
  });
  it("offers saved recipients only from non-declined international receipts", () => {
    const b = { country: "GB", accountName: "Ada Obi", sortCode: "123456", accountNumber: "12345678" };
    const list = savedRecipientsFrom([
      { operation: "POST /v1/payouts/global", status: "succeeded", created_at: "2026-10-01", summary: { beneficiary: b } },
      { operation: "POST /v1/payouts/global", status: "succeeded", created_at: "2026-09-01", summary: { beneficiary: b } },
      { operation: "POST /v1/payouts/global", status: "failed", created_at: "2026-09-02", summary: { beneficiary: { ...b, accountName: "Bad" } } },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]!.fields).toEqual({ sortCode: "123456", accountNumber: "12345678" });
  });
});
