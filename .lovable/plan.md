# Where the dashboard falls short of global leaders, and the fix plan

Benchmarks: Wise Business, Revolut Business, Stripe Dashboard, Mercury, Payoneer.

## What we got wrong or left unfinished

1. **Placeholder content still shows.** The sidebar shows "Acme Logistics Ltd" in place of the real business name. The notifications panel is static. The personal wallet shows a "Tier 2 · ₦5,000,000/day" badge whether or not it's true. Leaders never show placeholder content.
2. **No live exchange rates.** Rates appear only after a swap. Wise and Revolut show a locked quote before you confirm, with a countdown and a fee breakdown.
3. **Fees and limits are made up.** The per-currency limits and speeds were written by me, not taken from your pricing.
4. **Crypto is receive-only.** You can't send USDT or USDC to an outside address and there are no network choices. Payoneer and Revolut allow withdrawals, with address checks and saved addresses.
5. **Precision bug.** Coin amounts are stored to 2 decimal places, so small balances round down.
6. **No multi-currency overview.** There's no "total balance in your chosen currency" across all wallets, and no net-worth chart. Every leader opens with this.
7. **No team controls on the dashboard.** There are no roles (viewer, approver, admin), no maker-checker for large payouts and no visible audit trail. These exist only as draft modules.
8. **No real-time updates.** The screen updates only on refresh; there's no push when money arrives. Stripe and Mercury stream new transactions instantly.
9. **One language, one look.** Everything is in English, with no theme choice and no setting for local number and date formats (₵, KSh, €).
10. **Accessibility and speed are unproven.** There's no contrast or keyboard audit, and nothing measures load speed.
11. **Not tested end to end.** I've never seen the signed-in dashboard, because there's no test account I can sign in with.

## Fix plan, in order
1. **Remove all placeholder content:** the real business name and director in the sidebar, the tier badge taken from KYC, and notifications built from real receipts and incoming payments.
2. **Locked quotes:** a rate preview on the swap screen. If the service has no preview step, show the "last rate" with a clear label and a ±% warning.
3. **Real pricing table:** fees, limits and speeds per currency, which I need from you.
4. **Crypto withdraw:**
   - saved addresses with a format check per network
   - a whitelist
   - a 24-hour cool-off for new addresses
   - PIN plus authenticator code
5. **Full-precision crypto amounts,** stored in a separate high-precision column.
6. **Portfolio header:** the total across all wallets in your chosen display currency, plus a 30-day chart.
7. **Team and approvals:** roles, approval limits and an activity log on the dashboard.
8. **Live updates:** new transactions slide in without a refresh, with a sound or vibration option.
9. **Language and local formats:** English and French first, plus local number formats.
10. **Quality checks:** an accessibility and speed audit, and a sign-in test account so I can verify every flow myself.

## What I need from you
- Your real fees, limits and payout speeds for each currency.
- A test login (or permission to create one) so I can check the signed-in screens.
- Confirmation that the banking partner allows crypto withdrawals to outside addresses.

## Technical details
- Notifications come from `payment_receipts` and `ledger_entries` through a realtime subscription in the external project.
- The high-precision amount column needs a manual SQL change in the external project.
- The quote step needs a check of whether the swap service has a quote-only option (`quote: true` performed a real swap in sandbox).
