import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseBulkCsv, bulkTotals } from "./transfer-rules";

export interface BatchRow { bankCode: string; account: string; amount: number; note?: string | undefined; error?: string | undefined; key: string; name?: string | undefined; state: "checking" | "ready" | "sent" | "pending" | "failed"; msg?: string | undefined }

export const preparePaymentBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ csv: z.string().max(1_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    const parsed = parseBulkCsv(data.csv);
    if (!parsed.length) throw new Error("This file contains no payments.");
    const normalized = JSON.stringify(parsed.map((r) => [r.bankCode, r.account, Number.isFinite(r.amount) ? r.amount : null, r.note ?? ""]));
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    const fingerprint = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
    const existing = await ctx.db.from("payment_batches").select("id").eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("fingerprint", fingerprint).maybeSingle();
    if (existing.error) throw new Error("Saved batches are unavailable. Apply the payment reliability setup before uploading.");
    if (existing.data) return { id: existing.data.id as string, reused: true };
    const rows: BatchRow[] = parsed.map((r) => ({ ...r, amount: Number.isFinite(r.amount) ? r.amount : 0, key: crypto.randomUUID(), state: r.error ? "failed" : "checking" }));
    // Bound account lookups to the runtime's six outbound connections.
    for (let offset = 0; offset < rows.length; offset += 6) {
      await Promise.all(rows.slice(offset, offset + 6).map(async (r) => {
        if (r.error) return;
        try {
          const result = await callPaddle(ctx.mode, "POST", "/v1/accounts/resolve", { bankCode: r.bankCode, accountNumber: r.account });
          const name = (result.data as Record<string, unknown> | null)?.["accountName"];
          if (typeof name !== "string" || !name.trim()) throw new Error();
          r.name = name.trim(); r.state = "ready";
        } catch { r.state = "failed"; r.error = "Bank could not confirm this account. Correct the file before sending."; }
      }));
    }
    const id = crypto.randomUUID();
    const saved = await ctx.db.from("payment_batches").insert({ id, user_id: ctx.user.id, mode: ctx.mode, fingerprint, rows });
    if (saved.error) {
      const winner = await ctx.db.from("payment_batches").select("id").eq("user_id", ctx.user.id).eq("mode", ctx.mode).eq("fingerprint", fingerprint).maybeSingle();
      if (winner.data) return { id: winner.data.id as string, reused: true };
      throw new Error("Could not save this batch. No payments have been sent.");
    }
    return { id, reused: false };
  });

export const listPaymentBatches = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const ctx = await bankingUser();
  const result = await ctx.db.from("payment_batches").select("id,created_at").eq("user_id", ctx.user.id).eq("mode", ctx.mode).order("created_at", { ascending: false }).limit(20);
  if (result.error) throw new Error("Saved batches are unavailable until payment reliability setup is applied.");
  return result.data as { id: string; created_at: string }[];
});

export const readPaymentBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const ctx = await bankingUser();
    const batch = await ctx.db.from("payment_batches").select("rows").eq("id", data.id).eq("user_id", ctx.user.id).eq("mode", ctx.mode).single();
    if (batch.error) throw new Error("Could not load this saved batch.");
    const rows = batch.data.rows as BatchRow[];
    const receipts = await ctx.db.from("payment_receipts").select("idempotency_key,status,provider_reference").eq("user_id", ctx.user.id).eq("mode", ctx.mode).in("idempotency_key", rows.map((r) => r.key));
    if (receipts.error) throw new Error("Could not confirm batch payment statuses. Do not retry payments.");
    for (const r of rows) {
      const receipt = receipts.data?.find((x) => x.idempotency_key === r.key);
      if (receipt) { r.state = receipt.status === "succeeded" ? "sent" : receipt.status === "failed" ? "failed" : "pending"; r.msg = receipt.provider_reference ?? (r.state === "pending" ? "Awaiting bank confirmation; do not resend" : "Payment recorded in ledger"); }
    }
    return { id: data.id, rows, totals: bulkTotals(rows.filter((r) => r.state === "ready")), mode: ctx.mode };
  });