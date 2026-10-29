import { accountAdmin, digest } from "./merchant-verification.server";
import { validBusinessKey } from "./business-api";
import { callPaddle } from "./paddle.server";
import { redactConsole } from "./developer-console";

export async function businessApi(request: Request, operation: "balances" | "receipts" | "banks") {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": crypto.randomUUID() };
  const reply = (body: object, status = 200) => Response.json(body, { status, headers });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!validBusinessKey(token)) return reply({ error: "invalid_api_key" }, 401);
  if ([...new URL(request.url).searchParams].length) return reply({ error: "unsupported_query_parameters" }, 400);
  try {
    const db = accountAdmin();
    const auth = await db.rpc("authenticate_business_api", { p_hash: await digest(token), p_scope: `${operation}:read` });
    if (auth.error?.message?.includes("API_RATE_LIMIT")) { const r = reply({ error: "rate_limit_exceeded" }, 429); r.headers.set("Retry-After", "60"); return r; }
    if (auth.error) return reply({ error: "service_unavailable" }, 503);
    const identity = Array.isArray(auth.data) ? auth.data[0] : null;
    if (!identity || (identity.environment !== "sandbox" && identity.environment !== "live")) return reply({ error: "invalid_or_inactive_api_key" }, 401);
    const mode = identity.environment;
    if (operation === "balances") {
      // Shared provider balances are not customer scoped. Never expose the platform wallet.
      const ledger = await db.from("ledger_entries").select("amount,currency").eq("user_id", identity.owner_id).eq("mode", mode).in("status", ["held", "posted"]);
      if (ledger.error) return reply({ error: "service_unavailable" }, 503);
      const balances: Record<string, number> = {};
      for (const row of ledger.data ?? []) { const value = Number(row.amount); if (!Number.isFinite(value)) return reply({ error: "service_unavailable" }, 503); balances[row.currency] = (balances[row.currency] ?? 0) + value; }
      return reply({ environment: mode, source: "account_ledger", balances });
    }
    if (operation === "receipts") {
      const rows = await db.from("payment_receipts").select("id,operation,status,amount,currency,provider_reference,created_at").eq("user_id", identity.owner_id).eq("mode", mode).order("created_at", { ascending: false }).limit(50);
      if (rows.error) return reply({ error: "service_unavailable" }, 503);
      return reply({ environment: mode, data: redactConsole(rows.data ?? []) });
    }
    const banks = await callPaddle(mode, "GET", "/v1/accounts/banks");
    const data = Array.isArray(banks.data) ? banks.data.filter((b) => b && typeof b.code === "string" && typeof b.name === "string").map((b) => ({ code: b.code, name: b.name.replace(/paddle(?:bus)?/gi, "Slikpay") })) : [];
    return reply({ environment: mode, data });
  } catch { return reply({ error: "service_unavailable" }, 503); }
}