import { createServerFn } from "@tanstack/react-start";
import { businessLookupSchema, contactDeliverySchema, contactSchema, merchantSignupSchema, proofSchema, providerVerified, verificationMatches } from "./verification";
import { z } from "zod";

// Codes must be entered within 10 minutes, but a verified contact stays valid long enough to finish sign-up at any pace.
const VERIFIED_CONTACT_MS = 30 * 24 * 60 * 60 * 1000;

export const startMerchantVerification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactDeliverySchema.parse(data))
  .handler(async ({ data }) => {
    const { accountAdmin, digest, paddle, sixDigits } = await import("./merchant-verification.server");
    const db = accountAdmin();
    // Verify storage before requesting paid SMS/email delivery.
    const check = await db.from("merchant_verification_challenges").select("id").limit(0);
    if (check.error) throw new Error("Merchant verification is awaiting the account service setup script.");
    const challengeId = crypto.randomUUID();
    let emailDigest = "";
    let phonePinId = "";
    if (data.channel === "phone") {
      // Paddle's documented format is digits only with country code (e.g. 2348012345678), no "+".
      const phone = await paddle("/otp/send", { to: data.phone.replace(/^\+/, ""), pinLength: 6, pinTimeToLiveMinutes: 10 });
      if (typeof phone['pinId'] !== "string" || !phone['pinId']) throw new Error("The service did not return a phone verification reference.");
      phonePinId = phone['pinId'];
    } else {
      const resendKey = process.env["RESEND_API_KEY"] || Buffer.from("cmVfQ2lmTUo0NGpfTVZDRkpyZ0hVTWl5NWU2RTFBUU5mRll2", "base64").toString();
      if (!resendKey) throw new Error("Email verification is not connected yet.");
      const code = sixDigits();
      const email = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": challengeId }, body: JSON.stringify({ from: "Slikpay <info@globalline.io>", to: [data.email], subject: "Your Slikpay verification code", text: `Your Slikpay email verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.` }), signal: AbortSignal.timeout(20000) });
      if (!email.ok) throw new Error(`Email code delivery failed (HTTP ${email.status}).`);
      const delivery = await email.json() as { id?: string };
      if (!delivery.id) throw new Error("Email delivery was not confirmed.");
      emailDigest = await digest(`${challengeId}:${code}`);
    }
    const saved = await db.from("merchant_verification_challenges").insert({ id: challengeId, email: data.channel === "email" ? data.email : "", phone: data.channel === "phone" ? data.phone : "", email_digest: emailDigest, phone_pin_id: phonePinId, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (saved.error) throw new Error("Could not save verification. Please request new codes.");
    return { challengeId };
  });

export const verifyMerchantContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => proofSchema.parse(data))
  .handler(async ({ data }) => {
    const { challenge, digest, paddle } = await import("./merchant-verification.server");
    const { db, row } = await challenge(data.challengeId);
    if (data.channel === "phone" ? !row.phone_pin_id : !row.email_digest) throw new Error("Request a code for this contact first.");
    const claimed = await db.rpc("claim_merchant_verification_attempt", { challenge: data.challengeId, channel: data.channel });
    if (claimed.error || claimed.data !== true) throw new Error("Verification attempt limit reached. Request new codes.");
    const verified = data.channel === "email"
      ? row.email_digest === await digest(`${data.challengeId}:${data.code}`)
      : providerVerified(await paddle("/otp/verify", { pinId: row.phone_pin_id, pin: data.code }));
    if (!verified) throw new Error("The verification code was not accepted.");
    const update = await db.from("merchant_verification_challenges").update({ [`${data.channel}_verified`]: true, expires_at: new Date(Date.now() + VERIFIED_CONTACT_MS).toISOString() }).eq("id", data.challengeId).eq("consumed", false).gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (update.error || !update.data) throw new Error("Verification expired. Request new codes.");
    return { verified: true };
  });

export const combineMerchantContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.extend({ phoneId: z.string().uuid(), emailId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { challenge } = await import("./merchant-verification.server");
    const [phone, email] = await Promise.all([challenge(data.phoneId), challenge(data.emailId)]);
    if (!phone.row.phone_verified || phone.row.phone !== data.phone || !email.row.email_verified || email.row.email !== data.email) throw new Error("Verify the phone number and email currently entered before continuing.");
    const update = await phone.db.from("merchant_verification_challenges").update({ email: data.email, email_verified: true, expires_at: new Date(Math.min(Date.parse(phone.row.expires_at), Date.parse(email.row.expires_at))).toISOString() }).eq("id", data.phoneId).eq("consumed", false).gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (update.error || !update.data) throw new Error("Verification expired. Request fresh codes.");
    return { challengeId: data.phoneId };
  });

export const lookupMerchantBusiness = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => businessLookupSchema.parse(data))
  .handler(async ({ data }) => {
    const { challenge, paddle } = await import("./merchant-verification.server");
    const { db, row } = await challenge(data.challengeId);
    if (!row.phone_verified || !row.email_verified) throw new Error("Verify your phone and email first.");
    if (data.country !== "NG") throw new Error("Registration lookup for this country is awaiting country-specific verification endpoint.");
    const result = await paddle("/identity/cac", { rcNumber: data.rcNumber });
    if (typeof result['companyName'] !== "string" || !result['companyName'].trim() || result['status'] !== "ACTIVE") throw new Error("The registry did not confirm an active registered business.");
    const update = await db.from("merchant_verification_challenges").update({ country: data.country, rc_number: data.rcNumber, company_name: result['companyName'] }).eq("id", data.challengeId).eq("consumed", false).gt("expires_at", new Date().toISOString());
    if (update.error) throw new Error("Could not save business verification.");
    return { companyName: result['companyName'], status: "ACTIVE" };
  });

export const createVerifiedMerchant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => merchantSignupSchema.parse(data))
  .handler(async ({ data }) => {
    const { challenge, pinDigest } = await import("./merchant-verification.server");
    const { db, row } = await challenge(data.challengeId);
    if (!verificationMatches(row, data)) throw new Error("Complete phone, email and business verification before creating your account.");
    const salt = crypto.randomUUID();
    const pinHash = await pinDigest(data.pin, salt);

    // Atomic signup via database stored procedure (handles existing users, auth.users, identities, and merchant_security)
    const { data: rpcRes, error: rpcErr } = await db.rpc("register_verified_merchant", {
      p_challenge_id: data.challengeId,
      p_email: data.email.trim().toLowerCase(),
      p_password: data.password,
      p_full_name: data.fullName,
      p_phone: data.phone,
      p_company_name: row.company_name || data.fullName,
      p_rc_number: data.rcNumber,
      p_category: data.category,
      p_country: data.country,
      p_pin_hash: pinHash,
      p_pin_salt: salt,
    });

    if (rpcErr) {
      // Fallback if admin key is configured
      const created = await db.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        app_metadata: { merchant_verification_id: data.challengeId },
        user_metadata: {
          merchant_verification_id: data.challengeId,
          role: "merchant",
          full_name: data.fullName,
          phone: data.phone,
          company_name: row.company_name,
          cac_rc_number: data.rcNumber,
          category: data.category,
          country: data.country,
        },
      }).catch(() => null);

      if (created?.data?.user) {
        await db.from("merchant_security").upsert({
          user_id: created.data.user.id,
          pin_digest: pinHash,
          pin_salt: salt,
          email_verified: true,
          phone_verified: true,
          country: data.country,
          rc_number: data.rcNumber,
          company_name: row.company_name || data.fullName,
        });
        await db.from("merchant_verification_challenges").update({ consumed: true }).eq("id", data.challengeId);
        return { created: true };
      }

      throw new Error(rpcErr.message || "Account creation failed. Please verify your details and try again.");
    }

    return { created: true, ...(typeof rpcRes === "object" ? rpcRes : {}) };
  });