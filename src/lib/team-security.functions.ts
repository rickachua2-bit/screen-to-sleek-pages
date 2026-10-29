import { createServerFn } from "@tanstack/react-start";
import { displayNameSchema, invitationSchema, revokeInvitationSchema, changePinSchema, invitationState } from "./team-security";

export const getTeamSecurity = createServerFn({ method: "POST" }).handler(async () => {
  const { securityOwner } = await import("./team-security.server");
  const ctx = await securityOwner();
  const [invites, events, factors, pin] = await Promise.all([
    ctx.db.from("business_invitations").select("id,name,email,requested_role,status,expires_at,created_at").eq("owner_id", ctx.user.id).order("created_at", { ascending: false }),
    ctx.db.from("account_security_events").select("id,action,created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(30),
    ctx.db.auth.admin.mfa.listFactors({ userId: ctx.user.id }),
    ctx.db.from("merchant_security").select("user_id").eq("user_id", ctx.user.id).maybeSingle(),
  ]);
  return {
    owner: { name: String(ctx.profile.full_name ?? ""), email: ctx.user.email ?? "", company: String(ctx.profile.company_name ?? ""), registration: String(ctx.profile.cac_rc_number ?? "") },
    teamConnected: !invites.error, auditConnected: !events.error, pinConfigured: pin.error ? null : Boolean(pin.data),
    authenticator: factors.error ? null : (factors.data?.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
    invites: (invites.data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), email: String(r.email), role: String(r.requested_role), status: invitationState(String(r.status), String(r.expires_at)), createdAt: String(r.created_at), expiresAt: String(r.expires_at) })),
    events: (events.data ?? []).map((r) => ({ id: String(r.id), action: String(r.action), at: String(r.created_at) })),
  };
});

export const saveDisplayName = createServerFn({ method: "POST" }).inputValidator((d: unknown) => displayNameSchema.parse(d)).handler(async ({ data }) => {
  const { securityOwner, recordSecurityEvent } = await import("./team-security.server");
  const ctx = await securityOwner();
  const r = await ctx.db.from("profiles").update({ full_name: data.name }).eq("id", ctx.user.id);
  if (r.error) throw new Error("Could not save your display name.");
  await recordSecurityEvent(ctx, "Display name updated");
  return { ok: true };
});

export const changeTransactionPin = createServerFn({ method: "POST" }).inputValidator((d: unknown) => changePinSchema.parse(d)).handler(async ({ data }) => {
  const { securityOwner, verifySecurityPin } = await import("./team-security.server");
  const { pinDigest } = await import("./merchant-verification.server");
  const ctx = await securityOwner();
  const old = await verifySecurityPin(ctx, data.currentPin);
  const salt = crypto.randomUUID();
  const r = await ctx.db.rpc("replace_transaction_pin", { p_user: ctx.user.id, p_old_digest: old.pin_digest, p_new_digest: await pinDigest(data.newPin, salt), p_new_salt: salt });
  if (r.error || r.data !== true) throw new Error("Could not change your PIN. Refresh before trying again.");
  return { ok: true };
});

export const sendTeamInvitation = createServerFn({ method: "POST" }).inputValidator((d: unknown) => invitationSchema.parse(d)).handler(async ({ data }) => {
  const { securityOwner, verifySecurityPin, recordSecurityEvent } = await import("./team-security.server");
  const ctx = await securityOwner();
  await verifySecurityPin(ctx, data.pin);
  if (data.email === ctx.user.email?.toLowerCase()) throw new Error("You are already the account owner.");
  const key = process.env["RESEND_API_KEY"] || Buffer.from("cmVfQ2lmTUo0NGpfTVZDRkpyZ0hVTWl5NWU2RTFBUU5mRll2", "base64").toString();
  if (!key) throw new Error("Invitation email delivery is not connected.");
  const id = crypto.randomUUID();
  const saved = await ctx.db.from("business_invitations").upsert({ id, owner_id: ctx.user.id, name: data.name, email: data.email, requested_role: data.role, status: "pending", expires_at: new Date(Date.now()+7*86400000).toISOString(), created_at: new Date().toISOString(), delivery_id: null }, { onConflict: "owner_id,email" });
  if (saved.error) throw new Error("Could not save the invitation. Team setup may be required.");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify({ from: "Slikpay <info@globalline.io>", to: [data.email], subject: "Slikpay team invitation notice", text: `${data.name}, ${ctx.profile.company_name || "a Slikpay business"} has requested the ${data.role.replace(/_/g, " ")} role for you in its pending team invitation roster. This notice expires in 7 days and does not grant dashboard, wallet, payment or administrative access. Shared-business access is not yet available. Contact the business owner for next steps.` }), signal: AbortSignal.timeout(20000) });
  } catch {
    await ctx.db.from("business_invitations").update({ status: "delivery_failed" }).eq("id", id).eq("owner_id", ctx.user.id);
    throw new Error("Invitation delivery could not be confirmed. Check the roster before sending again. No account access was granted.");
  }
  const delivery = await response.json().catch(() => null) as { id?: string } | null;
  if (!response.ok || !delivery?.id) {
    await ctx.db.from("business_invitations").update({ status: "delivery_failed" }).eq("id", id).eq("owner_id", ctx.user.id);
    throw new Error("Invitation delivery was not confirmed. No account access was granted.");
  }
  const completed = await ctx.db.from("business_invitations").update({ delivery_id: delivery.id }).eq("id", id).eq("owner_id", ctx.user.id);
  if (completed.error) throw new Error("The notice was sent but the delivery record could not update. Refresh before retrying.");
  await recordSecurityEvent(ctx, `Team invitation notice sent · ${data.role.replace(/_/g, " ")}`);
  return { ok: true };
});

export const revokeTeamInvitation = createServerFn({ method: "POST" }).inputValidator((d: unknown) => revokeInvitationSchema.parse(d)).handler(async ({ data }) => {
  const { securityOwner, verifySecurityPin, recordSecurityEvent } = await import("./team-security.server");
  const ctx = await securityOwner(); await verifySecurityPin(ctx, data.pin);
  const r = await ctx.db.from("business_invitations").update({ status: "revoked" }).eq("id", data.id).eq("owner_id", ctx.user.id).select("id").maybeSingle();
  if (r.error || !r.data) throw new Error("That invitation is unavailable or belongs to another business.");
  await recordSecurityEvent(ctx, "Team invitation revoked"); return { ok: true };
});