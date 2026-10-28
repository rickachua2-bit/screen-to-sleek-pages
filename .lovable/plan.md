# Sleek fintech refresh, same Slikpay colours

Keep Cobalt, Cyan and Magenta, but use them the way top fintech apps (Revolut, Mercury, Ramp) do: a calm, deep base with colour used sparingly for emphasis.

## The colour rules
- **Base:** deep midnight-cobalt background (kept), with cards one step lighter and a faint glass edge instead of grey borders.
- **Cobalt = action.** Primary buttons, the selected menu item, links.
- **Cyan = money in / positive.** Credits, "Ready" badges, balance highlights, focus rings.
- **Magenta = attention only.** Alerts, "Needs verification", the notification dot. Never decorative.
- **The tri-colour gradient is saved for 2 moments:** the balance hero card and the main Go Live / Send button. Removing it from icons and menu items makes those two pop.
- Text uses three soft levels (bright white for figures, soft blue-grey for labels, dim for hints) for a premium, readable look.

## Sleek touches
- **Numbers first:** balances in large, tight, tabular figures; amounts in green-cyan (in) or soft white (out), never red unless failed.
- **Menu:** selected item becomes a subtle cobalt pill with a cyan left bar, not a full gradient block; icons in small tinted squares.
- **Cards:** rounder corners, a soft inner glow on hover, thin gradient hairline at the top of feature cards.
- **Service tiles:** icon on a tinted circle (colour by category) instead of the same gradient on every tile.
- **Badges:** small pill chips with a dot (Ready / Sandbox / Needs verification / Not active).
- **Motion:** quick 150ms fades and lifts; skeleton shimmer while loading instead of blank space.
- **Light mode** gets the same rules on a cool off-white base so it doesn't look washed out.

## Where it shows
Sidebar, top bar, dashboard hero, wallet panels, Services hub, pop-ups and dropdowns, transaction lists. Sign-in page keeps its flame theme.

## Technical details
- Retune shadcn tokens in `src/styles.css` (background, card, muted, border, ring) and add `--surface-1/2/3`, `--positive`, `--attention`, `--text-dim` tokens plus `@utility` classes (glass-card, nav-pill, chip, tint-cobalt/cyan/magenta, shimmer).
- Swap component classes to the new tokens in AppShell, DashboardPlus, CurrencyWallet, ServicesHub, Widgets; no logic changes.
- Check both themes with screenshots at desktop and phone width.
