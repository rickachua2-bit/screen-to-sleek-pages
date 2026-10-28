import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export const loginCodeSchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

// Sign-in 2FA for accounts without an authenticator app: a 6-digit code emailed to the
// address on the account. The caller must already hold a valid password session (AAL1);
// the bearer token is re-validated here before any code is sent or accepted.
async function loginUser() {
  const authorization = getRequestHeader("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Sign in first.");
  const { accountAdmin } = await import("./merchant-verification.server");
  const db = accountAdmin();
  const user = await db.auth.getUser(authorization.slice(7));
  if (user.error || !user.data.user) throw new Error("Your session has expired. Sign in again.");
  return { db, user: user.data.user };
}

export const startLoginEmailCode = createServerFn({ method: "POST" }).handler(async () => {
  const { db, user } = await loginUser();
  const email = user.email;
  if (!email) throw new Error("Your account has no email address for verification.");
  const { digest, sixDigits } = await import("./merchant-verification.server");
  const resendKey = process.env['RESEND_API_KEY'];
  if (!resendKey) throw new Error("Email verification is not connected yet.");
  // One live challenge per user: older unconsumed codes stop working the moment a new one is sent.
  await db.from("login_challenges").update({ consumed: true }).eq("user_id", user.id).eq("consumed", false);
  const challengeId = crypto.randomUUID();
  const code = sixDigits();
  const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": challengeId }, body: JSON.stringify({ from: "Slikpay <info@globalline.io>", to: [email], subject: "Your Slikpay sign-in code", text: `Your Slikpay sign-in code is ${code}. It expires in 10 minutes. If you did not try to sign in, change your password immediately.` }), signal: AbortSignal.timeout(20000) });
  if (!sent.ok) throw new Error(`Email code delivery failed (HTTP ${sent.status}).`);
  const delivery = await sent.json() as { id?: string };
  if (!delivery.id) throw new Error("Email delivery was not confirmed.");
  const saved = await db.from("login_challenges").insert({ id: challengeId, user_id: user.id, email, digest: await digest(`${challengeId}:${code}`), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (saved.error) throw new Error("Could not save the sign-in code. Try again.");
  return { challengeId, email: email.replace(/^(.{2}).*(@.*)$/, "$1•••$2") };
});

export const verifyLoginEmailCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginCodeSchema.parse(data))
  .handler(async ({ data }) => {
    const { db, user } = await loginUser();
    const { digest } = await import("./merchant-verification.server");
    const found = await db.from("login_challenges").select("*").eq("id", data.challengeId).eq("user_id", user.id).maybeSingle();
    if (found.error) throw new Error("Sign-in verification is unavailable. Try again.");
    const row = found.data;
    if (!row || row.consumed || Date.parse(row.expires_at) <= Date.now()) throw new Error("This code has expired. Request a new one.");
    const claimed = await db.rpc("claim_login_attempt", { challenge: data.challengeId });
    if (claimed.error || claimed.data !== true) throw new Error("Too many attempts. Request a new code.");
    if (row.digest !== await digest(`${data.challengeId}:${data.code}`)) throw new Error("That code didn't match. Check the email and try again.");
    const done = await db.from("login_challenges").update({ consumed: true }).eq("id", data.challengeId).eq("consumed", false).select("id").maybeSingle();
    if (done.error || !done.data) throw new Error("This code was already used. Request a new one.");
    return { verified: true };
  });
