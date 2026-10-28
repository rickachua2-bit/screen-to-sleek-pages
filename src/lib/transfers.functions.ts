import { createServerFn } from "@tanstack/react-start";

/** Every bank on the provider's rails, for any signed-in banking user. */
export const listBanks = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser, callPaddle } = await import("./paddle.server");
  const { mode } = await bankingUser();
  const r = await callPaddle(mode, "GET", "/v1/accounts/banks");
  if (!Array.isArray(r.data)) throw new Error("The bank list is unavailable. Please retry.");
  const list = r.data as Record<string, unknown>[];
  const banks = list
    .filter((b) => b && typeof b["code"] === "string" && /^\d{3,6}$/.test(b["code"]) && typeof b["name"] === "string" && b["name"].trim())
    .map((b) => ({ code: b["code"] as string, name: (b["name"] as string).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!banks.length) throw new Error("No supported banks were returned. Please retry.");
  return banks;
});
