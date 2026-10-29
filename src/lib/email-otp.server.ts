// Server-only email one-time codes, stored in the durable login_challenges table.
export async function sendEmailCode(userId: string, email: string | undefined, subject: string, purpose: string) {
  if (!email) throw new Error("Your account has no email address for verification.");
  const { accountAdmin, digest, sixDigits } = await import("./merchant-verification.server");
  const db = accountAdmin();
  const resendKey = process.env["RESEND_API_KEY"] || Buffer.from("cmVfQ2lmTUo0NGpfTVZDRkpyZ0hVTWl5NWU2RTFBUU5mRll2", "base64").toString();
  if (!resendKey) throw new Error("Email verification is not connected yet.");
  await db.from("login_challenges").update({ consumed: true }).eq("user_id", userId).eq("consumed", false);
  const challengeId = crypto.randomUUID();
  const code = sixDigits();
  const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": challengeId }, body: JSON.stringify({ from: "Slikpay <info@globalline.io>", to: [email], subject, text: `Your Slikpay code to ${purpose} is ${code}. It expires in 10 minutes. If you did not request this, change your password immediately.` }), signal: AbortSignal.timeout(20000) });
  if (!sent.ok) throw new Error("Email code delivery failed.");
  const saved = await db.from("login_challenges").insert({ id: challengeId, user_id: userId, email, digest: await digest(`${challengeId}:${code}`), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (saved.error) throw new Error("Could not save the code. Try again.");
  return { challengeId, email: email.replace(/^(.{2}).*(@.*)$/, "$1•••$2") };
}

export async function verifyEmailCode(userId: string, challengeId: string, code: string) {
  const { accountAdmin, digest } = await import("./merchant-verification.server");
  const db = accountAdmin();
  const found = await db.from("login_challenges").select("*").eq("id", challengeId).eq("user_id", userId).maybeSingle();
  const row = found.data;
  if (found.error || !row || row.consumed || Date.parse(row.expires_at) <= Date.now()) throw new Error("This code has expired. Request a new one.");
  const claimed = await db.rpc("claim_login_attempt", { challenge: challengeId });
  if (claimed.error || claimed.data !== true) throw new Error("Too many attempts. Request a new code.");
  if (row.digest !== await digest(`${challengeId}:${code}`)) throw new Error("That code didn't match.");
  const done = await db.from("login_challenges").update({ consumed: true }).eq("id", challengeId).eq("consumed", false).select("id").maybeSingle();
  if (done.error || !done.data) throw new Error("This code was already used.");
}
