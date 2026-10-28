# Bulk-payment reliability and fiat/crypto bank transfers

## What is missing today

Bulk upload checks bank account names and sends individual NGN payments, but the batch exists only while the page stays open. The total excludes fees, re-uploading can create duplicate payments, and pending rows do not automatically reconcile. CSV parsing also does not handle quoted cells properly.

Crypto swaps and bank payouts exist separately. They are not a verified one-step cash-out service. Uncertain swap/withdrawal outcomes currently release reserved funds; this must be corrected first.

## Build order

### 1. Protect money first
- Create each payment receipt before reserving funds; prevent repeated requests from reserving twice.
- Keep funds reserved after an uncertain provider outcome. Never show success without confirmed results.
- Check every ledger write and support reconciliation before further spending.
- Confirm supported conversion pairs, payout status responses and fees with the connected banking service. Do not invent an on-chain transfer endpoint.

### 2. Fiat / Crypto on Bank transfer
- Preserve the selected navy information panel and white transfer form.
- Add Fiat / Crypto choices, with USDT and USDC funding for NGN payouts where supported.
- Support the verified own settlement account or another bank recipient, using the existing bank search and name verification.
- Show source amount, live conversion estimate, conversion fee, NGN received, bank transfer fee and total before approval.
- Bank transfer fee remains **1% capped at ₦80**; conversion fees remain provider-supplied.
- First deliver a clearly separated conversion and NGN payout flow. Conversion confirmation is not bank payment confirmation.
- Link both steps to a saved cash-out record. If payout fails after conversion, retain the NGN wallet credit and allow a safe payout retry without converting again.
- Show unsupported pairs as unavailable. External crypto-address transfers remain unavailable until their network and endpoint contracts are confirmed.

### 3. Bulk upload: first reliability release
- Proper CSV parsing, a downloadable template, finite amounts, row limits and duplicate warnings.
- Preview recipient names, row errors, principal, individual fees and fee-inclusive batch total.
- Prevent uploading or resubmitting while processing.
- Save batches and row references, recover after closing the page, reconcile pending payments and export row results.
- Retry only confirmed failures; never automatically retry an uncertain payment.

### Later competitive features
Excel imports and column matching, editable row errors, reusable recipient groups, two-person approval limits, scheduled payroll, accounting exports and multi-currency batches. These should follow dependable execution, not precede it.

## Technical details and dependencies
- Reuse existing authenticated bank resolution, NGN transfer validation, pricing and receipt handling; do not duplicate money-moving logic in presentation code.
- Durable batches, cash-out records and atomic settlement require SQL changes in the existing external project. Those changes must be applied there before activation; this workspace cannot apply them.
- Provider catalog entries alone do not establish live enablement or quote/reconciliation contracts. Verify those contracts before enabling affected operations.
- Add targeted tests for idempotency, uncertain outcomes, fee-inclusive totals, duplicate uploads and conversion-success/payout-failure recovery.
- Signed-in end-to-end payment checks are blocked until authenticated test access is available. No production certification or live-money testing is implied.