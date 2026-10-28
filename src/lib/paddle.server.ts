import { getRequestHeader } from "@tanstack/react-start/server";
import { accountAdmin } from "./merchant-verification.server";
import { paddleFailure } from "./provider-errors";
import type { Mode, Role } from "./paddle-policy";

const BASE = "https://api.getpaddle.online/v1";

export function paddleKey(mode: Mode) {
  const key = mode === "live" ? process.env["PADDLE_BAAS_KEY"] : process.env["PADDLE_SANDBOX_KEY"];
  if (!key) throw new Error(mode === "live" ? "Live access is not connected yet." : "Sandbox is not connected yet.");
  if (!key.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) throw new Error(`The saved ${mode} key has the wrong prefix.`);
  return key;
}

export async function callPaddle(mode: Mode, method: string, path: string, body?: object, idempotencyKey?: string) {
  const key = paddleKey(mode);
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const url = new URL(BASE + path.replace(/^\/v1/, ""));
  if (method === "GET" && body) for (const [k, v] of Object.entries(body)) if (v !== "" && v != null) url.searchParams.set(k, String(v));
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(30000) };
  if (method !== "GET") init.body = JSON.stringify(body ?? {});
  const response = await fetch(url, init);
  const payload: unknown = await response.json().catch(() => null);
  // Never log keys, PINs or provider bodies.
  if (!response.ok) throw new Error(paddleFailure(response.status, payload, response.headers.get("Retry-After"), response.headers.get("X-RateLimit-Reset")));
  const p = payload as { success?: boolean; data?: unknown; message?: string } | null;
  if (p && p.success === false) throw new Error("The service did not confirm this request.");
  return { data: p && "data" in p ? p.data : payload, message: typeof p?.message === "string" ? p.message.slice(0, 200) : undefined };
}

export async function bankingUser() {
  const authorization = getRequestHeader("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Sign in to use banking services.");
  const db = accountAdmin();
  const user = await db.auth.getUser(authorization.slice(7));
  if (user.error || !user.data.user) throw new Error("Your session has expired. Sign in again.");
  const u = user.data.user;
  const role: Role = u.user_metadata?.["role"] === "personal" ? "personal" : "merchant";
  const modeRow = await db.from("account_modes").select("mode, review_status").eq("user_id", u.id).maybeSingle();
  if (modeRow.error) throw new Error("Banking setup is waiting for the account service script (slikpay_banking.sql).");
  let mode: Mode = "sandbox";
  let review = "not_started";
  if (modeRow.data) { mode = modeRow.data.mode === "live" ? "live" : "sandbox"; review = modeRow.data.review_status; }
  else await db.from("account_modes").insert({ user_id: u.id });
  return { db, user: u, role, mode, review };
}

export async function verifySignature(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, "0")).join("");
  const given = signature.replace(/^sha256=/, "").toLowerCase();
  if (given.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
