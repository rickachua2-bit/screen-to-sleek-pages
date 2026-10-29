import { z } from "zod";
export const governmentService = z.enum(["firs", "remita"]);
export type GovernmentService = z.infer<typeof governmentService>;
export const governmentLookup = z.object({ service: governmentService, identifier: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9/-]+$/) }).superRefine((v, ctx) => {
  if (v.service === "remita" && !/^\d{12}$/.test(v.identifier)) ctx.addIssue({ code: "custom", message: "Enter the 12-digit RRR.", path: ["identifier"] });
});
export const governmentPayment = z.object({ identifier: z.string(), expectedAmount: z.number().finite().positive(), expectedFee: z.number().finite().nonnegative() });
export const governmentBody = (service: GovernmentService, identifier: string) => service === "firs" ? { tin: identifier } : { rrr: identifier };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (...v: unknown[]) => v.find((s): s is string => typeof s === "string" && Boolean(s.trim()))?.trim() ?? "";
const money = (v: unknown) => (typeof v === "number" || typeof v === "string" && v.trim() !== "") && Number.isFinite(Number(v)) && Number(v) >= 0 && Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) < 0.0001 ? Number(v) : null;
export function governmentAssessment(service: GovernmentService, identifier: string, payload: unknown) {
  const outer = object(payload); const d = "data" in outer ? object(outer["data"]) : outer;
  if ([outer, d].some((r) => r["success"] === false || r["valid"] === false || r["isValid"] === false) || ["INVALID", "FAILED", "NOT_FOUND", "PAID", "COMPLETED"].includes(text(d["status"]).toUpperCase())) return null;
  const name = service === "firs" ? text(d["taxpayerName"], d["customerName"]) : text(d["beneficiaryName"], d["customerName"]);
  const echoed = d[service === "firs" ? "tin" : "rrr"];
  if (!name || echoed != null && String(echoed).trim() !== identifier) return null;
  const amount = money(d["amount"]); const fee = money(d["fee"] ?? d["platformFee"] ?? d["transactionFee"]);
  const currency = text(d["currency"], d["feeCurrency"]);
  const ready = amount !== null && amount > 0 && fee !== null && (!currency || currency === "NGN");
  return { identifier, name, organisation: text(d["mdaName"], d["taxType"]), amount, fee, total: ready ? Math.round((amount + fee) * 100) / 100 : null, ready, dueDate: text(d["dueDate"]), assessmentReference: text(d["assessmentReference"], d["reference"]) };
}
export type GovernmentAssessment = NonNullable<ReturnType<typeof governmentAssessment>>;