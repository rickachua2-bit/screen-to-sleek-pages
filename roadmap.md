# Roadmap

## Done
- [x] SmartTag page (/dashboard?module=smarttag): fully functional + restyled (tags, QR stands, charges); 5 tests, build OK
- [x] Soundboxes: functional register/edit/unlink linked to SmartTags with voice prefs, live payment status, voice preview; 8 tests, build OK
- [x] Direct debits page (/dashboard?module=mandates): real ACH/SEPA/Bacs collections via provider bank-debit endpoint, idempotent, live status; 7 tests, build OK
- [x] Billing schedules: durable weekly/monthly schedules on paddle_resources, run-due executes real debits and advances next run; pause/resume/delete; build OK
- [x] Mobile: floating rounded bottom tab bar with raised center action button; merchant tabs Home/Payments/Ledger/More (More opens drawer); auth page verified responsive at 390px; 2 tests, build OK

## Open
- [x] Applied selected Split Studio across all four tabs: navy information rail, custom cyan lock artwork, white workspace and underline navigation. All 15 focused tests passed; live signed-in visual checks remain unavailable without an external session.
- [x] Team screen upgrade: colour-rich Team/Security/Profile/Activity, seven validated requested invitation roles, resend, status/search filters and activity export; focused tests passed.
- [x] Team & Security: branded tabs, owner profile, authenticator setup, current-password-protected password/session actions, PIN replacement, pending invitation notices/revocation and activity; focused tests added.
- [ ] Team activation: account-service check confirmed invitations, audit and PIN-attempt tables are missing. Manually apply supabase/slikpay_team_security.sql to the existing external account service; no SQL administration connection is available here. Shared access separately needs workspace authorization across banking operations.
- [x] Federal tax and Remita: dedicated pages, automatic verification, assessed amount/fee binding, atomic payments, honest statuses and downloadable saved records; 11 focused tests and 297 regression tests passed.
- [ ] Tax/Remita live confirmation: needs a real authenticated service response with assessed amount/fee; official receipt retrieval and pending recovery need provider-confirmed contracts. No guessed pricing rail or status endpoint added.
- [x] Betting wallet: automatic customer/user ID verification, server-side revalidation, stale-result protection, atomic funding and pending safety; tests passed. Real authenticated service response remains unverified without a session.
- [x] Cable TV: confirmed smartcard verification, four providers, customer banner and verification-gated plans; lookup/stale-response tests passed. Authenticated provider lookup remains unverified.
- [ ] Logo for Slikpay: 4 concepts generated (Flow S, Pulse Tile, Secure S, Orbit Coin) in /mnt/documents/slikpay/; user to pick, then refine + favicon + app header
- [x] Escrow page: full lifecycle (create/fund/release/dispute/refund, live status), 7 tests, build OK; user picked Split Composer design — applying mockup details (live deal preview, milestone %)
- [x] Virtual cards page: full lifecycle (issue/fund/withdraw/freeze/controls/reveal/activity) via provider card API, Split Composer design, 9 tests, build OK; wired merchant + personal
