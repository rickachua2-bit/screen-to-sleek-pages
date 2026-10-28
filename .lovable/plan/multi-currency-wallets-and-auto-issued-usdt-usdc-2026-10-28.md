# Multi-currency wallets and auto-issued USDT/USDC

## What users get
1. **Crypto wallets issued automatically.** When a merchant finishes verification and receives their naira account number, Slikpay issues a USDT wallet and a USDC wallet straight away. Each one comes with its deposit address and network (for example TRC-20 or ERC-20). Users who are already verified, including your account, get theirs on the next dashboard load.
2. **A wallet for each currency.** Choosing a currency at the top (NGN, GHS, KES, ZAR, USD, EUR, GBP, USDT, USDC) switches the home screen to that wallet. The wallet shows:
   - its balance
   - its account details or deposit address
   - Send, Swap, Fund and Issue account buttons
3. **"Account not active yet."** Before issuing a currency account, Slikpay checks whether the banking partner has switched that currency on for this merchant. If it hasn't, the wallet shows "Account not active yet" and the issue button is turned off. Nothing fake is shown.
4. **Swap** between any two active wallets, including naira to USDT, with a live rate shown before you confirm.
5. **Send and Fund** are tailored to each currency: bank details for fiat money, a copyable address with a QR code for crypto.
6. **Remembered choice.** The currency you pick stays selected after a refresh.

## Rules
- Crypto wallets are issued only after full verification (live mode). Sandbox users see sandbox wallets labelled "Sandbox".
- Issuing an account never happens twice, even if you tap twice or refresh.
- No provider names are shown anywhere (white-label rule).
- Swaps and sends follow the existing safeguards: PIN, approval and a funds hold.

## Technical details
- **Endpoints used:**
  - `POST /v1/crypto/address` for USDT and USDC wallets
  - `GET`/`POST /v1/accounts/global` and `/v1/accounts/domiciliary` for GHS, KES, ZAR, USD, EUR and GBP accounts
  - `POST /v1/crypto/swap` for swaps
  - `GET /v1/wallet/balance` for balances
  - `POST /v1/payouts/global` for sending
- **Probe first.** The catalogue doesn't list request fields for these endpoints, so the first step is a sandbox test of each one to learn its exact request and response shape. Whether a currency is "enabled" comes from the response, either an explicit flag or a "not enabled" error, which maps to "Account not active yet".
- **New `wallets.functions.ts`:**
  - `getWallets` returns each currency's balance, details and status (active, not active or not issued).
  - `issueWallet(currency)` creates the account if needed, saving one ownership row per currency.
  - `ensureStablecoinWallets` runs from `completeGoLive` and from `getBankingProfile` once the account is live and has its naira account.
- **Currency choice:** the currency picker moves out of AppShell local state into a shared store, saved in the browser. The dashboard home shows a `CurrencyWallet` panel when the currency isn't NGN.
- **Tests:** stablecoins are issued only when live and the naira account exists; issuing is idempotent; a not-enabled response maps to "Account not active yet".
