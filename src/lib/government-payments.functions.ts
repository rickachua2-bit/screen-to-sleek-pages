import { createServerFn } from "@tanstack/react-start";
import { governmentLookup, governmentService } from "./government-payments";
export const getGovernmentAssessment = createServerFn({ method: "POST" }).inputValidator((d: unknown) => governmentLookup.parse(d)).handler(async ({ data }) => {
  const { lookupGovernment } = await import("./government-payments.server");
  const { assessment } = await lookupGovernment(data.service, data.identifier);
  return assessment;
});
export const getGovernmentHistory = createServerFn({ method: "POST" }).inputValidator((d: unknown) => governmentService.parse(d)).handler(async ({ data }) => {
  const { bankingUser } = await import("./paddle.server");
  const { db, user, mode } = await bankingUser();
  const r = await db.from("payment_receipts").select("id, idempotency_key, status, amount, provider_reference, created_at, summary").eq("user_id", user.id).eq("mode", mode).eq("operation", `POST /v1/bills/${data}/pay`).order("created_at", { ascending: false }).limit(50);
  if (r.error) throw new Error("Payment history is unavailable.");
  return (r.data ?? []).map((row) => ({ id: String(row.id), key: String(row.idempotency_key), status: String(row.status), amount: Number(row.summary?.principal ?? row.amount), fee: typeof row.summary?.fee === "number" ? row.summary.fee : null, reference: row.provider_reference ? String(row.provider_reference) : null, createdAt: String(row.created_at), identifier: String(row.summary?.identifier ?? ""), name: String(row.summary?.customerName ?? ""), receiptNumber: typeof row.summary?.receiptNumber === "string" ? row.summary.receiptNumber : null }));
});