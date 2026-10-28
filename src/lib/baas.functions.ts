import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

// Deliberately no arbitrary path forwarding and no platform-wide float exposure.
export const baasService = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("resolve-account"), accountNumber: z.string().regex(/^\d{10}$/), bankCode: z.string().regex(/^\d{3,6}$/) }),
    z.object({ operation: z.literal("balance") }),
    z.object({ operation: z.literal("nip") }),
  ]).parse(input))
  .handler(async ({ data }) => {
    const authorization = getRequestHeader("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Sign in before using banking services.");
    const { accountAdmin } = await import("./merchant-verification.server");
    const db = accountAdmin();
    const user = await db.auth.getUser(authorization.slice(7));
    if (user.error || !user.data.user) throw new Error("Your session has expired. Sign in again.");
    if (data.operation === "balance") throw new Error("Live balance access is awaiting merchant-specific account mapping; platform settlement float is not your wallet balance.");
    if (data.operation === "nip") throw new Error("Live transfers are locked until merchant-owned funding accounts and independent withdrawal PIN validation are configured.");
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const { mode } = await bankingUser();
    const resolved = await callPaddle(mode, "POST", "/v1/accounts/resolve", { accountNumber: data.accountNumber, bankCode: data.bankCode });
    const response = (resolved.data ?? {}) as Record<string, unknown>;
    if (typeof response['accountName'] !== "string" || !response['accountName'].trim()) throw new Error("The bank did not confirm an account name.");
    return { accountName: response['accountName'] };
  });