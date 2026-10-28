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

- All Slikpay API calls go through `src/lib/api.ts` `request()`, which falls back to mock data when the API is unreachable — keeps the UI working offline.
- Auth state lives in `src/lib/auth.tsx` (React context backed by localStorage/sessionStorage); the backend is external, not Lovable Cloud.
- Merchant module navigation uses the validated `/dashboard?module=` search parameter and a shared module registry so navigation, refresh and browser history stay synchronized.
- Unconnected merchant operations prepare explicitly labelled in-memory drafts only; never imply policies, verification, payments, device pairing or API secrets are live without a service response.
- Slikpay overlays use shared global surface tokens and BrandSelect wraps the existing Radix Select; portal content carries its own theme so it remains branded outside page containers.
