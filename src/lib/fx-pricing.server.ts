/**
 * Live platform pricing from the Slikcash business API — server-side only.
 * The NIP transfer fee is always read from the live pricing service at quote
 * and execution time. If the service is unreachable the operation is blocked;
 * a stale or invented fee is never charged.
 */

const FX_PRICING_URL = "https://business.slikcash.com/api/fx/pricing";

/** Extracts the flat NIP transfer fee (NGN) from a pricing payload. Never guesses. */
export function extractNipFlatFee(payload: unknown): number {
  const root = payload as Record<string, unknown> | null;
  const feeStructure = root?.["feeStructure"] as Record<string, unknown> | undefined;
  const transfers = feeStructure?.["transfers"] as Record<string, unknown> | undefined;
  const nip = transfers?.["nipDomestic"] as Record<string, unknown> | undefined;
  const fee = Number(nip?.["flatFeeNgn"]);
  if (!Number.isFinite(fee) || fee <= 0) throw new Error("Transfer fees are unavailable. Try again before sending.");
  return Math.round(fee * 100) / 100;
}

/** Fetches the current flat NIP transfer fee. Throws rather than falling back to a stale value. */
export async function fetchLiveNipTransferFee(): Promise<number> {
  try {
    const res = await fetch(FX_PRICING_URL, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`pricing service ${res.status}`);
    return extractNipFlatFee(await res.json());
  } catch (error) {
    console.error("Live NIP transfer fee fetch failed:", error);
    throw new Error("Transfer fees are unavailable right now. Try again before sending.");
  }
}
