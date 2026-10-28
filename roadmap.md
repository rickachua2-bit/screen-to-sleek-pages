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
- [ ] Bulk payouts CSV with per-row results
- [ ] Mandates, QR/SmartTag, SoftPOS live screens
- [ ] Stocks, treasury, flights screens
- [ ] Disputes, statements, approvals, team on provider records
- [ ] Personal wallet menu regrouping

## Dashboard button redesign (in progress)
- [x] Three full-dashboard design mockups (buttons styled differently in each) for the user to pick
- [x] Build the picked design into CurrencyWallet action circles + dashboard quick-action pills
