# White-label Slikpay, issue Sterling accounts, and a global-standard Go Live checklist

## 1. Issue Sterling Bank account numbers
- The account-number service supports choosing the bank. Every "Issue my account number" request (business and personal) will ask for Sterling Bank.
- If Sterling can't issue the number, the user sees a plain "Couldn't issue your account number, try again" message. We won't quietly switch to another bank.
- Behind the scenes we keep a record of which bank issued each number. The screens never show it.

## 2. Remove all provider names (white-label)
- Remove every visible mention of "Paddle" and "Sterling Bank": sidebar subtitles ("by Sterling Bank"), page titles and descriptions, the partner logo strip, the sign-in trust badges, the terms checkbox, receipts ("Paddle reference" becomes "Reference"), the BVN form ("Verify with Paddle" becomes "Verify"), sandbox tips, error messages and the ledger footnote.
- Account cards show "Slikpay Business" or "Slikpay Personal" instead of a bank name.
- Rename the "via Paddle" counts and messages in the All Banking Services area to use Slikpay wording.

## 3. Regulatory footer (every page)
Add a quiet footer to the sign-in page and both dashboards:

> "Slikpay is a financial technology company, not a bank. Banking services are provided by our licensed partner banks and regulated financial institutions in each market we serve."

## 4. The Go Live checklist on the dashboard
New accounts start in sandbox. The overview shows a progress card ("3 of 7 steps complete") with a link to each step. Below are the steps proposed to meet global standards. These are for discussion and can be changed.

### Personal (KYC): tiered, so users can start small
| Tier | Steps | Unlocks |
|---|---|---|
| Tier 1 | Phone and email verified, legal name, date of birth, BVN or NIN match | Low daily limits, receive money |
| Tier 2 | Live selfie with liveness check, matched against the BVN/NIN photo; home address | Transfers, bills, cards |
| Tier 3 | Government ID (passport, driver's licence, voter's card), proof of address (utility bill, under 3 months old), source of funds | Higher limits, USD card |

Ongoing checks on every user: sanctions and politically exposed person (PEP) screening.

### Business (KYB): all steps required before live
1. **Business identity**: registration number confirmed against the registry (already done at sign-up). Upload the certificate of incorporation and memorandum/articles.
2. **Tax ID**: TIN verified.
3. **Directors**: for each director, BVN/NIN match, live selfie and ID.
4. **Beneficial owners**: everyone owning 25% or more, verified the same way as directors.
5. **Business address and operations**: proof of address, website or social links, a description of what is sold, expected monthly volume.
6. **Settlement account**: a corporate bank account in the business's name, with the account name confirmed against the registered business name.
7. **Compliance review**: sanctions/PEP screening of the business and its owners, a risk rating, then approval by the Slikpay compliance team. Only an approved review turns on live mode.

Regulated categories (lending, gambling, crypto, money transfer) must also upload their operating licence.

### Rules
- Users can never switch themselves to live. Live mode only turns on after a review is approved.
- Each step shows one of: not started, submitted, verified or rejected. Rejected steps show the reason and can be resubmitted.
- Steps that can be verified automatically (BVN, NIN, TIN, registry, account name) are checked instantly. Document steps wait for review.

## Technical details
- Add `bank: "sterling"` to the account-number request in `dashboard.tsx` and the personal workspace. Store the issuing bank in `paddle_resources` metadata.
- Do a text sweep across `src/components/slikpay/*`, the routes' head() and `provider-errors.ts` safe messages. Internal file and function names stay as they are (they are never shown to users).
- `kyc_steps` already exists. Seed the step keys above per role, and add a document-upload step (storage bucket in the external project, given as a SQL script for you to run). Add a shared `ComplianceFooter` component.
- Add tests: live mode stays locked until every required step is verified; every account-number request asks for Sterling.

## Questions for you
- Do you want the tiers and steps exactly as above? Should personal users go live at Tier 1 (with small limits) or only after Tier 2?
- Who approves the final compliance review: your team in an admin screen (to be built later), or automatic once every step passes?
