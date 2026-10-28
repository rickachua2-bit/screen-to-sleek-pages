import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ENDPOINTS, accessFor, amountOf, fillPath, movesMoney, resourceIds, scopeOf } from "./paddle-policy";

export const getBankingProfile = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { db, user, role, mode, review } = await bankingUser();
  const [kyc, ledger, receipts] = await Promise.all([
    db.from("kyc_steps").select("step, status, summary, created_at").eq("user_id", user.id),
    db.from("ledger_entries").select("amount, currency, status").eq("user_id", user.id).eq("mode", mode).in("status", ["held", "posted"]),
    db.from("payment_receipts").select("id, operation, status, amount, currency, provider_reference, session_id, created_at, mode").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
  ]);
  const balances: Record<string, number> = {};
  for (const e of ledger.data ?? []) balances[e.currency] = (balances[e.currency] ?? 0) + Number(e.amount);
  return { role, mode, review, kyc: kyc.data ?? [], balances, receipts: receipts.data ?? [], sandboxReady: Boolean(process.env["PADDLE_SANDBOX_KEY"]) };
});

const runSchema = z.object({
  id: z.string().max(120),
  params: z.record(z.string(), z.string().max(80)).default({}),
  body: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("NGN"),
});

export const runPaddleOperation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => runSchema.parse(d))
  .handler(async ({ data }) => {
    const endpoint = ENDPOINTS.find((e) => e.id === data.id);
    if (!endpoint) throw new Error("Unknown service.");
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { db, user, role, mode, review } = await bankingUser();
    const access = accessFor(endpoint, role, mode);
    if (!access.allowed) throw new Error(access.reason);
    if (JSON.stringify(data.body).length > 20000) throw new Error("Request is too large.");
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before using live services.");
    const path = fillPath(endpoint.path, data.params);

    // Resource-specific calls must target something this user created.
    if (scopeOf(endpoint) === "owned") {
      const ids = Object.values(data.params);
      const owned = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).in("resource_id", ids);
      if (owned.error || (owned.data ?? []).length !== ids.length) throw new Error("That item doesn't belong to your account.");
    }

    const money = movesMoney(endpoint);
    const amount = amountOf(data.body);
    const operation = `${endpoint.method} ${endpoint.path}`;
    if (money) {
      if (!amount) throw new Error("Enter a valid amount.");
      if (mode === "live") {
        if (!data.pin) throw new Error("Enter your 4-digit transaction PIN.");
        const sec = await db.from("merchant_security").select("pin_digest, pin_salt").eq("user_id", user.id).maybeSingle();
        const { pinDigest } = await import("./merchant-verification.server");
        if (!sec.data || sec.data.pin_digest !== await pinDigest(data.pin, sec.data.pin_salt)) throw new Error("Incorrect transaction PIN.");
        const held = await db.rpc("hold_funds", { p_user: user.id, p_mode: mode, p_currency: data.currency, p_amount: amount, p_operation: operation, p_reference: data.idempotencyKey });
        if (held.error) throw new Error("Could not reserve funds. Try again.");
        if (held.data !== true) throw new Error("Insufficient balance for this transaction.");
      }
      const receipt = await db.from("payment_receipts").insert({ user_id: user.id, mode, operation, idempotency_key: data.idempotencyKey, status: "pending", amount, currency: data.currency });
      if (receipt.error) throw new Error("This request was already submitted.");
    }

    try {
      const result = await callPaddle(mode, endpoint.method, path, endpoint.method === "GET" ? data.body : data.body, money ? data.idempotencyKey : undefined);
      if (scopeOf(endpoint) === "create" || scopeOf(endpoint) === "sandbox") {
        const ids = [...resourceIds(result.data)];
        if (ids.length) await db.from("paddle_resources").upsert(ids.map((resource_id) => ({ user_id: user.id, mode, resource_id, operation })), { onConflict: "mode,resource_id", ignoreDuplicates: true });
      }
      let receipt = null;
      if (money) {
        const d = (result.data ?? {}) as Record<string, unknown>;
        const ref = [d["reference"], d["transactionReference"], d["id"]].find((v) => typeof v === "string") as string | undefined;
        const session = [d["sessionId"], d["nipSessionId"], d["session_id"]].find((v) => typeof v === "string") as string | undefined;
        await db.from("payment_receipts").update({ status: "succeeded", provider_reference: ref ?? null, session_id: session ?? null }).eq("idempotency_key", data.idempotencyKey);
        if (mode === "live") await db.from("ledger_entries").update({ status: "posted" }).eq("reference", data.idempotencyKey);
        receipt = { reference: ref ?? null, sessionId: session ?? null, amount, currency: data.currency, mode };
      }
      return { mode, message: result.message ?? null, resultJson: JSON.stringify(result.data ?? null).slice(0, 200000), receipt };
    } catch (e) {
      if (money) {
        await db.from("payment_receipts").update({ status: "failed" }).eq("idempotency_key", data.idempotencyKey);
        if (mode === "live") await db.from("ledger_entries").update({ status: "released" }).eq("reference", data.idempotencyKey);
      }
      throw e;
    }
  });

// Director (business) or holder (personal) BVN check — first step towards live.
export const submitIdentityCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ bvn: z.string().regex(/^\d{11}$/), firstName: z.string().trim().min(2).max(60), lastName: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { db, user, role, mode } = await bankingUser();
    const step = role === "merchant" ? "director_bvn" : "personal_bvn";
    const result = await callPaddle(mode, "POST", "/v1/identity/bvn", data);
    const d = (result.data ?? {}) as Record<string, unknown>;
    const verified = d["verified"] === true || d["status"] === "VERIFIED" || d["isValid"] === true;
    const save = await db.from("kyc_steps").upsert({ user_id: user.id, step, status: verified ? "verified" : "failed", summary: verified ? `${data.firstName} ${data.lastName}` : "BVN details did not match", provider_reference: typeof d["reference"] === "string" ? d["reference"] : null }, { onConflict: "user_id,step" });
    if (save.error) throw new Error("Could not save the verification result.");
    if (verified) await db.from("account_modes").update({ review_status: "in_progress" }).eq("user_id", user.id).eq("review_status", "not_started");
    return { verified, step };
  });
