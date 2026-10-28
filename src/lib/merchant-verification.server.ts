import { createClient } from "@supabase/supabase-js";
import { paddleFailure } from "./provider-errors";

const ACCOUNT_URL = "https://gqbgdqkmdyvzgovugjku.supabase.co";
export function accountAdmin() {
  const key = process.env['SLIKPAY_SUPABASE_SERVER_KEY'];
  if (!key) throw new Error("Secure merchant verification is not configured yet.");
  return createClient(ACCOUNT_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const h = new Headers(init?.headers);
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  } } });
}

export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pinDigest(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 600000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sixDigits() {
  const a = new Uint32Array(1);
  let n = 0;
  do { crypto.getRandomValues(a); n = a[0] ?? 0; } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, "0");
}

export async function paddle(path: "/otp/send" | "/otp/verify" | "/identity/cac" | "/accounts/resolve", body: object) {
  const key = process.env['PADDLE_BAAS_KEY'];
  if (!key) throw new Error("Verification is not connected yet.");
  const base = process.env['PADDLE_BAAS_URL'] || "https://api.getpaddle.online/v1";
  if (base.replace(/\/$/, "") !== "https://api.getpaddle.online/v1") throw new Error("Paddle service URL must match the approved provider.");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  // Never log OTPs, keys, bank details or provider response bodies.
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(paddleFailure(response.status, payload, response.headers.get("Retry-After"), response.headers.get("X-RateLimit-Reset")));
  }
  const result = await response.json() as { success?: boolean; data?: Record<string, unknown> };
  if (result.success !== true || !result.data) throw new Error("The service did not confirm this request.");
  return result.data;
}

export async function challenge(id: string) {
  const db = accountAdmin();
  const { data, error } = await db.from("merchant_verification_challenges").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Verification storage is unavailable. The account service needs the verification setup script.");
  if (!data || data.consumed || Date.parse(data.expires_at) <= Date.now()) throw new Error("Verification expired. Request new codes.");
  return { db, row: data };
}