# Roadmap

## Done
- [x] SmartTag page (/dashboard?module=smarttag): fully functional + restyled (tags, QR stands, charges); 5 tests, build OK
- [x] Soundboxes: functional register/edit/unlink linked to SmartTags with voice prefs, live payment status, voice preview; 8 tests, build OK
- [x] Direct debits page (/dashboard?module=mandates): real ACH/SEPA/Bacs collections via provider bank-debit endpoint, idempotent, live status; 7 tests, build OK
- [x] Billing schedules: durable weekly/monthly schedules on paddle_resources, run-due executes real debits and advances next run; pause/resume/delete; build OK
- [x] Mobile: floating rounded bottom tab bar with raised center action button; merchant tabs Home/Payments/Ledger/More (More opens drawer); auth page verified responsive at 390px; 2 tests, build OK

## Open
- [ ] Betting wallet: automatic customer/user ID verification, server-side funding checks, stale-result protection and tests.
- [x] Cable TV: confirmed smartcard verification, four providers, customer banner and verification-gated plans; lookup/stale-response tests passed. Authenticated provider lookup remains unverified.
- [ ] Logo for Slikpay: 4 concepts generated (Flow S, Pulse Tile, Secure S, Orbit Coin) in /mnt/documents/slikpay/; user to pick, then refine + favicon + app header
- [x] Escrow page: full lifecycle (create/fund/release/dispute/refund, live status), 7 tests, build OK; user picked Split Composer design — applying mockup details (live deal preview, milestone %)
- [x] Virtual cards page: full lifecycle (issue/fund/withdraw/freeze/controls/reveal/activity) via provider card API, Split Composer design, 9 tests, build OK; wired merchant + personal
