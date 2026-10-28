# Rebuild Business Go Live (KYB) into 6 steps with automatic approval

## The new merchant flow
```text
1 Phone & email  ->  2 Business identity  ->  3 Directors (BVN)  ->  4 Beneficial owners (BVN)
  (auto, sign-up)    (auto, sign-up)          (BVN only)              (BVN, 25%+ owners)
->  5 Address & web presence  ->  6 Settlement account  ->  7 Two-factor (Google Authenticator)
                                    (name must match)
->  Automatic approval: switch to live + issue a Sterling account number in the business name
```
Tax ID, sanctions/PEP screening and the manual compliance review are removed.

## Each step
1. **Phone & email**: already verified at sign-up, so it shows as Verified.
2. **Business identity**: filled in automatically from the registration lookup done at sign-up (business name, registration number, country). Shown read-only as Verified. This also applies to your current account: it is backfilled from what was saved when you signed up.
3. **Directors**: add one or more directors (first name, last name, BVN). Each BVN is checked instantly. The step passes once at least one director matches.
4. **Beneficial owners**: list anyone owning 25% or more (name, ownership %, BVN), checked the same way. If one of the directors is the owner, an "Owner is a director" shortcut reuses that director's check.
5. **Address & web presence**: business address (street, city, state), plus a website or at least one social link. Validated and saved.
6. **Settlement account**: pick a bank from a searchable dropdown (type to filter by bank name or code), then type the 10-digit account number. The list is loaded live from the provider's bank directory, so every bank and microfinance bank on the rails appears. Nothing is hard-coded. If the list can't load, a Retry button is shown. The account name is fetched automatically. If it doesn't match the verified business name, the step is blocked with a clear message ("This account is in the name of X, not Y") and Continue stays disabled. Small differences such as "Ltd" vs "Limited", capitals and punctuation are ignored.
7. **Two-factor**: the user scans a QR code with Google Authenticator (or any authenticator app) and enters the 6-digit code to confirm.

## Going live
- When step 7 succeeds, the server checks that every step is verified, then:
  - approves the account and switches it to live,
  - issues a live Sterling account number in the verified business name.
- The user sees a success screen with their new account number.
- If issuing the account number fails, the account is still live. The overview then shows "Issue my account number" so they can retry. The failure is never hidden.
- Users still can't switch themselves to live. Only the server does it, after checking every step.

## After going live
- The sidebar item "Go Live (KYB)" becomes "KYB".
- Opening it shows a read-only business profile with a Verified badge: business name, registration number, directors, owners, address and links, settlement account and 2FA status. Users aren't asked to verify again.
- The sandbox progress card disappears from the overview.

## Technical details
- `src/lib/go-live.ts`: new merchant step list (contacts, business_identity, director_bvn, beneficial_owners, operations, settlement_account, two_factor). Name-match helper (normalise case and punctuation, Ltd/Limited, Plc, Nig/Nigeria) with tests. The 6-step progress logic and tests are updated.
- New server functions in `src/lib/kyb.functions.ts` (authenticated, using the service key in the handler):
  - `getKybProfile`: reads `merchant_security` (company_name, rc_number, country), `kyc_steps` and mode, and auto-upserts `business_identity` as verified from `merchant_security`. This is what backfills the current user.
  - `verifyDirector` and `verifyOwner`: run `/v1/identity/bvn`, store a name and masked BVN only in `kyc_steps.summary`/metadata, never the full BVN.
  - `saveOperations`: validates the address and URLs.
  - `listSettlementBanks`: calls `/v1/accounts/banks` with the account's mode key and returns `{ code, name }` sorted by name. It is cached in the query cache, and the bank list goes into a BrandSelect-style searchable dropdown.
  - `verifySettlementAccount`: calls `/v1/accounts/resolve`, then matches the name against `merchant_security.company_name` on the server. Saves only when it matches.
  - `completeGoLive`: confirms the caller has a verified TOTP factor (Auth MFA, aal2) and every step is verified. Sets `account_modes` to mode live and review approved, then calls live `/v1/accounts/virtual` with `bank: "sterling"`, `accountType: "corporate"` and the verified name, and records the resource.
- 2FA uses the external project's built-in Auth MFA (`supabase.auth.mfa.enroll({ factorType: "totp" })`, then challenge and verify). Authenticator TOTP is on by default in the external project. If not, I'll tell you which setting to switch on.
- A small SQL addition for you to run manually: a `metadata jsonb` column on `kyc_steps` and allowing `step` keys for the new steps. Given as a script, same as before.
- `GoLive` in `PaddleConsole.tsx` is rebuilt as a stepper with one panel per step. `merchant.ts` gets a dynamic nav label (KYB when live). `GoLiveProgress` is hidden when live.
- The personal KYC flow is unchanged in this pass.
