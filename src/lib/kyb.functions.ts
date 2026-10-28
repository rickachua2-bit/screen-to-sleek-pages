import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MERCHANT_STEPS, namesMatch } from "./go-live";

// KYB checks always use the live key: they verify real identities even while the account is in sandbox.
const KYB_MODE = "live" as const;

export type KybPerson = { name: string; bvn: string; ownership?: number | undefined; verified: boolean };
type Val = string | number | boolean | null | undefined | string[] | KybPerson[];
type Detail = { [k: string]: Val; text?: string; people?: KybPerson[] };
type Row = { step: string; status: string; summary: string | null };

const parse = (s: string | null): Detail => { try { const v = JSON.parse(s ?? ""); return v && typeof v === "object" ? v : { text: s ?? "" }; } catch { return { text: s ?? "" }; } };
const mask = (bvn: string) => `•••••••${bvn.slice(-4)}`;

async function merchant() {
  const { bankingUser } = await import("./paddle.server");
  const ctx = await bankingUser();
  if (ctx.role !== "merchant") throw new Error("KYB is for business accounts.");
  return ctx;
}
type Ctx = Awaited<ReturnType<typeof merchant>>;

async function save(ctx: Ctx, step: string, verified: boolean, detail: Detail) {
  const r = await ctx.db.from("kyc_steps").upsert({ user_id: ctx.user.id, step, status: verified ? "verified" : "failed", summary: JSON.stringify(detail) }, { onConflict: "user_id,step" });
  if (r.error) throw new Error("Could not save this step. Try again.");
  if (verified && ctx.review === "not_started") await ctx.db.from("account_modes").update({ review_status: "in_progress" }).eq("user_id", ctx.user.id);
}

async function business(ctx: Ctx) {
  const sec = await ctx.db.from("merchant_security").select("company_name, rc_number, country").eq("user_id", ctx.user.id).maybeSingle();
  const m = ctx.user.user_metadata ?? {};
  return { name: String(sec.data?.company_name ?? m["company_name"] ?? ""), rcNumber: String(sec.data?.rc_number ?? m["cac_rc_number"] ?? ""), country: String(sec.data?.country ?? m["country"] ?? "NG") };
}

async function hasTotp(ctx: Ctx) {
  const f = await ctx.db.auth.admin.mfa.listFactors({ userId: ctx.user.id });
  return (f.data?.factors ?? []).some((x) => x.factor_type === "totp" && x.status === "verified");
}

async function rows(ctx: Ctx): Promise<Row[]> {
  const r = await ctx.db.from("kyc_steps").select("step, status, summary").eq("user_id", ctx.user.id);
  return r.data ?? [];
}

export const getKybProfile = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await merchant();
  const biz = await business(ctx);
  let list = await rows(ctx);
  const has = (k: string) => list.some((r) => r.step === k && r.status === "verified");
  if (biz.name && !has("business_identity")) { await save(ctx, "business_identity", true, { name: biz.name, rcNumber: biz.rcNumber, country: biz.country }); list = await rows(ctx); }
  if (!has("two_factor") && (await hasTotp(ctx))) { await save(ctx, "two_factor", true, { method: "Authenticator app" }); list = await rows(ctx); }
  const live = await ctx.db.from("paddle_resources").select("resource_id").eq("user_id", ctx.user.id).eq("mode", "live").eq("operation", "POST /v1/accounts/virtual").limit(1).maybeSingle();
  return {
    mode: ctx.mode, review: ctx.review, business: biz, email: ctx.user.email ?? "",
    steps: list.map((r) => ({ step: r.step, status: r.status, detail: parse(r.summary) })),
    liveAccount: live.data?.resource_id ?? null,
  };
});

const person = z.object({ kind: z.enum(["director", "owner"]), firstName: z.string().trim().min(2).max(60), lastName: z.string().trim().min(2).max(60), bvn: z.string().regex(/^\d{11}$/), ownership: z.number().min(25).max(100).optional() });

export const verifyKybPerson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => person.parse(d))
  .handler(async ({ data }) => {
    const ctx = await merchant();
    if (data.kind === "owner" && data.ownership == null) throw new Error("Enter the ownership percentage (25% or more).");
    const { callPaddle } = await import("./paddle.server");
    const r = await callPaddle(KYB_MODE, "POST", "/v1/identity/bvn", { bvn: data.bvn, firstName: data.firstName, lastName: data.lastName });
    const d = (r.data ?? {}) as Record<string, unknown>;
    const verified = d["verified"] === true && (typeof d["matchScore"] !== "number" || d["matchScore"] >= 80);
    const step = data.kind === "director" ? "director_bvn" : "beneficial_owners";
    const existing = (await rows(ctx)).find((x) => x.step === step);
    const people = (parse(existing?.summary ?? null).people ?? []).filter((p) => p.bvn !== mask(data.bvn));
    people.push({ name: `${data.firstName} ${data.lastName}`, bvn: mask(data.bvn), ownership: data.ownership, verified });
    await save(ctx, step, people.some((p) => p.verified), { people });
    return { verified, message: verified ? "BVN verified." : "The BVN details didn't match that name." };
  });

export const reuseDirectorAsOwner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ bvn: z.string().max(20), ownership: z.number().min(25).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await merchant();
    const list = await rows(ctx);
    const dir = (parse(list.find((x) => x.step === "director_bvn")?.summary ?? null).people ?? []).find((p) => p.bvn === data.bvn && p.verified);
    if (!dir) throw new Error("Choose a verified director.");
    const people = (parse(list.find((x) => x.step === "beneficial_owners")?.summary ?? null).people ?? []).filter((p) => p.bvn !== dir.bvn);
    people.push({ ...dir, ownership: data.ownership });
    await save(ctx, "beneficial_owners", true, { people });
    return { verified: true };
  });

const url = z.string().trim().max(200).url().refine((u) => /^https?:\/\//.test(u), "Use a web link starting with https://");
export const saveKybOperations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ street: z.string().trim().min(5).max(160), city: z.string().trim().min(2).max(60), state: z.string().trim().min(2).max(60), website: url.optional().or(z.literal("")), socials: z.array(url).max(4) }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await merchant();
    if (!data.website && data.socials.length === 0) throw new Error("Add your website or at least one social page.");
    await save(ctx, "operations", true, data);
    return { ok: true };
  });

export const listSettlementBanks = createServerFn({ method: "POST" }).handler(async () => {
  await merchant();
  const { callPaddle } = await import("./paddle.server");
  const r = await callPaddle(KYB_MODE, "GET", "/v1/accounts/banks");
  const list = Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [];
  return list
    .filter((b) => typeof b["code"] === "string" && typeof b["name"] === "string")
    .map((b) => ({ code: b["code"] as string, name: (b["name"] as string).trim(), category: typeof b["category"] === "string" ? (b["category"] as string) : "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const verifySettlementAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ bankCode: z.string().regex(/^\d{3,6}$/), bankName: z.string().max(80), accountNumber: z.string().regex(/^\d{10}$/) }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await merchant();
    const biz = await business(ctx);
    if (!biz.name) throw new Error("Your verified business name is missing.");
    const { callPaddle } = await import("./paddle.server");
    const r = await callPaddle(KYB_MODE, "POST", "/v1/accounts/resolve", { accountNumber: data.accountNumber, bankCode: data.bankCode });
    const accountName = String(((r.data ?? {}) as Record<string, unknown>)["accountName"] ?? "").trim();
    if (!accountName) throw new Error("We couldn't find that account. Check the number and bank.");
    const matches = namesMatch(accountName, biz.name);
    if (matches) await save(ctx, "settlement_account", true, { bankName: data.bankName, bankCode: data.bankCode, accountNumber: data.accountNumber, accountName });
    return { accountName, matches, businessName: biz.name };
  });

export const confirmTwoFactor = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await merchant();
  if (!(await hasTotp(ctx))) throw new Error("Finish connecting your authenticator app first.");
  await save(ctx, "two_factor", true, { method: "Authenticator app" });
  return { ok: true };
});

export const completeGoLive = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await merchant();
  if (!(await hasTotp(ctx))) throw new Error("Connect two-factor authentication first.");
  const list = await rows(ctx);
  const missing = MERCHANT_STEPS.filter((s) => s.key !== "contacts" && !list.some((r) => r.step === s.key && r.status === "verified"));
  if (missing.length) throw new Error(`Finish: ${missing.map((m) => m.title).join(", ")}.`);
  const biz = await business(ctx);
  const up = await ctx.db.from("account_modes").update({ mode: "live", review_status: "approved", approved_at: new Date().toISOString() }).eq("user_id", ctx.user.id);
  if (up.error) throw new Error("Could not switch your account to live. Try again.");
  const existing = await ctx.db.from("paddle_resources").select("resource_id").eq("user_id", ctx.user.id).eq("mode", "live").eq("operation", "POST /v1/accounts/virtual").limit(1).maybeSingle();
  const stable = async () => { const { ensureStablecoinWallets } = await import("./wallets.server"); await ensureStablecoinWallets(ctx.db, ctx.user, "live", true); };
  if (existing.data) { await stable(); return { live: true, accountNumber: existing.data.resource_id, accountName: biz.name, issueError: null }; }
  try {
    const { callPaddle } = await import("./paddle.server");
    const r = await callPaddle("live", "POST", "/v1/accounts/virtual", { accountName: biz.name, customerEmail: ctx.user.email, accountType: "corporate", useMerchantBvn: true, currency: "NGN", bank: "sterling" }, crypto.randomUUID());
    const d = (r.data ?? {}) as Record<string, unknown>;
    const accountNumber = String(d["accountNumber"] ?? d["account_number"] ?? "");
    if (!/^\d{10}$/.test(accountNumber)) throw new Error("No account number was returned.");
    await ctx.db.from("paddle_resources").upsert({ user_id: ctx.user.id, mode: "live", resource_id: accountNumber, operation: "POST /v1/accounts/virtual" }, { onConflict: "mode,resource_id" });
    await stable();
    return { live: true, accountNumber, accountName: String(d["accountName"] ?? biz.name), issueError: null };
  } catch (e) {
    return { live: true, accountNumber: null, accountName: biz.name, issueError: e instanceof Error ? e.message : "Account number could not be issued yet." };
  }
});
