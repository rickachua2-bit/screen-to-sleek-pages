import { useEffect, useSyncExternalStore } from "react";
import { getLivePricing } from "./pricing.functions";
import type { FxRates, Rail } from "./pricing";

export interface LivePricing { rates: FxRates | null; rails: Record<string, Rail>; plan: string; error: boolean }
let snap: LivePricing | null = null; let inflight: Promise<void> | null = null; let last = 0;
const subs = new Set<() => void>();

export function refreshLivePricing() {
  if (inflight) return inflight;
  inflight = getLivePricing().then((r) => { snap = { ...r, error: false }; }).catch(() => { snap = { rates: snap?.rates ?? null, rails: snap?.rails ?? {}, plan: snap?.plan ?? "starter", error: true }; })
    .finally(() => { inflight = null; last = Date.now(); subs.forEach((f) => f()); });
  return inflight;
}

/** Shared live FX + fee rails, refreshed every 60s while mounted. */
export function useLivePricing() {
  const v = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap, () => null);
  useEffect(() => {
    if (!snap || Date.now() - last > 60000) void refreshLivePricing();
    const t = setInterval(() => { if (document.visibilityState === "visible") void refreshLivePricing(); }, 60000);
    return () => clearInterval(t);
  }, []);
  return v;
}
