# Roadmap

## Done
- [x] SmartTag page (/dashboard?module=smarttag): fully functional + restyled (tags, QR stands, charges); 5 tests, build OK
- [x] Soundboxes: functional register/edit/unlink linked to SmartTags with voice prefs, live payment status, voice preview; 8 tests, build OK
- [x] Direct debits page (/dashboard?module=mandates): real ACH/SEPA/Bacs collections via provider bank-debit endpoint, idempotent, live status; 7 tests, build OK
- [x] Billing schedules: durable weekly/monthly schedules on paddle_resources, run-due executes real debits and advances next run; pause/resume/delete; build OK

## Open
- [ ] Logo for Slikpay: 4 concepts generated (Flow S, Pulse Tile, Secure S, Orbit Coin) in /mnt/documents/slikpay/; user to pick, then refine + favicon + app header
