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
- Unconnected merchant operations prepare explicitly labelled in-memory drafts only; never imply policies, verification, payments, device pairing or API secrets are live without a service response.
- Slikpay overlays use shared global surface tokens and BrandSelect wraps the existing Radix Select; portal content carries its own theme so it remains branded outside page containers.
- Accounts, profiles and ledger data come from the dedicated external Supabase project via `src/lib/supabase.ts`; schema lives in `supabase/slikpay_schema.sql` (run manually in its SQL editor) — the project is not Lovable Cloud, so migrations can't be applied from here.
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
