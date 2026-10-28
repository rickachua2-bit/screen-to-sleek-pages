# Services in the side menu, each one working

## What you'll see
The side menu is regrouped around the same categories as the Services page, so every service is one tap away:

```text
Overview        Dashboard, Transactions, Services, Go Live/KYB
Move money      Bank transfer, Bulk payouts, International, Swap
Get paid        Payment links & invoices, QR & SmartTag, SoftPOS, Direct debits, Escrow
Cards           Virtual cards, Physical cards
Pay bills       Airtime, Data, Electricity, Cable TV, Internet, Betting, Exam PINs
Government      Federal tax, Remita
Grow money      Treasury, Stocks
Travel          Flights
Business        Approvals, Statements, Disputes, Team & security
Developers      API console, Webhooks
```
- Groups fold open/closed and remember their state; a search box at the top of the menu filters items.
- Each item shows a small status dot (Ready / Needs verification / Not active yet) taken from the provider's answer.
- Personal wallet gets the same grouping, minus business-only items.

## Every item becomes a real working screen
Each screen reads and acts on the live provider account — no sample data. Build order:

1. **Bills & government** (already guided) — each gets its own page with saved billers, "pay again" and history.
2. **Virtual cards** — create card (NGN/USD), fund, freeze/unfreeze, view details behind PIN, set limits, card transactions, terminate.
3. **Payment links & invoices** — create, share, list, mark paid, deactivate.
4. **Escrow** — create, fund, release, dispute, with a timeline.
5. **Bulk payouts** — upload CSV, name-check every row, live fee total, PIN, per-row results.
6. **International transfer & swap** — live rate, fee, beneficiary, receipt.
7. **Direct debits / mandates, QR & SmartTag, SoftPOS** — create, list, cancel; device pairing only when the provider confirms it.
8. **Stocks, treasury, flights** — search/quote/buy or book screens.
9. **Disputes, statements, approvals, team** — list and act on provider records; statements export.

Anything the provider refuses for your account shows "Not active yet" instead of pretending.

## Technical details
- Extend `services-registry.ts` to be the single source for the sidebar (category → items → module id) so the menu, Services hub and `/dashboard?module=` stay in sync; replace the hand-written groups in `merchant.ts`.
- One shared `ServiceScreen` shell (list + create + detail + actions) driven by per-service config of catalog op ids; all calls through `runPaddleOperation` (PIN, holds, receipts, ownership rows).
- Before each screen, probe the sandbox endpoint for exact shapes; add tests for registry→menu mapping and each money rule (PIN required live, ownership check).
- This is large; I'll ship it in the order above across several turns, reporting what each step verified.
