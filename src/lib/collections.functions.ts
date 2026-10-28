import { createServerFn } from "@tanstack/react-start";

/** Captures any incoming transfers the provider has settled but we haven't recorded yet. */
export const syncInbound = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { syncCollections } = await import("./collections.server");
  const { db, user } = await bankingUser();
  return { added: await syncCollections(db, user.id) };
});
