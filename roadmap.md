# Roadmap

## Done
- [x] SmartTag page (/dashboard?module=smarttag): fully functional + restyled (tags, QR stands, charges); 5 tests, build OK
- [x] Soundboxes: functional register/edit/unlink linked to SmartTags with voice prefs, live payment status, voice preview; 8 tests, build OK
- [x] Direct debits page (/dashboard?module=mandates): real ACH/SEPA/Bacs collections via provider bank-debit endpoint, idempotent, live status; 7 tests, build OK
- [x] Billing schedules: durable weekly/monthly schedules on paddle_resources, run-due executes real debits and advances next run; pause/resume/delete; build OK
- [x] Mobile: floating rounded bottom tab bar with raised center action button; merchant tabs Home/Payments/Ledger/More (More opens drawer); auth page verified responsive at 390px; 2 tests, build OK

## Open
- [ ] Automatic merchant API keys: sandbox at signup, live after trusted KYB approval, secure owner key management, authenticated external read endpoints and tests; external schema activation required.
- [x] Applied selected Integration Studio: navy developer rail, white API key/access workspace, explorer, webhooks, payment attempts and documentation state; desktop initial rendering checked and 20 focused tests passed. Business key issuance and outbound subscriptions remain unconnected, not simulated.
- [x] API console upgrade: paginated searchable explorer with method filters, owner-and-mode-scoped inbound webhook monitoring/reconciliation, server-redacted responses, atomic console payment preparation/settlement, bounded signed bodies and confirmed completion writes; 332 tests passed and unsigned webhook rejected (401).
- [x] API console safety: explicit payment statuses, one reference per mounted attempt, lock payment resubmission, remove partner hints, retry unfinished webhooks, reject malformed JSON and propagate partial credit failures; focused tests passed.
- [ ] API console live validation: external signed-in session unavailable; cross-session recovery, full operation-specific fee contracts and real owner-scoped webhook queries/reconciliation need authenticated verification.
- [ ] Inbound webhook hardening: exact settled-event allowlist awaits documented provider event names; atomic credit/event lease requires external schema deployment. Existing unique references repair partial writes, but do not provide transactional processing.
- [ ] Merchant API platform: scoped business keys, external API endpoints, outbound webhook queue, rate limits, request logs and published documentation; not yet implemented.
- [x] Applied selected Split Studio across all four tabs: navy information rail, custom cyan lock artwork, white workspace and underline navigation. All 15 focused tests passed; live signed-in visual checks remain unavailable without an external session.
- [x] Team screen upgrade: colour-rich Team/Security/Profile/Activity, seven validated requested invitation roles, resend, status/search filters and activity export; focused tests passed.
- [x] Team & Security: branded tabs, owner profile, authenticator setup, current-password-protected password/session actions, PIN replacement, pending invitation notices/revocation and activity; focused tests added.
- [x] Team storage activation: verified invitations (including requested_role), audit and PIN-attempt tables are available after the user's setup.
- [ ] Shared-team access: requires workspace authorization across banking operations; invitation delivery and authenticated actions still need end-to-end verification.
- [x] Federal tax and Remita: dedicated pages, automatic verification, assessed amount/fee binding, atomic payments, honest statuses and downloadable saved records; 11 focused tests and 297 regression tests passed.
- [ ] Tax/Remita live confirmation: needs a real authenticated service response with assessed amount/fee; official receipt retrieval and pending recovery need provider-confirmed contracts. No guessed pricing rail or status endpoint added.
- [x] Betting wallet: automatic customer/user ID verification, server-side revalidation, stale-result protection, atomic funding and pending safety; tests passed. Real authenticated service response remains unverified without a session.
- [x] Cable TV: confirmed smartcard verification, four providers, customer banner and verification-gated plans; lookup/stale-response tests passed. Authenticated provider lookup remains unverified.
- [ ] Logo for Slikpay: 4 concepts generated (Flow S, Pulse Tile, Secure S, Orbit Coin) in /mnt/documents/slikpay/; user to pick, then refine + favicon + app header
- [x] Escrow page: full lifecycle (create/fund/release/dispute/refund, live status), 7 tests, build OK; user picked Split Composer design — applying mockup details (live deal preview, milestone %)
- [x] Virtual cards page: full lifecycle (issue/fund/withdraw/freeze/controls/reveal/activity) via provider card API, Split Composer design, 9 tests, build OK; wired merchant + personal
