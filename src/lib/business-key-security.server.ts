import type { SupabaseClient } from "@supabase/supabase-js";
import { pinDigest } from "./merchant-verification.server";
export async function verifyKeyPin(db: SupabaseClient, userId: string, pin: string) {
  const attempt = await db.rpc("claim_security_attempt", { p_user: userId });
  if (attempt.error || attempt.data !== true) throw new Error("Key access temporarily locked. Try later.");
  const row = await db.from("merchant_security").select("pin_digest,pin_salt").eq("user_id", userId).maybeSingle();
  if (row.error || !row.data || row.data.pin_digest !== await pinDigest(pin, row.data.pin_salt)) throw new Error("Incorrect transaction PIN.");
}