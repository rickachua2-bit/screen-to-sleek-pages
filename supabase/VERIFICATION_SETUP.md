# Slikpay merchant verification setup

Run `slikpay_verification.sql` in the SQL editor of the existing account project (`gqbgdqkmdyvzgovugjku`). This cannot be applied from the Lovable workspace. It creates private OTP proof storage, PIN security storage, and an Auth trigger that prevents direct merchant signup without server-verified proof. It removes the sample NUBAN default but does not change existing account numbers.

Configured services:
- Phone OTP: Paddle BaaS `/v1/otp/send` and `/v1/otp/verify`.
- Email OTP: Resend, sending from `info@globalline.io`.
- Nigerian business lookup: Paddle BaaS `/v1/identity/cac`.
- Signed-in bank name resolution: Paddle BaaS `/v1/accounts/resolve`.

Secrets remain server-only: `PADDLE_BAAS_KEY`, `RESEND_API_KEY`, `SLIKPAY_SUPABASE_SERVER_KEY`. The documented Paddle URL defaults to `https://api.getpaddle.online/v1`; an optional `PADDLE_BAAS_URL` must match this approved URL.

After applying the script, test with an actual phone and email you control. Complete both OTPs, then enter a real Nigerian RC/BN/IT number and confirm the returned registered business name. OTP acceptance requires an explicit `data.verified: true`; generic request success never counts as verification. Provider response parsing still needs confirmation through a real authorized verification journey.

Not production-ready yet:
- OTP issuance needs provider-backed abuse controls before public launch. Attempt counting protects verification, not unrestricted delivery requests.
- Countries other than Nigeria need documented registry endpoints; their lookup remains blocked.
- Payouts and platform-wide balance reads remain blocked. A shared platform API key must never permit every signed-in customer to access platform float. Per-user funding-account ownership, transaction limits, approval policies, independent PIN validation, durable idempotency and reconciliation must be established first.
- Virtual account issuance is not enabled. New signups do not receive invented account numbers.
- Receipt rendering reads `transactions.metadata.nipSessionId` when supplied by a trusted reconciliation service. This change does not create or reconcile live payouts.
- Existing sample card/bill/savings experiences are outside this integration scope.

TanStack server functions implement the secure proxy on this project; no Deno Edge Function is deployed or invoked.