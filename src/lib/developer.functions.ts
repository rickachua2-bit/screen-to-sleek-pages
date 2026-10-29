import { createServerFn } from "@tanstack/react-start";
import { webhookAccount, webhookQuery, webhookRetry } from "./developer-console";

export const getWebhookEvents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => webhookQuery.parse(input))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const owned = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).like("operation", "%/v1/accounts/virtual%");
    if (owned.error) throw new Error("Receiving accounts could not be loaded.");
    const accounts = (owned.data ?? []).map((r) => r.resource_id).filter((v): v is string => typeof v === "string" && /^\d{10}$/.test(v));
    const configured = Boolean(process.env["PADDLE_WEBHOOK_SECRET"]);
    if (!accounts.length) return { configured, mode, events: [] };
    const values = `(${accounts.join(",")})`;
    let query = db.from("webhook_events").select("id,event_type,processed,received_at,payload")
      .or(`payload->data->>accountNumber.in.${values},payload->data->>virtualAccountNumber.in.${values},payload->data->metadata->>recipientAccountNumber.in.${values}`)
      .order("received_at", { ascending: false }).limit(100);
    if (data.status !== "all") query = query.eq("processed", data.status === "processed");
    const result = await query;
    if (result.error) throw new Error("Webhook history is unavailable. No delivery status could be confirmed.");
    return { configured, mode, events: (result.data ?? []).filter((row) => accounts.includes(webhookAccount(row.payload) ?? "")).map((row) => ({ id: row.id as string, type: row.event_type as string, processed: row.processed === true, receivedAt: row.received_at as string })) };
  });

export const reconcileWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => webhookRetry.parse(input))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const row = await db.from("webhook_events").select("payload,processed").eq("id", data.id).maybeSingle();
    const account = webhookAccount(row.data?.payload);
    if (row.error || !account) throw new Error("This delivery is unavailable.");
    const owner = await db.from("paddle_resources").select("user_id,mode").eq("resource_id", account).maybeSingle();
    if (owner.error || owner.data?.user_id !== user.id || owner.data?.mode !== mode) throw new Error("This delivery is unavailable.");
    if (row.data?.processed === true) return { processed: true };
    const { parseWebhook, processWebhook } = await import("./webhook-processing.server");
    const event = parseWebhook(JSON.stringify(row.data?.payload));
    if (!event.success) throw new Error("This delivery needs support review.");
    const response = await processWebhook(db, event.data);
    return { processed: response.ok };
  });