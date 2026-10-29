import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inboundCredit, postCredit } from "./collections.server";

const eventSchema = z.object({
  event: z.string().max(80).optional(), type: z.string().max(80).optional(),
  id: z.string().min(1).max(120).optional(), data: z.record(z.string(), z.unknown()).default({}),
});
export function parseWebhook(raw: string) {
  try { return eventSchema.safeParse(JSON.parse(raw)); }
  catch { return { success: false as const }; }
}

/** Verified inbound deliveries only. Idempotent credit writes repair partial attempts. */
export async function processWebhook(db: SupabaseClient, ev: z.infer<typeof eventSchema>) {
  const type = ev.event ?? ev.type ?? "unknown";
  const d = ev.data;
  const reference = String(d["reference"] ?? d["sessionId"] ?? ev.id ?? "");
  if (!reference) return new Response("Missing reference", { status: 400 });
  const eventId = ev.id ?? `${type}:${reference}`;
  const fresh = await db.from("webhook_events").insert({ id: eventId, event_type: type, payload: ev });
  if (fresh.error) {
    if (fresh.error.code !== "23505") return new Response("Storage unavailable", { status: 503 });
    const prior = await db.from("webhook_events").select("processed,payload").eq("id", eventId).maybeSingle();
    if (prior.error || !prior.data) return new Response("Storage unavailable", { status: 503 });
    const stored = eventSchema.safeParse(prior.data.payload);
    if (!stored.success || JSON.stringify(stored.data) !== JSON.stringify(ev)) return new Response("Event identity conflict", { status: 409 });
    if (prior.data.processed === true) return new Response("ok");
  }
  try {
    const meta = d["metadata"] && typeof d["metadata"] === "object" ? d["metadata"] as Record<string, unknown> : {};
    const account = String(meta["recipientAccountNumber"] ?? d["accountNumber"] ?? d["virtualAccountNumber"] ?? "");
    if (account && /credit|inbound|payment|collection|transfer|transaction/i.test(type)) {
      // One provider account covers both modes; ambiguous ownership must never credit either user.
      const owner = await db.from("paddle_resources").select("user_id,mode").eq("resource_id", account).maybeSingle();
      if (owner.error || !owner.data) return new Response("Receiving account needs reconciliation", { status: 503 });
      const mode = owner.data.mode;
      if (mode !== "live" && mode !== "sandbox") return new Response("Receiving account needs reconciliation", { status: 503 });
      const c = inboundCredit(d, new Set([account]));
      if (c) await postCredit(db, owner.data.user_id, mode, c);
    }
    const done = await db.from("webhook_events").update({ processed: true }).eq("id", eventId);
    if (done.error) return new Response("Processing incomplete", { status: 503 });
    return new Response("ok");
  } catch { return new Response("Processing incomplete", { status: 503 }); }
}