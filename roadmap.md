# Merchant dashboard
- [x] Build six navigation groups and 17 URL-aware module workspaces.
- [x] Add header search, currency, environment and notifications controls.
- [x] Add transaction search, status/date filtering and filtered CSV export.
- [x] Verify dashboard navigation and mobile drawer; run tests.

Live module operations are outside this presentation task: new workspaces show connection status and temporary drafts, not submitted banking actions.

# Pop-ups and dropdowns
- [x] Apply shared brand surfaces to dialogs, notifications and dropdowns.
- [x] Replace native dropdowns with branded accessible selectors.
- [x] Verify selections and pop-ups on desktop and phone; run existing tests.

# Verified merchant sign-up and live banking
- [ ] Put phone and email Verify controls and six-digit OTP entries inline on account-details step one; gate continuation on both verified contacts.
- [x] Inspect Paddle phone OTP, Nigerian CAC and banking documentation; identify mismatched payout routes and missing tenant safeguards.
- [x] Use saved email/Paddle/account-service secrets server-side; confirm Resend has verified globalline.io.
- [x] Add phone/email OTP screens, durable verification proof, server-gated merchant creation and real Nigerian business lookup without mock success.
- [x] Add authenticated name-resolution proxy, blocked unsafe transfers/float reads, and provider-sourced Central NIP Session ID receipt support.
- [x] Run 21 tests and verify the live sign-up setup gate with no runtime errors.
- [ ] Activate and verify merchant OTP/CAC/signup end-to-end. Blocked on the user applying supabase/slikpay_verification.sql in the external account project's SQL editor and testing with a controlled real phone/email.
- [ ] Enable country-specific registries. Blocked on Paddle documentation for countries other than Nigeria.
- [ ] Enable live payouts, balances, virtual accounts and receipt reconciliation. Blocked on merchant ownership mapping, payout/PIN contract, idempotency and reconciliation safeguards.
- [ ] Make public OTP issuance production-safe. Blocked on provider-backed delivery abuse controls and an agreed policy.