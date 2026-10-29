# International & Swap: what a world-class version looks like

This plan builds only on the provider services Slikpay already has. It does not invent new corridors.

## Provider services we can use
- Global payouts (`POST /v1/payouts/global`) plus status checks (`GET /v1/payouts/{key}`), already live for US, UK, six EUR countries, GH, KE and ZA
- Tuition payouts (`POST /v1/payouts/tuition`)
- FX rates (`/v1/fx/rates`) and crypto rates and swaps (`/v1/crypto/swap`, USDT/USDC to NGN confirmed)
- Global receiving accounts and domiciliary accounts (`/v1/accounts/global`, `/v1/accounts/domiciliary`)
- Crypto deposit addresses (`/v1/crypto/address`) and wallet balances (`/v1/wallet/balance`)

## The page: one flow with five tabs
```text
[ Receive ] [ Hold ] [ Swap ] [ Send ] [ Track ]
```
The Destination Explorer design stays as it is: the navy corridor rail on one side and the white workspace on the other.

1. **Receive:** foreign accounts (USD/GBP/EUR) from global or domiciliary accounts, plus USDT/USDC addresses. Each shows its details, a copy button and a share button. Merchants whose account cannot be issued see "Account not active yet".
2. **Hold:** a balance strip for every currency, taken from provider balances, with the ledger filling any currency the provider leaves out.
3. **Swap:** a converter with a live rate, the fee and a countdown on the quote. It runs only on confirmed pairs (USDT/USDC to NGN today). Other pairs show the live rate as a preview and say "Conversion not yet available".
4. **Send (remittance and business payouts):**
   - A market directory: each country shows its currency, payment method, required bank fields and status ("Available", or "Coming soon" when unconfirmed). No more blanket "Live" labels.
   - Required fields per country: IBAN/BIC for EUR, sort code for GB, routing/ABA for US, and mobile money or bank for GH/KE.
   - A quote card: you pay, fee (0.5% rule), rate, recipient gets, and the arrival estimate when the provider supplies one. You confirm the exact quote, and a new rate means a new confirmation.
   - Saved beneficiaries with "Send again", plus a purpose-of-payment field.
   - Tuition payouts as their own option (school, student ID, invoice).
   - Email-code or PIN approval, with live mode needing approval.
5. **Track:** a timeline (Created, Debited, Sent, Paid / Declined / Returned). It refreshes automatically by checking the original payment reference. Unknown states stay "Pending" with the funds held. Receipts can be downloaded or shared.

## Trust fixes first
- One stable payment reference per attempt, and retries reuse it so a double click cannot create a duplicate payment.
- A quote can only be used for the exact amount and rate that were confirmed.
- No fake yields or browser-only treasury figures on this page.

## Technical details
- Extend `international.ts` with a corridor registry (fields, method, status) and a quote type with an expiry. Add `quote`, `beneficiaries` (owner-scoped `paddle_resources`) and `track` server functions in `international.functions.ts`.
- Add a tuition branch to `global-payout.server.ts` that uses the same reservation and recovery path.
- Split `InternationalServices.tsx` into tab components. Polling uses the existing live-updates helper.
- Add tests for corridor field validation, rejecting expired quotes, reusing references and pending-on-unknown.

## Open questions (need provider confirmation)
- Do quote locks or expiry exist? If not, quotes show as estimates and get re-checked at send time.
- Do fiat-to-fiat swaps and the response formats for receiving accounts exist? Until confirmed, they stay in preview only.
