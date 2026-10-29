export interface CryptoOfframpPreview {
  coin: "USDT" | "USDC";
  amount: number;
  wholesaleRate: number;
  effectiveRate: number;
  grossNgn: number;
  conversionFee: number;
  netNgn: number;
  updatedAt: string | null;
}
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positive = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const kobo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** The provider's sell rate already includes its spread. Never subtract it twice. */
export function cryptoOfframpPreview(payload: unknown, coin: "USDT" | "USDC", amount: number): CryptoOfframpPreview {
  const envelope = record(payload);
  if (!envelope || envelope["success"] === false) throw new Error("Crypto rates are unavailable.");
  const data = record(envelope["data"]) ?? envelope;
  const key = `${coin}_NGN`;
  const effectiveRate = positive(record(data["rates"])?.[key]);
  const wholesaleRate = positive(record(data["wholesaleRates"])?.[key]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !effectiveRate || !wholesaleRate || effectiveRate > wholesaleRate) {
    throw new Error("The service did not confirm valid rates and conversion fees for this amount.");
  }
  const grossNgn = kobo(amount * wholesaleRate);
  const netNgn = Math.floor(amount * effectiveRate * 100) / 100;
  if (!Number.isFinite(grossNgn) || !Number.isFinite(netNgn) || netNgn <= 0) throw new Error("Conversion amount is invalid.");
  return { coin, amount, wholesaleRate, effectiveRate, grossNgn, conversionFee: kobo(grossNgn - netNgn), netNgn, updatedAt: typeof data["lastUpdated"] === "string" ? data["lastUpdated"] : null };
}