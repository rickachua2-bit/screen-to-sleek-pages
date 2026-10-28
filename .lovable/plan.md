# All Banking Services: gap review and rebuild

## Where we fall short today
The "All Banking Services" page is a technical list of about 170 raw service calls, grouped by the provider's own labels ("Core Platform & Telemetry", "Other"). Each one opens a generic form. Wise, Revolut Business, Stripe, Mercury and Moniepoint never show this. They show products: "Pay a bill", "Issue a card", "Open escrow". The services exist, but the page looks like a developer tool, not a bank.

Specific gaps:
1. **No product layer.** The provider's labels and raw field names are shown directly, and the same thing appears twice ("KYC & Identity" and "Identity Verification").
2. **No guided flows.** Bills, airtime, data, electricity, cable, tax, betting, gift cards, flights, escrow, investments and cards all share one blank form. They don't validate first (meter, smartcard), show a preview with the fee, or give a receipt.
3. **Hidden power features.** Escrow, US and Nigerian stocks, flights, open banking and tax/government payments are buried, though no competitor offers all of these together.
4. **No status per service.** Users can't tell which services are live, still in sandbox, need more verification, or aren't enabled yet.
5. **No favourites, recents or search by intent.** You can't type "pay DSTV" or repeat last month's payment.
6. **No saved billers or scheduled payments.** There are no repeat or recurring bills.
7. **Two menus for the same thing.** The left menu (Cards, Treasury, Disputes) and this page overlap without linking to each other.

## What users should see (the new Services hub)
```text
[ Search: "pay electricity", "issue card", "send to Ghana" ]
[ Favourites ]  [ Recent: DSTV 12 Oct · MTN airtime ]
-------------------------------------------------------
Move money    Send · Bulk payouts · International · Schedule
Get paid      Payment links · Invoices · QR · Escrow · Mandates
Cards         Virtual card · Physical card · Spend controls
Pay bills     Airtime · Data · Electricity · Cable · Betting · Education
Government    Tax (FIRS) · State revenue · Customs
Grow money    Savings/treasury · US stocks · NG stocks
Travel        Flights search & booking
Business      Team & roles · Approvals · Statements · Disputes
Developers    API keys · Webhooks · Full API console (advanced)
```
- Each tile shows a status badge: **Available**, **Sandbox**, **Verify to unlock** or **Not active yet**.
- Each service uses the same 4-step pattern: **details, check (validate meter, smartcard, name), review (amount + fee + PIN), receipt (download/share)**.
- Saved billers, "Pay again", and scheduled payments for bills and transfers.
- The raw API list moves to Developers as "Advanced console", so nothing is lost.

## Build order
1. Services hub: categories, search by intent, status badges, favourites and recents. The old console moves under Developers.
2. Guided bill flows: airtime, data, electricity (with token on the receipt), cable, betting, education. All have a validate step, review with fee, PIN, and receipt.
3. Government and tax payments with a validate step.
4. Escrow: create, fund, release or dispute, with status timeline.
5. Investments (US and NG stocks) and Flights as their own sections: browse, quote, confirm.
6. Saved billers, pay again, scheduled payments.
7. Link left-menu items (Cards, Treasury, Disputes, Approvals) to the same service screens so there's one home for each product.

## What I need from you
- Real fees per service, or confirmation to show the provider's fee from each quote.
- Which of investments, flights and escrow you want visible at launch. Some need extra licences in some countries.

## Technical details
- New `src/lib/services-registry.ts` maps product tiles to catalog ids, required step/tier, category and keywords. Status comes from account mode, KYC state and the existing NOT_ACTIVE detection.
- A generic `GuidedService` component uses a per-service config (validate op, pay op, field schema, receipt fields). Money movement goes through the existing `runPaddleOperation` (approval, PIN and `hold_funds` unchanged).
- Favourites, recents and saved billers are stored per user in `kyc_steps` records (same pattern as payout accounts). Scheduled payments need a new table plus a cron route under `/api/public/`, with an SQL file to run manually.
- `PaddleConsole` is kept as "Advanced console" under the developer module.
- Tests: registry status rules (sandbox, verify to unlock, not active) and fee/total calculation on review.
