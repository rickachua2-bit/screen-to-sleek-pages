import type { User } from "@supabase/supabase-js";
import { callPaddle } from "./paddle.server";
import type { accountAdmin } from "./merchant-verification.server";
import type { Mode } from "./paddle-policy";

type Db = ReturnType<typeof accountAdmin>;

export const LINK_OP = "POST /v1/gateway/initialize";
export const LINK_CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;
export type LinkStatus = "paid" | "awaiting" | "failed" | "unknown";

/** Extracts the hosted checkout URL from whatever shape the service returns. */
export function checkoutUrl(d: Record<string, unknown>): string | null {
  for (const k of ["authorization_url", "authorizationUrl", "checkout_url", "checkoutUrl", "payment_url", "paymentUrl", "url", "link"]) {
    const v = d[k];
    if (typeof v === "string" && v.startsWith("https://")) return v;
  }
  return null;
}

export function settleStatus(d: Record<string, unknown>): LinkStatus {
  const raw = [d["status"], d["paymentStatus"], d["state"]].find((v) => typeof v === "string");
  const s = typeof raw === "string" ? raw.toUpperCase() : "";
  if (["SUCCESSFUL", "SUCCESS", "PAID", "COMPLETED", "SETTLED"].includes(s)) return "paid";
  if (["FAILED", "DECLINED", "REJECTED", "REVERSED", "EXPIRED", "ABANDONED"].includes(s)) return "failed";
  if (s) return "awaiting";
  return "unknown";
}

/**
 * Creates a hosted checkout session and stores it durably for this user.
 * Replaying the same detail operation returns the original URL without creating a second session.
 */
export async function hostedCheckout(
  db: Db,
  user: User,
  mode: Mode,
  input: { amount: number; currency: string; email: string; name?: string | undefined; reference: string; operation: string },
  buildDetail: (url: string) => unknown,
): Promise<{ url: string; reused: boolean }> {
  const prior = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", input.operation).maybeSingle();
  if (prior.error) throw new Error("Could not check existing checkouts. Try again.");
  if (prior.data) {
    try {
      const v = JSON.parse(prior.data.resource_id) as { url?: unknown };
      if (typeof v.url === "string") return { url: v.url, reused: true };
    } catch { /* fall through and create */ }
  }
  const result = await callPaddle(mode, "POST", "/v1/gateway/initialize", {
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    ...(input.name ? { name: input.name } : {}),
    reference: input.reference,
  }, input.reference);
  const url = checkoutUrl((result.data ?? {}) as Record<string, unknown>);
  if (!url) throw new Error("The service did not return a checkout link. Try again.");
  // The ownership row lets this user verify the reference; the detail row stores the record itself.
  const rows = await db.from("paddle_resources").upsert([
    { user_id: user.id, mode, resource_id: input.reference, operation: LINK_OP },
    { user_id: user.id, mode, resource_id: JSON.stringify(buildDetail(url)), operation: input.operation },
  ], { onConflict: "mode,resource_id", ignoreDuplicates: true });
  if (rows.error) throw new Error("The checkout was created but could not be saved. Check your records before creating another.");
  return { url, reused: false };
}

/** Reads per-user JSON detail rows stored under an operation prefix, newest first. */
export async function listDetails<T>(db: Db, userId: string, mode: Mode, opPrefix: string, parse: (raw: string) => T | null, limit = 50): Promise<T[]> {
  const rows = await db.from("paddle_resources").select("resource_id").eq("user_id", userId).eq("mode", mode).like("operation", `${opPrefix} %`).order("created_at", { ascending: false }).limit(limit);
  if (rows.error) throw new Error("Records could not be loaded. Try again.");
  return (rows.data ?? []).map((r) => parse(r.resource_id)).filter((v): v is T => v !== null);
}

/** Live settlement status for one checkout reference; "unknown" when the network can't confirm. */
export async function verifyStatus(mode: Mode, reference: string): Promise<LinkStatus> {
  try {
    const r = await callPaddle(mode, "GET", `/v1/gateway/verify/${encodeURIComponent(reference)}`);
    return settleStatus((r.data ?? {}) as Record<string, unknown>);
  } catch { return "unknown"; }
}
