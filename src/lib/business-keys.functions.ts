import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { keyAction } from "./business-api";

export const listBusinessKeys = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const { bankingUser } = await import("./paddle.server");
  const { db, user, role } = await bankingUser();
  if (role !== "merchant") throw new Error("Business accounts only.");
  const keys = await db.from("business_api_keys").select("id,mode,scopes,created_at,expires_at,claimed_at,revoked_at,last_used_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (keys.error) throw new Error("Business API keys need the account service setup.");
  return keys.data ?? [];
});

export const startKeyEmailCode = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const { bankingUser } = await import("./paddle.server");
  const { user, role } = await bankingUser();
  if (role !== "merchant") throw new Error("Business accounts only.");
  const { sendEmailCode } = await import("./email-otp.server");
  return sendEmailCode(user.id, user.email ?? undefined, "Your Slikpay API key code", "confirm your API key action");
});

export const manageBusinessKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => keyAction.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { bankingUser } = await import("./paddle.server");
    const { db, user, role } = await bankingUser();
    if (role !== "merchant") throw new Error("Business accounts only.");
    const key = await db.from("business_api_keys").select("id,mode,revoked_at").eq("id", data.id).eq("user_id", user.id).maybeSingle();
    if (key.error || !key.data) throw new Error("Key unavailable.");
    const { verifyEmailCode } = await import("./email-otp.server");
    await verifyEmailCode(user.id, data.challengeId, data.code);
    if (data.action === "revoke") {
      const r = await db.from("business_api_keys").update({ revoked_at: new Date().toISOString(), encrypted_secret: null }).eq("id", data.id).eq("user_id", user.id).select("id").maybeSingle();
      if (r.error || !r.data) throw new Error("Key could not be revoked.");
      return { secret: null };
    }
    let id = data.id;
    if (data.action === "rotate") {
      const issued = await db.rpc("issue_business_api_key", { p_user: user.id, p_mode: key.data.mode, p_rotate: true });
      if (issued.error || typeof issued.data !== "string") throw new Error("Key could not be rotated.");
      id = issued.data;
    }
    const claimed = await db.rpc("claim_business_api_key", { p_user: user.id, p_id: id });
    if (claimed.error || typeof claimed.data !== "string") throw new Error("Key already claimed or unavailable. Rotate to replace it.");
    return { secret: claimed.data };
  });