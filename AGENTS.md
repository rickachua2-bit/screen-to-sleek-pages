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
- Unconnected merchant operations stay labelled in-memory drafts; never imply they are live without a service response.
- Slikpay overlays use shared global surface tokens and BrandSelect wraps the existing Radix Select; portal content carries its own theme so it remains branded outside page containers.
- External Supabase accounts/profiles/ledger use `src/lib/supabase.ts`; apply `supabase/slikpay_schema.sql` manually, not through Lovable Cloud.
- Money-moving writes (transactions, balance) must go through a trusted server with the service key; browser clients only read them under RLS.
- Merchant onboarding uses durable server-only verification challenges and an Auth insertion trigger from `supabase/slikpay_verification.sql` (run manually) so direct client sign-up cannot bypass OTP and registry proof.
- Paddle services run through `runPaddleOperation` with the generated catalog (`src/lib/paddle-catalog.ts`) and `paddle-policy.ts` scopes: platform-wide reads stay hidden, item calls need a `paddle_resources` ownership row, and live money movement needs approval, PIN and an atomic `hold_funds` reservation, because one Paddle account holds every customer's funds.
- Account mode (sandbox/live) lives server-side in `account_modes`; sandbox uses the `sk_test_` key, live the `sk_live_` key, and users can never switch themselves to live.
- External Auth bearer attachment is registered as function middleware in `src/start.ts`, preserving CSRF middleware; server-only credentials live in handler-imported helpers, never browser code.
- Inline contact controls request channel-specific OTP challenges; a server function binds both verified proofs to current contact values before business lookup, so editing either contact cannot reuse stale verification.
- Paddle failure handling uses allowlisted safe messages and provider retry/reset headers; inline OTP controls suppress overlapping requests, preserve an existing challenge on failed resend, and never auto-retry paid delivery.
- Non-NGN wallets (fiat via accounts/global, USDT/USDC via crypto/address) are `paddle_resources` rows tagged `POST /v1/... <CODE>` with wallet details JSON in resource_id; USDT/USDC auto-issue for live users holding a NUBAN, and refused issuance is recorded so the UI shows "Account not active yet".
- Dashboard live updates subscribe to external realtime (transactions, ledger_entries) via `src/lib/live-updates.ts` with a 60s visible-tab poll fallback; realtime needs `supabase/slikpay_precision.sql` run manually.
- Incoming transfers are captured idempotently (reference col:<provider ref>) by the webhook and a 30s/refresh pull sync in collections.server.ts; unrecorded 10-digit receiving accounts auto-link only when their name matches the user's verified business name, since the provider key sees every customer's collections.
- Services use `services-registry.ts` (ServicesCatalog/ServicesHub); bills modules render through the registry-driven BillsService page, Airtime its own page — extend the registry, not one-off payment code. Payment execution keeps shared PIN, holds and receipt safeguards.
- TransferComposerLayout owns the split transfer presentation; SendNIP retains bank lookup, review and payment execution and publishes display-only preview state so page and modal share one payment flow.
- NIP transfers re-resolve the recipient, derive NGN and reserve principal plus provider fee server-side via service-only transactional RPCs; ambiguous outcomes retain held funds and pending receipts rather than claiming failure or freeing funds. Receipt summaries store principal and NIP session ID separately from fee-inclusive reserved amounts.
- Bulk payment files use Papa Parse and server-owned saved batches with stable row references; BulkImport maps/corrects files before server preparation and the UI resumes original receipts on re-upload, preventing duplicate payouts.
- Only owner-confirmed USDT/USDC-to-NGN swaps execute through executeVerifiedSwap; generic catalog swaps stay blocked. Completed toAmount is net of fee; owned same-key receipts recover pending conversions without reserving twice, and settlement posts NGN once. CryptoBankFunding then runs protected NIP transfers to any resolved NGN recipient with separate approval; bank payouts never auto-retry and retain uncertain holds.
- Crypto cash-out previews use authenticated crypto/rates sell and wholesale pairs; their difference is the embedded provider spread, not an extra charge. Rate previews never authorize conversion.
- Payment errors use paymentFeedback; never echo raw errors or equate uncertain dispatch with decline.
- Cross-border/remittance payouts run through `global-payout.server.ts` on owner-confirmed contracts: US/GB/EUR-6/GH/KE/ZA corridors, 0.5% fees (NGN floor ₦5,000; foreign floor 5/cap 25 units), exact reservation before dispatch, timeouts settle pending and retain holds, and recovery via GET /v1/payouts/{key} settles only on matching SUCCESSFUL or terminal FAILED/DECLINED/REJECTED/REVERSED; generic catalog dispatch stays blocked.
- Wallet balances come from the provider's GET /v1/wallet/balance via providerBalances (paddle.server.ts), parsed by pure parseWalletBalances (wallet-balance.ts); the ledger only fills currencies the provider omits, and unrecognised payloads fall back to ledger rather than show a guess.
