import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inboundCredit, postCredit } from "@/lib/collections.server";

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
    expect(inboundCredit({ ...tx, status: "unsuccessful" }, new Set(["9747648649"]))).toBeNull();
    expect(inboundCredit({ ...tx, status: "unpaid" }, new Set(["9747648649"]))).toBeNull();
  });
});

it("repairs the ledger even when the incoming activity already exists", async () => {
  const ledger = vi.fn().mockResolvedValue({ error: null });
  const db = { from: (table: string) => table === "transactions" ? { upsert: () => ({ select: async () => ({ data: [], error: null }) }) } : { upsert: ledger } } as unknown as SupabaseClient;
  const c = inboundCredit(tx, new Set(["9747648649"]));
  if (!c) throw new Error("Expected valid collection");
  expect(await postCredit(db, "owner", "live", c)).toBe(false);
  expect(ledger).toHaveBeenCalledWith(expect.objectContaining({ amount: 99.2, reference: "col:582b" }), expect.objectContaining({ ignoreDuplicates: true }));
});
it("propagates a ledger failure rather than confirming an incoming balance update", async () => {
  const db = { from: (table: string) => table === "transactions" ? { upsert: () => ({ select: async () => ({ data: [{ id: "new" }], error: null }) }) } : { upsert: async () => ({ error: { code: "08006" } }) } } as unknown as SupabaseClient;
  const c = inboundCredit(tx, new Set(["9747648649"]));
  if (!c) throw new Error("Expected valid collection");
  await expect(postCredit(db, "owner", "live", c)).rejects.toThrow("reconciliation");
});

import { adoptableAccount } from "@/lib/collections.server";
describe("auto-linking receiving accounts", () => {
  const t = { metadata: { recipientAccountNumber: "7946436244", recipientAccountName: "slikpay GLOBAL INCLUSIVE LIMITED" } };
  it("links an unrecorded account in the user's verified business name", () => {
    expect(adoptableAccount(t, "slikpay GLOBAL INCLUSIVE LTD", new Set())).toBe("7946436244");
  });
  it("never links an account in someone else's name", () => {
    expect(adoptableAccount(t, "ACME LOGISTICS LIMITED", new Set())).toBeNull();
  });
});
