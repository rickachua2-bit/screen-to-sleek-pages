import { z } from "zod";
import type { PaddleEndpoint } from "./paddle-policy";

export const CABLE_PROVIDERS = [
  { value: "dstv", label: "DStv", monogram: "D", tint: "tint-cobalt" },
  { value: "gotv", label: "GOtv", monogram: "GO", tint: "tint-cyan" },
  { value: "startimes", label: "StarTimes", monogram: "ST", tint: "tint-magenta" },
  { value: "showmax", label: "Showmax", monogram: "S", tint: "tint-magenta" },
] as const;

export const cableValidationBody = z.object({
  provider: z.enum(["DSTV", "GOTV", "STARTIMES", "SHOWMAX"]),
  smartcardNumber: z.string().regex(/^\d{10,11}$/),
});

export const CABLE_VALIDATE: PaddleEndpoint = {
  id: "post-bills-cable-validate", method: "POST", path: "/v1/bills/cable/validate",
  tag: "Bills, Utilities & Telecom", summary: "Verify cable TV smartcard or IUC",
  fields: [{ name: "provider", type: "string", required: true, enum: ["DSTV", "GOTV", "STARTIMES", "SHOWMAX"] }, { name: "smartcardNumber", type: "string", required: true }], params: [],
};

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (...values: unknown[]) => values.find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim() ?? "";
export interface CableCustomer { customerName: string; currentPlan: string; dueDate: string }

export function cableCustomer(payload: unknown): CableCustomer | null {
  const outer = record(payload);
  const data = "data" in outer ? record(outer["data"]) : outer;
  const customer = record(data["customer"]);
  const status = text(data["status"]).toUpperCase();
  if (outer["success"] === false || outer["valid"] === false || data["success"] === false || data["valid"] === false || ["INVALID", "FAILED", "NOT_FOUND"].includes(status)) return null;
  const customerName = text(data["customerName"], data["customerLegalName"], data["customer_name"], data["Customer_Name"], data["name"], customer["legalName"], customer["name"]);
  if (!customerName) return null;
  return {
    customerName,
    currentPlan: text(data["currentBouquet"], data["currentPlan"], data["bouquet"], data["plan"], customer["currentPlan"]),
    dueDate: text(data["expiryDate"], data["dueDate"], data["expiry_date"], data["due_date"], customer["expiryDate"]),
  };
}