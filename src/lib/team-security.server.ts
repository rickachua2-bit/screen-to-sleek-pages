import { bankingUser } from "./paddle.server";
import { pinDigest } from "./merchant-verification.server";
export async function securityOwner() {
  const ctx = await bankingUser();
  // Existing authenticated account classification is read from the protected profile,
  // never client storage or editable auth metadata.
  const p = await ctx.db.from("profiles").select("role,full_name,company_name,cac_rc_number").eq("id", ctx.user.id).maybeSingle();
  if (p.error || !p.data || p.data.role !== "merchant") throw new Error("Team settings require a business account.");
  return { ...ctx, profile: p.data };
}
export async function verifySecurityPin(ctx: Awaited<ReturnType<typeof securityOwner>>, pin: string) {
  const claimed = await ctx.db.rpc("claim_security_attempt", { p_user: ctx.user.id });
  if (claimed.error) throw new Error("Security actions are not connected yet. Apply the Team & Security setup first.");
  if (claimed.data !== true) throw new Error("Too many security attempts. Wait 15 minutes before trying again.");
  const r = await ctx.db.from("merchant_security").select("pin_digest,pin_salt").eq("user_id", ctx.user.id).maybeSingle();
  if (r.error || !r.data) throw new Error("Transaction PIN is unavailable.");
  const digest = await pinDigest(pin, r.data.pin_salt);
  if (digest !== r.data.pin_digest) throw new Error("Incorrect transaction PIN.");
  return r.data;
}
export async function recordSecurityEvent(ctx: Awaited<ReturnType<typeof securityOwner>>, action: string) {
  const r = await ctx.db.from("account_security_events").insert({ user_id: ctx.user.id, action });
  if (r.error) throw new Error("The change was saved but the security record is unavailable. Refresh before retrying.");
}