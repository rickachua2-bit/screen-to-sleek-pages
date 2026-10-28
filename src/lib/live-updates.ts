import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSupabase } from "./supabase";

/** Streams new transactions/ledger rows for the signed-in user; falls back to a 60s poll. */
export function useLiveUpdates(userId: string | undefined, reload: () => Promise<void>) {
  const ref = useRef(reload); ref.current = reload;
  useEffect(() => {
    if (!userId) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = (msg?: string) => { if (t) clearTimeout(t); t = setTimeout(() => { void ref.current(); if (msg) toast.success(msg); }, 400); };
    const sb = getSupabase();
    const ch = sb.channel(`live-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, (p) => { const r = p.new as { direction?: string; amount?: number }; bump(r.direction === "credit" ? `Money received · ₦${Number(r.amount ?? 0).toLocaleString()}` : undefined); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_entries", filter: `user_id=eq.${userId}` }, () => bump())
      .subscribe();
    const poll = setInterval(() => { if (document.visibilityState === "visible") void ref.current(); }, 60000);
    return () => { if (t) clearTimeout(t); clearInterval(poll); void sb.removeChannel(ch); };
  }, [userId]);
}
