# Slikpay x Paddle: full banking build with sandbox and live modes

## What Paddle offers (from its docs)
- **Accounts:** bank list, account name lookup, virtual accounts (create/list), global (USD/GBP/EUR) accounts
- **Money out:** single payouts, bulk payouts, tuition payouts
- **Balance and ledger:** wallet balance, statements
- **Cards:** virtual cards, physical card order and activation
- **Bills:** airtime, electricity (validate and recharge), cable TV, betting top-up, gift cards
- **Identity:** BVN, CAC, phone OTP
- **Investments:** assets, markets, quotes, yields, accounts, orders, portfolio
- **Crypto:** deposit addresses, swaps
- **Escrow:** create escrow
- **Pricing:** plans, fee calculator
- **Sandbox only:** simulate an incoming payment
- **Accepting payments:** checkout sessions, card, bank-debit and pan-African charges, global card checkout, payment verification, refunds, disputes, and hosted PayLinks
- **Flights:** airport search, flight search, and ticket issuing (paid from the spend wallet)
- **Also:** NIN check, Remita bills, saved counterparties, open banking, treasury pools and sweeps, team invites, scoped API keys, and Slack/Discord alerts

**Not in Paddle's docs:** event tickets, storefronts and invoices. Slikpay will build storefronts, invoices and payment links itself, and customers will pay through Paddle's checkout. Event ticketing waits until Paddle shares its documentation.

## Beyond Paddle (Slikpay-built)
- **Storefronts:** a public shop page for each merchant with products, cart and Paddle checkout
- **Invoices:** branded invoices with line items, tax and due dates, sent by email, with a pay button, auto-reconciled when paid
- **Payment links:** fixed or open amounts, with a QR code and an expiry
- **Developer tools:** API keys and webhooks for each merchant, in sandbox and live

Paddle uses one web address for both modes. A `sk_test_` key runs in sandbox, and a `sk_live_` key moves real money.

## Who gets what
| Feature | Business | Personal |
|---|---|---|
| Virtual accounts (collections) | Yes | Own account number |
| Payouts, bulk payouts | Yes | Single transfers |
| Balance, statements, ledger | Yes | Yes |
| Cards (virtual and physical) | Corporate cards | Personal USD card |
| Bills and airtime | Optional | Yes |
| Global accounts, crypto, investments | Yes | Yes (after KYC) |
| Escrow, tuition payouts, pricing | Yes | Tuition only |
| Storefronts, invoices, payment links | Yes | Payment links |
| Flights | Yes | Yes |
| Simulate incoming payment | Sandbox only | Sandbox only |

## Sandbox to live journey
```text
Sign up -> Sandbox (test money, business name shown, no real data)
        -> Verification checklist (Business: director check first, then more steps you'll share.
                                    Personal: BVN-based KYC)
        -> Our review approves -> Live (real transactions)
```
- Every new account starts in **sandbox**. A clear "Sandbox" badge appears across the dashboard.
- Sandbox calls always use the test key. Live calls use the live key, and only for approved accounts.
- Moving to live is a server decision. Nobody can switch themselves to live from their browser.

## Build phases
1. **Foundation:** sandbox/live mode per account, a verification checklist, an internal ledger so each user only sees and spends their own money, and saved receipts with Paddle reference IDs
2. **Collections:** virtual accounts, plus incoming-payment notifications from Paddle so balances update
3. **Payouts:** name lookup, single and bulk transfers with PIN check, fees from Paddle pricing, and receipts
4. **Cards and bills:** issuing, freezing and ordering cards; airtime, power, cable, betting and gift cards
5. **Accepting payments:** checkout, payment links, invoices, storefronts, refunds and disputes
6. **Flights**, global accounts, investments, crypto, escrow and treasury
7. **KYC/KYB to go live:** director check (BVN) first; the remaining steps once you send them

Each phase is tested in sandbox before it goes live.

**Coverage rule:** every endpoint in Paddle's docs gets a working, brand-styled screen (Cobalt, Cyan and Magenta on the midnight flame theme). Each screen handles loading, empty, error and success states, and every money action shows a receipt. A screen appears as live only after Paddle confirms it works. Anything Paddle hasn't enabled for your key shows "Not enabled by Paddle" and never fakes success.

## Needed from you
- A Paddle **sandbox key** (`sk_test_...`). The saved key will be treated as the live key.
- Confirmation of Paddle's **webhook** (incoming payment notification) setup and signing secret
- The remaining go-live steps after the director check
- Confirmation that one Paddle account holds all users' funds, with Slikpay's own ledger tracking who owns what. Paddle has no per-merchant sub-accounts in its docs.

## Technical details
- Server: Paddle calls are made only from the server through one helper. It picks the test or live key from the account's mode (read from the database, never from the browser), sends `Authorization: Bearer`, and has a fixed list of allowed endpoints.
- New tables in the external database (setup script to run by hand):
  - `account_modes`: user, mode, and verification state
  - `kyc_steps`: the verification steps
  - `ledger_entries`: double-entry records for each user
  - `paddle_resources`: virtual accounts, cards and orders mapped to their owner
  - `payment_receipts`: Paddle reference IDs, kept unique so the same transfer can't run twice
  - `webhook_events`
  - All tables are locked to the server; the browser can only read its own rows.
- A webhook endpoint at `/api/public/paddle-webhook` checks Paddle's signature, ignores repeat events and posts to the ledger.
- Before any payout: the PIN is checked, the user's ledger balance must cover it, a duplicate-prevention key is sent, and money is held before the Paddle call, then settled or released afterwards.
- The existing locked areas (payouts, platform balance) are switched to the new ledger-backed versions. Unconnected screens keep their draft labels.
- Tests are added for mode selection, the live-mode gate, the balance check, and webhook signature and duplicate handling.
