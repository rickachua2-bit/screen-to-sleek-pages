import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), process: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (parse: (v: unknown) => unknown) => ({ handler: (fn: (ctx: { data: unknown }) => unknown) => (args: { data: unknown }) => fn({ data: parse(args.data) }) }) }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user }));
vi.mock("@/lib/webhook-processing.server", () => ({ parseWebhook: () => ({ success: true, data: { event: "collection" } }), processWebhook: mocks.process }));
import { reconcileWebhook } from "@/lib/developer.functions";
beforeEach(() => vi.resetAllMocks());
function account(owner: string, mode = "live", processed = false) {
  const db = { from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: null, data: table === "webhook_events" ? { processed, payload: { data: { accountNumber: "0123456789" } } } : { user_id: owner, mode } }) }) }) }) };
  mocks.user.mockResolvedValue({ db, user: { id: "owner" }, mode: "live" });
}
it("cannot reconcile another business's signed event", async () => {
  account("someone-else");
  await expect(reconcileWebhook({ data: { id: "event-1" } })).rejects.toThrow("unavailable");
  expect(mocks.process).not.toHaveBeenCalled();
});
it("cannot reconcile an event from a different environment", async () => {
  account("owner", "sandbox");
  await expect(reconcileWebhook({ data: { id: "event-1" } })).rejects.toThrow("unavailable");
  expect(mocks.process).not.toHaveBeenCalled();
});
it("reuses an owned stored event without dispatching a payment", async () => {
  account("owner"); mocks.process.mockResolvedValue(new Response("ok"));
  expect(await reconcileWebhook({ data: { id: "event-1" } })).toEqual({ processed: true });
  expect(mocks.process).toHaveBeenCalledOnce();
});
it("skips processing already completed events", async () => {
  account("owner", "live", true);
  expect(await reconcileWebhook({ data: { id: "event-1" } })).toEqual({ processed: true });
  expect(mocks.process).not.toHaveBeenCalled();
});