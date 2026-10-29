import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ credit: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/collections.server", () => ({ inboundCredit: mocks.credit, postCredit: mocks.post }));
import { parseWebhook, processWebhook } from "@/lib/webhook-processing.server";
beforeEach(() => vi.resetAllMocks());
const ev = { id: "event-1", event: "collection", data: { reference: "ref-1", accountNumber: "0123456789", status: "SUCCESSFUL" } };
function database(code?: string, processed = false, failCredit = false) {
  const done = vi.fn().mockResolvedValue({ error: null, data: { id: ev.id, processed: true } });
  const read = vi.fn().mockResolvedValue({ error: null, data: { processed, payload: ev } });
  const db = { from: vi.fn((table: string) => table === "webhook_events" ? {
    insert: vi.fn().mockResolvedValue({ error: code ? { code } : null }),
    select: () => ({ eq: () => ({ maybeSingle: read }) }), update: () => ({ eq: () => ({ select: () => ({ maybeSingle: done }) }) }),
  } : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ error: null, data: { user_id: "owner", mode: "live" } }) }) }) }) };
  mocks.credit.mockReturnValue({ reference: "ref-1" });
  if (failCredit) mocks.post.mockRejectedValue(new Error("storage")); else mocks.post.mockResolvedValue(true);
  return { db: db as unknown as SupabaseClient, done };
}
it("rejects malformed JSON without throwing", () => { expect(parseWebhook("{" ).success).toBe(false); });
it("rejects events without an event type", () => { expect(parseWebhook(JSON.stringify({ id: "empty", data: {} })).success).toBe(false); });
it("does not acknowledge a completion update that changed no event", async () => {
  const { db, done } = database();
  done.mockResolvedValue({ error: null, data: null } as never);
  expect((await processWebhook(db, ev)).status).toBe(503);
});
it("returns retryable failure for database errors, not a duplicate acknowledgement", async () => {
  const { db } = database("08006");
  expect((await processWebhook(db, ev)).status).toBe(503);
  expect(mocks.post).not.toHaveBeenCalled();
});
it("reprocesses an unfinished duplicate and marks it done only after credit succeeds", async () => {
  const { db, done } = database("23505", false);
  expect((await processWebhook(db, ev)).status).toBe(200);
  expect(mocks.post).toHaveBeenCalledOnce(); expect(done).toHaveBeenCalledOnce();
});
it("does not process an already completed duplicate again", async () => {
  const { db } = database("23505", true);
  expect((await processWebhook(db, ev)).status).toBe(200); expect(mocks.post).not.toHaveBeenCalled();
});
it("keeps failed credit attempts unprocessed and requests redelivery", async () => {
  const { db, done } = database(undefined, false, true);
  expect((await processWebhook(db, ev)).status).toBe(503); expect(done).not.toHaveBeenCalled();
});