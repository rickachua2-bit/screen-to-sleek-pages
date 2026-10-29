import { createServerFn } from "@tanstack/react-start";

/** Documentation discovery only: endpoint existence is not account eligibility or payment authorization. */
export const getInternationalAvailability = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { role, mode } = await bankingUser();
  if (role !== "merchant") throw new Error("International services are currently offered on business accounts only.");
  const response = await fetch("https://api.getpaddle.online/v1/openapi.json", {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("International service availability could not be checked. Please retry.");
  const spec = await response.json() as { paths?: Record<string, { post?: unknown }> };
  return {
    mode, active: false as const,
    crossBorderListed: Boolean(spec.paths?.["/v1/payouts/global"]?.post),
    tuitionListed: Boolean(spec.paths?.["/v1/payouts/tuition"]?.post),
    // No documented corridor/quote/reconciliation contract: fail closed in both modes.
    checkedAt: new Date().toISOString(),
  };
});