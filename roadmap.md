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
- [ ] Confirm banking provider documentation, phone OTP/CAC contracts, supported countries, PIN validation and transfer ownership safeguards. Blocked on provider documentation.
- [ ] Use the saved RESEND_API_KEY for email OTP delivery from info@globalline.io; verify the sending domain before live delivery.
- [ ] Implement server-enforced phone/email verification and country-aware registered-business lookup without mock success.
- [ ] Implement authenticated banking proxy, live balance/name resolution, PIN-protected transfers and provider-backed NIP receipts.
- [ ] Test verification gates and banking safeguards; verify connected journeys without initiating unapproved real transfers.