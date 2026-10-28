import { createServerFn } from "@tanstack/react-start";

/** Every bank on the provider's rails, for any signed-in banking user. */
export const listBanks = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser, callPaddle } = await import("./paddle.server");
  const { mode } = await bankingUser();
  const r = await callPaddle(mode, "GET", "/v1/accounts/banks");
  const list = Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [];
  return list
    .filter((b) => typeof b["code"] === "string" && typeof b["name"] === "string")
    .map((b) => ({ code: b["code"] as string, name: (b["name"] as string).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
});
