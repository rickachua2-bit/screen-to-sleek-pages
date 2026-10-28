// Client-safe wallet rules shared by the server functions and the UI.
export type WalletKind = "fiat" | "crypto";
export interface CurrencyDef { code: string; name: string; symbol: string; flag: string; kind: WalletKind; network?: string; country?: string }

export const CURRENCIES: CurrencyDef[] = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", kind: "fiat", country: "NG" },
  { code: "GHS", name: "Ghana Cedi", symbol: "GH₵", flag: "🇬🇭", kind: "fiat", country: "GH" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", kind: "fiat", country: "KE" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦", kind: "fiat", country: "ZA" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", kind: "fiat", country: "US" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", kind: "fiat", country: "DE" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", kind: "fiat", country: "GB" },
  { code: "USDT", name: "Tether", symbol: "₮", flag: "🪙", kind: "crypto", network: "TRC20" },
  { code: "USDC", name: "USD Coin", symbol: "$", flag: "🪙", kind: "crypto", network: "ERC20" },
];
export const STABLECOINS = ["USDT", "USDC"] as const;
export const currencyDef = (code: string) => CURRENCIES.find((c) => c.code === code);

/** Ownership-row operation tag. One row per user, mode and currency. */
export const walletOperation = (code: string) => (currencyDef(code)?.kind === "crypto" ? `POST /v1/crypto/address ${code}` : `POST /v1/accounts/global ${code}`);
export function walletCurrencyOf(operation: string) { const m = /^POST \/v1\/(?:crypto\/address|accounts\/global) ([A-Z]{3,4})$/.exec(operation); return m ? m[1]! : null; }

/** Stablecoin wallets are auto-issued only for fully verified (live) accounts that already hold their naira account. */
export function shouldAutoIssueStablecoins(mode: string, hasNairaAccount: boolean, owned: string[]) {
  if (mode !== "live" || !hasNairaAccount) return [] as string[];
  return STABLECOINS.filter((c) => !owned.includes(c));
}

export type WalletStatus = "active" | "not_active" | "not_issued";
export const NOT_ACTIVE = "Account not active yet";
/** Provider refusals (not enabled / unsupported / forbidden) mean the currency isn't switched on for this merchant. */
export function isNotEnabled(message: string) { return /not (enabled|active|supported|available)|unsupported|forbidden|permission|403|disabled/i.test(message); }
