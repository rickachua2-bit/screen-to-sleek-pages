import { createServerFn } from "@tanstack/react-start";

/** Full money history for the signed-in user in their current mode: credits + outgoing receipts, every currency. */
export const getLedgerHistory = createServerFn({ method: "POST" }).handler(async () => {
  const { bankingUser } = await import("./paddle.server");
  const { mergeHistory } = await import("./ledger-history");
  const { db, user, mode } = await bankingUser();
  const [tx, rc] = await Promise.all([
    db.from("transactions").select("id, created_at, reference, channel, customer, amount, direction, status, metadata").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    db.from("payment_receipts").select("id, created_at, operation, status, amount, currency, provider_reference, session_id, summary").eq("user_id", user.id).eq("mode", mode).order("created_at", { ascending: false }).limit(500),
  ]);
  if (tx.error && rc.error) throw new Error("Could not load your history. Try again.");
  // Credits carry their mode in metadata; older rows without it are shown in both modes.
  const txs = (tx.data ?? []).filter((r) => { const m = (r.metadata ?? {}) as Record<string, unknown>; return !m["mode"] || m["mode"] === mode; });
  return { mode, rows: mergeHistory(txs as never, (rc.data ?? []) as never) };
});
