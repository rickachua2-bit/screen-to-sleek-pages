# Bank Transfers — gap analysis and redesign

## What we have today
A small pop-up: pick bank (searchable), enter account number, name check, amount, note, review with live fee, PIN, success screen with reference. It works, but it is a basic form.

## What stops us meeting global standard (vs Wise, Revolut, Mercury, Moniepoint, Kuda)
1. No saved beneficiaries or "recent recipients" — users retype every time.
2. No status tracking after sending (Processing / Sent / Reversed) — only a one-off success screen.
3. No downloadable or shareable receipt from the success screen.
4. No daily limit / balance check shown before sending.
5. No scheduled or repeating transfers.
6. No bulk transfer (upload a list).
7. No approval rules for business teams (second person approves large amounts).
8. No duplicate-payment warning (same person, same amount, short time).
9. No "Send again" from history.
10. Feels like a pop-up, not a full screen experience.

## How it should look
A dedicated Transfer screen in the Navy Sidebar style:

```text
+-------------------------------------------------------------+
| Send money        Balance ₦xx  ·  Today's limit left ₦xx    |
+------------------------------+------------------------------+
| Recent & saved (avatars row) |  Live summary card            |
| [Search name / account]      |  To · Bank · Amount · Fee     |
| Bank (search)  Account no.   |  Arrives: Instantly           |
| ✓ Verified name chip         |  Total debited                |
| Amount (big) + quick amounts |  [Send now] [Schedule]        |
| Note · Save beneficiary      |                               |
+------------------------------+------------------------------+
| Tabs: Single · Bulk upload · Scheduled · Pending approval  |
+-------------------------------------------------------------+
```
Then a PIN sheet, then a success screen with a live status timeline, Share / Download receipt and "Save beneficiary".

## Build order
1. New full Transfer screen with live summary card, quick amounts, balance and limit display.
2. Saved and recent recipients (from the existing beneficiaries table plus past transfers), one-tap Send again.
3. Duplicate warning and "insufficient balance" check before PIN.
4. Success screen with status timeline, shareable/printable receipt.
5. Bulk transfer via CSV with name check per row, single PIN for the batch.
6. Scheduled/repeating transfers and team approval — prepared as clearly labelled drafts until the banking partner confirms support (no fake "scheduled" success).

## Technical notes
- Money still flows only through `runPaddleOperation` (`post-payouts-transfer`), keeping PIN, holds and receipts in one place; fees stay live from the provider.
- Beneficiaries read from the external project's `beneficiaries` table under RLS; recents derived from `payment_receipts`.
- Bulk reuses the same server call per row with its own idempotency key.
- Tests: duplicate-detection rule and bulk CSV parsing.
