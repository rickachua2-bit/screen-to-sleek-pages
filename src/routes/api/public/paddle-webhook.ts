import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const eventSchema = z.object({
  event: z.string().max(80).optional(),
  type: z.string().max(80).optional(),
  id: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const Route = createFileRoute("/api/public/paddle-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PADDLE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 100000) return new Response("Too large", { status: 413 });
        const { verifySignature } = await import("@/lib/paddle.server");
        if (!(await verifySignature(raw, request.headers.get("x-paddle-signature"), secret))) return new Response("Invalid signature", { status: 401 });
        const parsed = eventSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const ev = parsed.data;
        const type = ev.event ?? ev.type ?? "unknown";
        const d = ev.data;
        const reference = String(d["reference"] ?? d["sessionId"] ?? ev.id ?? "");
        if (!reference) return new Response("Missing reference", { status: 400 });
        const eventId = ev.id ?? `${type}:${reference}`;
        const { accountAdmin } = await import("@/lib/merchant-verification.server");
        const db = accountAdmin();
        const fresh = await db.from("webhook_events").insert({ id: eventId, event_type: type, payload: ev });
        if (fresh.error) return new Response("ok"); // duplicate delivery
        // Credit the owner of the virtual account that received money.
        const account = d["accountNumber"] ?? d["virtualAccountNumber"];
        const amount = Number(d["amount"]);
        if (typeof account === "string" && Number.isFinite(amount) && amount > 0 && /credit|inbound|payment\.succeeded|collection/i.test(type)) {
          const owner = await db.from("paddle_resources").select("user_id, mode").eq("resource_id", account).maybeSingle();
          if (owner.data) await db.from("ledger_entries").insert({ user_id: owner.data.user_id, mode: owner.data.mode, currency: typeof d["currency"] === "string" ? d["currency"] : "NGN", amount, status: "posted", operation: type, reference: `wh:${eventId}` });
        }
        await db.from("webhook_events").update({ processed: true }).eq("id", eventId);
        return new Response("ok");
      },
    },
  },
});
