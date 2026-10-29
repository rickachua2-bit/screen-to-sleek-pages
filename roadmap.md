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
- [x] Bulk payouts CSV with per-row results and stable saved references implemented — saved-batch storage confirmed available on 29 Oct 2026; signed-in execution remains unverified
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
- [x] Activate owner-confirmed USDT/USDC-to-NGN response contract (02:24 UTC): toAmount is net of platformFee; original idempotency-key replay recovers the original result. Scoped execution, owner/mode/pair/amount-bound receipt recovery without a second reservation, one-time transactional credit and pending-conversion recovery controls implemented. 37 selected tests pass; build OK. Signed-in real payment execution remains unverified; owner-confirmed provider behavior was not independently exercised.
- [x] Wire revised two-step composition requested at 02:19 UTC through existing swapCurrency and withdrawFunds — conversion gate preserved, confirmed ledger credit and separate bank review required, one reference per leg per review and uncertain submissions locked. Bank fee fits within confirmed proceeds, PIN is cleared after each call. 27 selected tests pass and build OK; browser check redirects to sign-in. Activation, durable cross-session recovery and signed-in payment certification remain blocked by verified provider conversion/recovery support and authenticated test access.
- [ ] Apply uploaded cash-out executor (02:15 UTC, 29 Oct 2026) — blocked: the proposed function dispatches conversion before validating the local PIN or reserving the user's crypto, generates fresh references on each retry, stores no durable conversion/payout state, accepts an amount without confirmed conversion status, omits the NGN bank fee and trusts the client recipient name. A payout timeout cannot establish that funds are safe in the user's NGN balance. Keep execution gated pending an authoritative conversion result/recovery contract and a durable, owner-scoped two-leg implementation; 21 existing conversion/payment safety tests pass.
- [ ] Adapt official owner-supplied crypto rates/swap/payout sequence (02:11 UTC): authenticated crypto rates confirmed HTTP 200 with USDT_NGN/USDC_NGN sell and wholesale pairs; live fee/spread preview implemented without fallback or double-charging, 21 selected tests pass and build OK. Unknown outcomes retain holds; no automatic payout retry after timeout. Blocked: rate response lacks binding quote ID/expiry/acceptance and conversion-status recovery; signed-in cash-out verification unavailable.
- [ ] Activate provider-fee-backed USDT/USDC bank cash-out requested at 01:58 UTC on 29 Oct 2026 — public OpenAPI recheck returned HTTP 200: crypto_swap fee calculator exists but specifies neither pair nor fee currency; no crypto quote path; swap and payout-status success responses have no schemas. Blocked on provider's binding quote, supported-pair and authoritative recovery contract plus authenticated test access. 19 selected safety tests pass; conversion stays gated.
- [ ] Resolve remaining signed-in payment and crypto cash-out blockers requested on 29 Oct 2026 — bank-transfer atomic settlement, sandbox bulk balance gating, truthful banking-read errors and conversion execution gate corrected; 33 selected tests pass. Blocked: external sign-in session is unavailable to the agent (browser redirected to /auth); provider quote/USDC-pair/status recovery contracts remain unspecified.
- [ ] Harden session-bound second-factor authorization and account-specific banking cache before payment certification — email OTP currently has no server session-bound proof; requires external schema setup and authenticated verification. Do not use an authentication bypass to test payments.
- [x] Review bulk-upload gaps against global payment standards and report confirmed limitations
- [x] Add Fiat/Crypto choices and gated USDT/USDC-to-NGN bank funding preview; no execution enabled without verified rails
- [x] CSV quoted-cell parsing, duplicates, numeric checks, fee-inclusive totals, template and results downloads; saved batch restore uses original receipts
- [x] Activate saved batches and atomic wallet settlement setup — user applied the SQL; remote schema check confirmed `payment_batches`, `begin_wallet_payment`, `finish_wallet_payment` and `hold_funds` available and saved-batch read returned HTTP 200 on 29 Oct 2026. Existing code already uses them; actual signed-in execution remains unverified.
- [ ] Enable crypto conversion plus bank payout with a durable cash-out record — blocked: provider documentation omits supported pairs, firm quote/fees, swap status and reconciliation contracts
- [ ] Reconcile pending outbound payments and allow confirmed-failure retries — blocked: authoritative provider reference/status contract
- [ ] Verify quote, fee, balance reservation, conversion and payout status end-to-end — blocked: external authenticated test access and confirmed conversion/payout contract
- [x] Swap/withdrawal and NIP payouts use atomic reservation/settlement; all conversion execution entry points are gated, sandbox bulk tests do not require live balances, missing banking reads fail explicitly, principal/fee/session receipts remain accurate. 33 selected tests pass; live settlement remains unverified.
