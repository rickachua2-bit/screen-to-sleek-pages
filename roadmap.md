# Roadmap — global-standard dashboard
- [x] Remove placeholder content (sidebar business, tier badge, notifications)
- [x] Swap review shows last-rate estimate with clear label
- [x] Full-precision crypto amounts (needs `supabase/slikpay_precision.sql` run manually)
- [x] Portfolio header: total across all wallets in NGN
- [x] Live updates when money arrives (needs realtime SQL run manually)
- [x] Local number formats per currency
- [ ] Real fees/limits/speeds per currency — blocked: user to supply pricing
- [ ] Crypto withdraw to external addresses — blocked: partner confirmation
- [ ] Team roles & approval limits — next build step (large)
- [ ] French language — next build step
- [ ] Signed-in end-to-end checks — blocked: test login

## Services hub (plan approved 28 Oct)
- [x] Apply selected Ask Slikpay design to banking and business services, preserving connected flows (catalog visually checked; signed-in service execution remains unverified)
- [x] Services hub: categories, intent search, status badges, favourites, recents; raw console moved to Developers
- [x] Guided bills: airtime, data, electricity (token), cable TV, internet, betting, exam PINs
- [x] Government: FIRS tax and Remita with validate step
- [x] Escrow: create deal
- [ ] Escrow fund / release / dispute timeline
- [ ] Guided investments and flights screens (currently open the advanced console)
- [ ] Saved billers, pay again, scheduled payments (needs new table + SQL run manually)
- [ ] Link left-menu Cards/Treasury/Disputes/Approvals to live service screens
- [x] Live fees and FX from the provider (admin-set rates later)
- [ ] Admin backend for own rates and markups

## Services in the side menu
- [x] Sidebar regrouped by service category, foldable, searchable; bills/gov/escrow open directly
- [ ] Virtual cards full lifecycle (create, fund, freeze, limits, terminate)
- [ ] Payment links & invoices live screen
- [ ] Escrow fund/release/dispute timeline
- [x] Bulk payouts CSV with per-row results and stable saved references implemented — activation requires payment reliability SQL in external account service
- [ ] Mandates, QR/SmartTag, SoftPOS live screens
- [ ] Stocks, treasury, flights screens
- [ ] Disputes, statements, approvals, team on provider records
- [ ] Personal wallet menu regrouping

## Dashboard button redesign (in progress)
- [x] Fix recipient bank search; harden server recipient/NGN validation, exact fees, fee-inclusive holds and truthful result handling; isolated browser checks and 110 tests pass
- [ ] Certify bank transfers end-to-end — blocked: no external authenticated test session; pending-payment reconciliation contract and deployed transactional/PIN-throttling guarantees remain unverified
- [x] Apply Composer Split to the bank transfer page; desktop/mobile layout and quick-amount summary checked in isolation; signed-in payment flow remains unverified
- [x] Three full-dashboard design mockups (buttons styled differently in each) for the user to pick
- [x] Build the picked design into CurrencyWallet action circles + dashboard quick-action pills

## Bulk payments and fiat/crypto transfers
- [x] Review bulk-upload gaps against global payment standards and report confirmed limitations
- [x] Add Fiat/Crypto choices and gated USDT/USDC-to-NGN bank funding preview; no execution enabled without verified rails
- [x] CSV quoted-cell parsing, duplicates, numeric checks, fee-inclusive totals, template and results downloads; saved batch restore uses original receipts
- [ ] Activate saved batches and atomic wallet settlement — activation requested; remote readiness check confirmed `payment_batches`, `begin_wallet_payment` and `finish_wallet_payment` are missing (29 Oct 2026). Blocked: `supabase/slikpay_payment_reliability.sql` must be applied manually in the existing external account service SQL editor; no migration-authorized connection is available here.
- [ ] Enable crypto conversion plus bank payout with a durable cash-out record — blocked: provider documentation omits supported pairs, firm quote/fees, swap status and reconciliation contracts
- [ ] Reconcile pending outbound payments and allow confirmed-failure retries — blocked: authoritative provider reference/status contract
- [ ] Verify quote, fee, balance reservation, conversion and payout status end-to-end — blocked: external authenticated test access and confirmed conversion/payout contract
- [x] Swap/withdrawal now fail closed, retain uncertain holds and require transactional reservation/settlement; RPC boundary tests pass, deployed SQL remains unverified
