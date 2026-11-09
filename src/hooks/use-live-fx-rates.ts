import { useQuery } from "@tanstack/react-query";
import { getLiveFxPricing, getLiveFxRates } from "@/lib/fx.functions";

/**
 * Live FX rates from the Slikcash business API, refreshed every 30 seconds.
 * While loading — or if the service is unreachable — `rates` stays null and
 * callers show a loading/unavailable state. No fallback rates are invented.
 */
export function useLiveFxRates() {
  const query = useQuery({
    queryKey: ["live-fx-rates"],
    queryFn: () => getLiveFxRates(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
  return {
    rates: query.data?.rates ?? null,
    fetchedAt: query.data?.fetchedAt ?? null,
    loading: query.isPending,
    unavailable: query.isError,
    refresh: query.refetch,
  };
}

/** Live platform fee structure from the Slikcash business API. */
export function useLiveFxPricing() {
  const query = useQuery({
    queryKey: ["live-fx-pricing"],
    queryFn: () => getLiveFxPricing(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  return {
    pricing: query.data?.pricing ?? null,
    fetchedAt: query.data?.fetchedAt ?? null,
    loading: query.isPending,
    unavailable: query.isError,
  };
}
