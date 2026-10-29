import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { slikpayTransferFee, payoutBody, payoutStatus } from "./transfer-validation";
import { ENDPOINTS, accessFor, amountOf, fillPath, movesMoney, resourceIds, scopeOf } from "./paddle-policy";
import { INTERNATIONAL_NOT_ACTIVE, isUnverifiedInternationalPayout } from "./international";

export const getBankingProfile = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { db, user, role, mode, review } = await bankingUser();
  const [kyc, ledger, receipts, resources] = await Promise.all([
    db.from("kyc_steps").select("step, status, summary, created_at").eq("user_id", user.id),
    db.from("ledger_entries").select("amount, currency, status").eq("user_id", user.id).eq("mode", mode).in("status", ["held", "posted"]),
    db.from("payment_receipts").select("id, operation, status, amount, currency, provider_reference, session_id, created_at, mode, summary").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
    db.from("paddle_resources").select("resource_id, operation").eq("user_id", user.id).eq("mode", mode).order("created_at", { ascending: true }),
  ]);
  if ([kyc, ledger, receipts, resources].some((r) => r.error)) {
    throw new Error("Banking records are unavailable. Balance and payment history could not be confirmed.");
  }
  const owned = resources.data ?? [];
  const virtualAccount = owned.find((r) => r.operation === "POST /v1/accounts/virtual" && /^\d{10}$/.test(r.resource_id))?.resource_id ?? null;
  let accountDetails: { accountName: string | null; bankName: string | null; status: string | null } | null = null;
  if (virtualAccount) {
    try {
      const { callPaddle } = await import("./paddle.server");
      const r = await callPaddle(mode, "GET", `/v1/accounts/virtual/${virtualAccount}`);
      const d = (r.data ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
      accountDetails = { accountName: str("accountName"), bankName: str("bankName"), status: str("status") };
    } catch { accountDetails = null; }
  }
  const cardIssued = owned.some((r) => r.operation.startsWith("POST /v1/cards"));
  const balances: Record<string, number> = {};
  for (const e of ledger.data ?? []) balances[e.currency] = (balances[e.currency] ?? 0) + Number(e.amount);
  return { role, mode, review, kyc: kyc.data ?? [], balances, receipts: (receipts.data ?? []).map((r) => ({ ...r, amount: typeof r.summary?.principal === "number" ? r.summary.principal : r.amount })), virtualAccount, accountDetails, cardIssued, sandboxReady: Boolean(process.env["PADDLE_SANDBOX_KEY"]) };
});

const runSchema = z.object({
  id: z.string().max(120),
  params: z.record(z.string(), z.string().max(80)).default({}),
  body: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  currency: z.string().regex(/^[A-Z]{3,4}$/).default("NGN"),
});

export const runPaddleOperation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => runSchema.parse(d))
  .handler(async ({ data }) => {
    const endpoint = ENDPOINTS.find((e) => e.id === data.id);
    if (!endpoint) throw new Error("Unknown service.");
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { db, user, role, mode, review } = await bankingUser();
    if (isUnverifiedInternationalPayout(endpoint.path)) throw new Error(INTERNATIONAL_NOT_ACTIVE);
    if (endpoint.path === "/v1/crypto/swap") {
      throw new Error("Use the wallet conversion screen for protected conversion and recovery.");
    }
    const access = accessFor(endpoint, role, mode);
    if (!access.allowed) throw new Error(access.reason);
    if (JSON.stringify(data.body).length > 20000) throw new Error("Request is too large.");
    if (endpoint.id === "post-accounts-virtual") data.body = { ...data.body, bank: "sterling" };
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before using live services.");
    const isTransfer = endpoint.id === "post-payouts-transfer";
    let transferFee = 0;
    if (isTransfer) {
      data.currency = "NGN";
      data.body = payoutBody.parse(data.body);
      data.body["reference"] = data.idempotencyKey;
      const resolved = await callPaddle(mode, "POST", "/v1/accounts/resolve", { accountNumber: data.body["destinationAccountNumber"], bankCode: data.body["destinationBankCode"] });
      const accountName = (resolved.data as Record<string, unknown> | null)?.["accountName"];
      if (typeof accountName !== "string" || !accountName.trim()) throw new Error("The bank did not confirm the recipient. Check the account details.");
      data.body["destinationAccountName"] = accountName.trim();
      transferFee = slikpayTransferFee(Number(data.body["amount"]));
    }
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
      const prior = await db.from("payment_receipts").select("id").eq("idempotency_key", data.idempotencyKey).maybeSingle();
      if (prior.error) throw new Error("Could not check this payment. Try again.");
      if (prior.data) throw new Error("This payment was already submitted. Check your ledger before sending again.");
      if (isTransfer) {
        const { guardMoney } = await import("./wallets.server");
        await guardMoney({ db, user, mode, review }, "NGN", amount + transferFee, data.pin, operation, data.idempotencyKey);
      } else {
      if (mode === "live") {
        if (!data.pin) throw new Error("Enter your 4-digit transaction PIN.");
        const sec = await db.from("merchant_security").select("pin_digest, pin_salt").eq("user_id", user.id).maybeSingle();
        const { pinDigest } = await import("./merchant-verification.server");
        if (!sec.data || sec.data.pin_digest !== await pinDigest(data.pin, sec.data.pin_salt)) throw new Error("Incorrect transaction PIN.");
      }
      const inserted = await db.from("payment_receipts").insert({ user_id: user.id, mode, operation, idempotency_key: data.idempotencyKey, status: "pending", amount, currency: data.currency });
      if (inserted.error) throw new Error("Could not create this payment, or it was already submitted. Check your ledger.");
      if (mode === "live") {
        const held = await db.rpc("hold_funds", { p_user: user.id, p_mode: mode, p_currency: data.currency, p_amount: amount + transferFee, p_operation: operation, p_reference: data.idempotencyKey });
        if (held.error || held.data !== true) {
          await db.from("payment_receipts").update({ status: "failed" }).eq("user_id", user.id).eq("idempotency_key", data.idempotencyKey);
          throw new Error(held.error ? "Could not reserve funds. Check your ledger before retrying." : "Insufficient balance including fees.");
        }
      }
      }
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
        const { providerFee } = await import("./ledger-history");
        const fee = isTransfer ? transferFee : providerFee(d);
        const status = isTransfer ? payoutStatus(result.data) : "succeeded";
        const body = (data.body ?? {}) as Record<string, unknown>;
        const recipient = [body["destinationAccountName"], body["accountName"], body["beneficiaryName"]].find((v) => typeof v === "string") as string | undefined;
        if (isTransfer) {
          const { settleMoney } = await import("./wallets.server");
          await settleMoney({ db, user, mode, review }, data.idempotencyKey, status, ref ?? null, { principal: amount, fee: transferFee, ...(session ? { nipSessionId: session } : {}), ...(recipient ? { recipient } : {}) });
        } else {
        const saved = await db.from("payment_receipts").update({ status, provider_reference: ref ?? null, session_id: session ?? null, summary: { ...(fee !== undefined ? { fee } : {}), ...(recipient ? { recipient } : {}) } }).eq("user_id", user.id).eq("idempotency_key", data.idempotencyKey);
        if (saved.error) throw new Error("Payment submitted but the receipt could not update. Check your ledger before retrying.");
        if (mode === "live" && status !== "pending") {
          const ledger = await db.from("ledger_entries").update({ status: status === "succeeded" ? "posted" : "released" }).eq("user_id", user.id).eq("reference", data.idempotencyKey);
          if (ledger.error) throw new Error("Payment status needs reconciliation. Do not send again.");
        }
        }
        receipt = { status, reference: ref ?? null, sessionId: session ?? null, amount, currency: data.currency, mode };
      }
      return { mode, message: result.message ?? null, resultJson: JSON.stringify(result.data ?? null).slice(0, 200000), receipt };
    } catch (e) {
      // An exception after dispatch is not proof that the bank rejected the payment.
      // Keep the receipt pending and the debit held until a definitive result is reconciled.
      if (money) throw new Error("Payment status could not be confirmed. Check your ledger before retrying; funds remain reserved while the result is reviewed.");
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
