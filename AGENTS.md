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

- Legacy read-only Slikpay API calls may use `src/lib/api.ts` demo fallbacks; verification and banking use TanStack server functions without mock success so outages never imply verified identity or completed transfers.
- Auth state lives in `src/lib/auth.tsx` (React context backed by localStorage/sessionStorage); the backend is external, not Lovable Cloud.
- Merchant module navigation uses the validated `/dashboard?module=` search parameter and a shared module registry so navigation, refresh and browser history stay synchronized.
- Unconnected merchant operations stay labelled in-memory drafts; never imply they are live without a service response.
- Slikpay overlays use shared global surface tokens and BrandSelect wraps the existing Radix Select; portal content carries its own theme so it remains branded outside page containers.
- External Supabase accounts/profiles/ledger use `src/lib/supabase.ts`; apply `supabase/slikpay_schema.sql` manually, not through Lovable Cloud.
- Money-moving writes (transactions, balance) must go through a trusted server with the service key; browser clients only read them under RLS.
- Merchant onboarding uses durable server-only verification challenges and an Auth insertion trigger from `supabase/slikpay_verification.sql`; run it manually in the external project so direct client sign-up cannot bypass OTP and registry proof.
- Paddle services run through `runPaddleOperation` using the generated catalog (`src/lib/paddle-catalog.ts`, regenerate from Paddle's OpenAPI) and `paddle-policy.ts` scopes: platform-wide reads stay hidden, item calls need a `paddle_resources` ownership row, and live money movement needs approval, PIN and an atomic `hold_funds` ledger reservation, because one Paddle account holds every customer's funds.
- Account mode (sandbox/live) lives server-side in `account_modes` (from `supabase/slikpay_banking.sql`); sandbox uses the `sk_test_` key, live the `sk_live_` key, and users can never switch themselves to live.
- External Auth bearer attachment is registered as function middleware in `src/start.ts`, preserving CSRF middleware; server-only credentials live in handler-imported helpers, never browser code.
- Inline contact controls request independent channel-specific OTP challenges; a server function binds both verified proofs to current contact values before business lookup, so editing either contact cannot reuse stale verification.
- Paddle failure handling uses allowlisted safe messages and provider retry/reset headers; inline OTP controls suppress overlapping requests, preserve an existing challenge on failed resend, and never auto-retry paid delivery.
- Non-NGN wallets (fiat via accounts/global, USDT/USDC via crypto/address) are tracked as `paddle_resources` rows tagged `POST /v1/... <CODE>` with wallet details JSON in resource_id; USDT/USDC auto-issue for live users holding a NUBAN, and refused issuance is recorded so the UI shows "Account not active yet".
- Dashboard live updates subscribe to the external project realtime (transactions, ledger_entries) via `src/lib/live-updates.ts` with a 60s visible-tab poll fallback; realtime needs `supabase/slikpay_precision.sql` run manually.
- Incoming transfers are captured idempotently (reference col:<provider ref>) by both the webhook and a 30s/refresh pull sync in src/lib/collections.server.ts; unrecorded 10-digit receiving accounts are auto-linked only when their name matches the user's verified business name, since the provider key can see every customer's collections.
- Services use `services-registry.ts` with a shared visual catalog (ServicesCatalog) and account context (ServicesHub); payment execution retains shared PIN, holds and receipt safeguards.
- TransferComposerLayout owns the split transfer presentation; SendNIP retains bank lookup, review and payment execution and publishes display-only preview state so the page and modal share one payment flow.
- NIP transfer execution re-resolves the recipient, derives NGN and reserves principal plus the provider fee server-side; ambiguous dispatch outcomes retain held funds and pending receipts rather than claiming failure or making funds spendable again.
- Bulk payment files use Papa Parse and server-owned saved batches with stable row references; the UI resumes original receipts rather than minting new references on re-upload, to prevent duplicate payouts.
- Wallet and NIP bank-transfer reservations and settlement use service-only transactional RPCs from the payment reliability script; unknown outcomes retain holds. Receipt summaries store principal and NIP session ID separately from fee-inclusive reserved amounts to keep ledger displays accurate.
- Only owner-confirmed USDT/USDC-to-NGN swaps execute through executeVerifiedSwap; generic catalog swaps stay blocked. Completed toAmount is net of fee; owned same-key receipts recover pending conversions without reserving twice, and transactional settlement posts NGN once.
- Crypto cash-out previews use authenticated crypto/rates sell and wholesale pairs; their difference is the embedded provider spread, not an extra charge. Rate previews never authorize conversion.
- CryptoBankFunding uses swapCurrency then protected runPaddleOperation NIP transfers to any resolved NGN recipient with separate approval; pending conversions resume original receipt keys, pairs and amounts. Bank payouts never auto-retry and retain uncertain holds.
- Payment errors use paymentFeedback; never echo raw errors or equate uncertain dispatch with decline.
- BulkImport maps/corrects files before server preparation; saved row keys and protected payment execution remain unchanged to prevent duplicates.
- InternationalServices owns cross-border/remittance discovery/history; global/tuition and foreign-wallet payouts stay server-blocked until corridor, fee-inclusive debit, beneficiary and recovery contracts are confirmed; endpoint existence never authorizes payment.
