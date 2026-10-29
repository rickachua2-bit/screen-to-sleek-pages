<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- `src/lib/api.ts` holds only shared types and display helpers — no demo data or offline success fallbacks (guarded by the banking-safety test). Verification and banking use TanStack server functions without mock success so outages never imply verified identity or completed transfers.
- Auth state lives in `src/lib/auth.tsx` (React context backed by localStorage/sessionStorage); the backend is external, not Lovable Cloud.
- Merchant module navigation uses the validated `/dashboard?module=` search parameter and a shared module registry so navigation, refresh and browser history stay synchronized.
- Unconnected operations stay labelled drafts. TeamSecurity stores validated requested roles on owner-scoped invitations, never profiles; these are notice-only intentions, not access grants, until workspace authorization covers every protected operation.
- Overlays/navigation theme independently; BrandSelect wraps Radix. Business keys are trigger-issued, owner/mode/scoped, one-time email-code claims; API reads never expose shared funds.
- External Supabase accounts/profiles/ledger use `src/lib/supabase.ts`; apply `supabase/slikpay_schema.sql` manually, not through Lovable Cloud.
- Money-moving writes (transactions, balance) must go through a trusted server with the service key; browser clients only read them under RLS.
- Merchant onboarding uses durable server-only verification challenges and an Auth insertion trigger from `supabase/slikpay_verification.sql` (run manually) so direct client sign-up cannot bypass OTP and registry proof.
- Provider calls enforce ownership, approval, PIN and atomic holds; console requires explicit settlement and server redaction. Webhook summaries/reconciliation are owner-and-mode-scoped; verified retries never dispatch payments.
- Account mode (sandbox/live) lives server-side in `account_modes`; sandbox uses the `sk_test_` key, live the `sk_live_` key, and users can never switch themselves to live.
- External Auth bearer attachment is registered as function middleware in `src/start.ts`, preserving CSRF middleware; server-only credentials live in handler-imported helpers, never browser code.
- Inline contact controls request channel-specific OTP challenges; a server function binds both verified proofs to current contact values before business lookup, so editing either contact cannot reuse stale verification.
- Paddle failure handling uses allowlisted safe messages and provider retry/reset headers; inline OTP controls suppress overlapping requests, preserve an existing challenge on failed resend, and never auto-retry paid delivery.
- Non-NGN wallets (fiat via accounts/global, USDT/USDC via crypto/address) are `paddle_resources` rows tagged `POST /v1/... <CODE>` with wallet details JSON in resource_id; USDT/USDC auto-issue for live users holding a NUBAN, and refused issuance is recorded so the UI shows "Account not active yet".
- Dashboard live updates subscribe to external realtime (transactions, ledger_entries) via `src/lib/live-updates.ts` with a 60s visible-tab poll fallback; realtime needs `supabase/slikpay_precision.sql` run manually.
- Incoming transfers are captured idempotently (reference col:<provider ref>) by the webhook and a 30s/refresh pull sync in collections.server.ts; unrecorded 10-digit receiving accounts auto-link only when their name matches the user's verified business name, since the provider key sees every customer's collections.
- Services use the shared registry; BillsService renders bills, Airtime its own page, and GovernmentPayments owns tax/Remita screens. Government execution revalidates amount/fee, reserves atomically and stores obligation-bound receipts; missing contracts block dispatch.
- Bills lookups bind identity to provider and number; cable gates plans, betting revalidates before reserving funds and settles only explicit statuses to prevent stale verification and false success.
- TransferComposerLayout owns the split transfer presentation; SendNIP retains bank lookup, review and payment execution and publishes display-only preview state so page and modal share one payment flow.
- NIP transfers re-resolve the recipient, derive NGN and reserve principal plus provider fee server-side via service-only transactional RPCs; ambiguous outcomes retain held funds and pending receipts rather than claiming failure or freeing funds. Receipt summaries store principal and NIP session ID separately from fee-inclusive reserved amounts.
- Bulk payment files use Papa Parse and server-owned saved batches with stable row references; BulkImport maps/corrects files before server preparation and the UI resumes original receipts on re-upload, preventing duplicate payouts.
- Only owner-confirmed USDT/USDC-to-NGN swaps execute through executeVerifiedSwap; generic catalog swaps stay blocked. Completed toAmount is net of fee; owned same-key receipts recover pending conversions without reserving twice, and settlement posts NGN once. CryptoBankFunding then runs protected NIP transfers to any resolved NGN recipient with separate approval; bank payouts never auto-retry and retain uncertain holds.
- Crypto cash-out previews use authenticated crypto/rates sell and wholesale pairs; their difference is the embedded provider spread, not an extra charge. Rate previews never authorize conversion.
- Payment errors use paymentFeedback; never echo raw errors or equate uncertain dispatch with decline.
- Cross-border/remittance payouts run through `global-payout.server.ts` on owner-confirmed contracts: US/GB/EUR-6/GH/KE/ZA corridors, 0.5% fees (NGN floor ₦5,000; foreign floor 5/cap 25 units), exact reservation before dispatch, timeouts settle pending and retain holds, and recovery via GET /v1/payouts/{key} settles only on matching SUCCESSFUL or terminal FAILED/DECLINED/REJECTED/REVERSED; generic catalog dispatch stays blocked.
- Wallet balances use providerBalances and parseWalletBalances; ledger fills omitted currencies, unknown payloads never guess. ConsoleMissionControl derives overview activity from loaded owned receipts/webhook summaries, not fabricated request telemetry.
- InternationalServices owns the International & Swap overview and focused tabs; overview reuses compact ReceiveAccounts and protected CrossBorderPayout, conversion opens CryptoBankFunding, and disconnected vaults stay notice-only to avoid fabricated settlement. Quotes bind current instructions and request sequence; pending attempts lock dispatch and retain original references.
- International funding availability is checked by shared globalFundingSupported in both quote execution and the composer; all wallets/destinations remain visible, while unconfirmed pairs never quote or dispatch and stablecoin bank sending reuses CryptoBankFunding.
- Flight booking uses all five provider flight endpoints via `flights.server.ts`; bookings re-read the fare from the search, reserve the fare-currency wallet atomically, and settle only on explicit confirmation with PNR and matching fare, so no fabricated fares or tickets appear.
