import { z } from "zod";

export const bettingCustomerBody = z.object({
  operator: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9 _.-]+$/),
  customerId: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.@+-]+$/),
});
export const bettingFundingBody = bettingCustomerBody.extend({
  amount: z.number().finite().positive().refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "Use at most two decimal places."),
});
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (...v: unknown[]) => v.find((s): s is string => typeof s === "string" && Boolean(s.trim()))?.trim() ?? "";

export function bettingCustomer(payload: unknown, expected: { operator: string; customerId: string }) {
  const outer = record(payload);
  const data = "data" in outer ? record(outer["data"]) : outer;
  const customer = record(data["customer"]);
  const status = text(data["status"], outer["status"]).toUpperCase();
  if ([outer, data, customer].some((r) => r["success"] === false || r["valid"] === false || r["isValid"] === false) || ["FAILED", "INVALID", "NOT_FOUND", "DECLINED", "REJECTED", "INACTIVE", "BLOCKED"].includes(status)) return null;
  const customerName = text(data["customerName"], data["customer_name"], data["userName"], data["username"], customer["name"], customer["customerName"]);
  const id = data["customerId"] ?? data["userId"] ?? customer["id"];
  const operator = data["operator"] ?? data["operatorCode"];
  if (!customerName || (id != null && String(id).trim() !== expected.customerId) || (operator != null && String(operator).trim().toLowerCase() !== expected.operator.toLowerCase())) return null;
  return { customerName, customerId: expected.customerId, operator: expected.operator, billerName: text(data["billerName"], data["platformName"]), status: status || "VERIFIED" };
}