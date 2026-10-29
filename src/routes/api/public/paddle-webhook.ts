import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paddle-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PADDLE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const { readWebhookBody } = await import("@/lib/developer-console");
        let raw: string | null;
        try { raw = await readWebhookBody(request); }
        catch { return new Response("Bad payload", { status: 400 }); }
        if (raw === null) return new Response("Too large", { status: 413 });
        const { verifySignature } = await import("@/lib/paddle.server");
        if (!(await verifySignature(raw, request.headers.get("x-paddle-signature"), secret))) return new Response("Invalid signature", { status: 401 });
        const { parseWebhook, processWebhook } = await import("@/lib/webhook-processing.server");
        const parsed = parseWebhook(raw);
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const { accountAdmin } = await import("@/lib/merchant-verification.server");
        const db = accountAdmin();
        const response = await processWebhook(db, parsed.data);
        response.headers.set("Cache-Control", "no-store");
        if (response.status === 503) response.headers.set("Retry-After", "30");
        return response;
      },
    },
  },
});
