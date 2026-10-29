# Make the Slikpay dashboard stand out

A new look for the Business (and Personal) home screen that keeps the midnight-cobalt flame theme, with no grid patterns. All figures still come from real account data.

## 1. Signature design
- **Hero balance card**: a big glass card with a slow cobalt-to-cyan-to-magenta glow. The balance counts up when it loads, there is an eye button to hide amounts, and a small trend line shows the last 7 days.
- **Account-number card**: shown as a real-looking bank card with a soft shine. Tap to flip it and see the account name and bank. One tap copies the details.
- **Bento layout**: tiles in mixed sizes (balance, money in/out, top customers, go-live progress) in place of equal rows.
- **Small touches**: amounts in JetBrains Mono, tiles that lift slightly under the cursor, colour-coded status chips, and a time-of-day greeting ("Good morning, Slikpay").

## 2. Quick Action button
- A floating round button (bottom-right, glowing magenta-to-cobalt). Tap it and a ring of actions opens: Send money, Request payment, Payment link, Fund card, Add beneficiary, Refresh.
- **Command bar**: press Ctrl/Cmd+K, or tap the search icon in the top bar, to type and jump to any action, page or recent transaction.

## 3. New features
- **Balance privacy toggle**: hides every amount on screen and remembers the choice.
- **Insights strip**: a short summary of this week, e.g. "Inflows up 18% vs last week" and "3 pending settlements", worked out from real transactions.
- **Live activity feed**: the newest transactions slide in with an icon and a relative time ("2m ago"), with filter chips for All, In, Out and Pending.
- **Cash-flow chart**: switch between 7 days, 30 days and 90 days, with a hover tooltip.
- **Customisable home**: a "Customise" button to show or hide tiles, saved per user.
- **Sandbox/Live badge**: a clear pill in the top bar. Sandbox pulses amber and links to Go Live.
- **Empty states**: friendly illustrated messages when there is no data yet, with no fake numbers.

## 4. Mobile
- A bottom tab bar with the Quick Action button in the centre, and tiles that stack neatly.

## Technical details
- New `DashboardHero`, `FlipNubanCard`, `QuickActionFab`, `CommandPalette` (the existing cmdk dialog), `InsightsStrip`, `ActivityFeed` and `CustomiseSheet` components in `src/components/slikpay/`.
- New design values (glow gradients, glass surfaces, elevation shadows, keyframes) go in `src/styles.css`. No hard-coded colours.
- The privacy and tile choices are saved in the browser, keyed by user. Insights are calculated from the existing transactions list. The actions reuse the current ActionModal and module navigation.
- The changes are mostly visual. The send and pay logic stays the same. I'll add tests for the insights maths (week-over-week change) and the privacy masking.
