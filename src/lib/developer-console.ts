import { z } from "zod";

export const webhookQuery = z.object({ status: z.enum(["all", "processed", "pending"]).default("all") });
export const webhookRetry = z.object({ id: z.string().trim().min(1).max(240) });
const sensitive = /pin|password|secret|token|authorization|api.?key|bvn|cvv|cvc|pan|cardnumber/i;
export function redactConsole(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[Truncated]";
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redactConsole(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, sensitive.test(key) ? "[Redacted]" : redactConsole(v, depth + 1)]));
  return typeof value === "string" ? value.slice(0, 4000) : value;
}
export function webhookAccount(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as Record<string, unknown>)["data"];
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const meta = d["metadata"];
  const m = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  const account = m["recipientAccountNumber"] ?? d["accountNumber"] ?? d["virtualAccountNumber"];
  return typeof account === "string" && /^\d{10}$/.test(account) ? account : null;
}
export const MAX_WEBHOOK_BYTES = 100000;
export async function readWebhookBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } finally { reader.releaseLock(); }
}