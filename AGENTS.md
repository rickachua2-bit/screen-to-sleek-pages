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
- `baasService` validates the external Slikpay bearer token, allowlists operations, and blocks payouts/platform balance reads until per-merchant ownership and PIN authorization are established; an authenticated user alone must not spend shared platform funds.
- External Auth bearer attachment is registered as function middleware in `src/start.ts`, preserving CSRF middleware; server-only credentials live in handler-imported helpers, never browser code.
