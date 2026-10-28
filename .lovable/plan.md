# A full action panel for every currency

Each currency wallet (NGN, GHS, KES, ZAR, USD, EUR, GBP, USDT, USDC) gets the same layout and actions.

## Layout of each wallet
```text
[Flag] Ghana Cedi wallet · Sandbox/Live            [eye]
GH₵ 12,400.00          ≈ ₦ 1,240,000 (live rate)
Pending GH₵ 0.00 · Account: active / not active yet / not issued

[Receive] [Send] [Withdraw] [Swap] [Request] [More ▾]

Account / deposit details card (copy, share)
Recent activity in this currency (In / Out / Swaps filters)
Limits & fees for this currency
```

## The actions
- **Receive (Fund):** shows the account details or crypto deposit address, with copy and share. For crypto, it warns you to send only on the right network.
- **Send:** pay someone else. For bank currencies you enter their bank details, and the name is checked where the country supports it. Crypto sends to an outside address are switched on only if the service supports them.
- **Withdraw:** move money to your own verified payout account. NGN goes to your settlement account; other currencies go to a saved payout account you add once.
- **Swap:** always available, even for currencies with no account issued yet. Swapping into a currency you don't have yet holds the result as that currency's balance. It also offers "Issue account" so you can receive into it later. You see a two-sided form with a "max" button and a flip button.
- **Request:** create a payment link or invoice in that currency.
- **More:** download a statement for this currency, view limits, and copy all details.

## Smart touches
- **Rate shown in naira:** each balance also shows its value in naira, worked out from the latest swap rate. It's labelled "last rate" until a live rate is available.
- **Confirmation screen:** before any money moves, you see the amount, fee, what the other side receives and a PIN prompt in live mode. After it goes through, you get a receipt with a reference.
- **"Not active yet":** when a currency isn't enabled, Receive and Send are locked, and the panel says "Account not active yet". Swap and Withdraw still work for any balance you already hold.
- **On phones:** the actions become a row of large round buttons.

## Rules
- Every money action keeps the existing PIN, approval and funds-hold protection.
- No fake rates and no fake success. If the service doesn't confirm a request, nothing is shown as done.
- Provider names stay hidden.

## Technical details
- `CurrencyWallet` is split into `WalletHeader`, `WalletActions`, `WalletDetails`, `WalletActivity` and `WalletLimits`. `WalletActions` reads an action registry with the rules for each currency kind.
- **Swap** uses `post-crypto-swap`. The received amount is booked as a ledger entry for the destination currency, so balances exist without an issued account. The last rate is stored for the naira value. This first needs a check that the swap result can be booked server-side.
- **Withdraw** uses `post-payouts-transfer` for NGN to the verified settlement account, and `post-payouts-global` for others. A "payout account" record is saved per currency.
- **Send** uses `post-payouts-global` with an account-name check where it's supported.
- **Request** reuses the payment-links module, opened with the currency already chosen.
- **Statement** exports that currency's receipts and ledger entries as a CSV file.
- **Tests:** which actions show for active, not active and not issued wallets; Swap is always enabled; naira value maths; Withdraw only goes to your own verified accounts.
