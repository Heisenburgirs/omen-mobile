# Trading UX rules (2026-09-16)

Lessons adopted from a review of mobile trading app patterns (Apple HIG,
Material, NN/G thresholds, Coinbase Advanced and Robinhood order flows, the
SEC/FINRA gamification findings). The principle: TikTok-level responsiveness,
banking-level clarity, trading-terminal-level state accuracy. Nothing moves
under a thumb, no button is a mystery, no stale figure looks live.

## Rules the app now follows

| Rule | Where |
| --- | --- |
| Every bottom tab is labelled with one word | `src/components/omen-navigation.tsx` |
| A drag is never the only way to trade: the Sell and Buy labels on the slider are buttons that open an order review | `SlideToTrade` in `src/components/market-ui.tsx`, `reviewTrade` in `src/screens/market-shell.tsx` |
| The review states side, size, cost and fee, and its button says what it does ("Buy 42 MUL"), never "Continue" or "OK" | `reviewTrade` |
| The order form keeps its values when a trade fails; failures are a sheet, not a vanishing toast | `submitTrade` (unchanged behaviour, now a rule) |
| Live lists keep their order while values update; a pull to refresh or returning to the tab re-ranks them | `src/lib/stable-order.ts`, Home sections |
| A price or balance whose refresh failed, or is older than its threshold (45 s price, 60 s balance), is labelled delayed with the last update time | `src/lib/freshness.ts`, asset header, Home balance |
| The chart timeframe and line/candle style persist across token pages and app restarts | `src/lib/chart-prefs.ts` |
| Reduce Motion removes the tab slide; sheets and setup screens already respected it | `TabFade` |
| Tap targets are at least 44 pt: percent chips, chart periods, slider labels | asset page |
| Figures use tabular numerals so a changing digit does not shift the layout | `m.metric`, tile changes |
| Change and P&L always carry a sign and a percentage; colour only supports the sign | existing `pct`, `signedNumber` |
| Trades are only reported as done after on-chain confirmation | `waitForConfirmation` in `src/lib/chain-actions.ts` |

## Motion tokens

Frequent micro-interactions ≤ 200 ms, navigation ≤ 300 ms, nothing routine
above 400 ms. Current values: tab fade 200 ms, sheets 140–180 ms, setup fade
220 ms, skeleton pulse 750 ms (decorative loop, not an interaction).

## Still open

- Haptics on discrete events only (timeframe change, slider snap, order
  submitted, order filled) need `expo-haptics` and a native rebuild.
- Search results re-sort on every refresh; apply `useStableOrder` there once
  the paginated cursor logic is reworked to keep pages stable.
- User-configured price alerts as the only push notifications.
- Order review for the drag path is the drag itself; if a fast "one-tap"
  mode is ever added it must be opt-in in Settings.

## Balance and fee failures, 2026-09-17

- Typing more than the balance the side draws on (cash when buying, the
  position's value when selling) turns the slider into a locked
  "Insufficient balance"; the pre-submit toast covers sells as well.
- Without one-tap trading the user's own wallet pays the network fee, so a
  wallet holding USDC but no SOL fails preflight with Solana's "no record of
  a prior credit". The backend now maps that (and the other preflight
  phrasings) to plain sentences: "Your wallet has no SOL to pay the network
  fee. Turn on one-tap trading in Settings, or deposit a little SOL." One-tap
  is available only when the backend the build talks to has the Privy signer
  variables; the local dev server did not, so phone previews pointed at it
  always self-signed.

## Fee-free by default, 2026-09-17

No "Enable one-tap trading" prompt. The first trade or transfer attaches
OMEN's signer to the wallet silently (`ensureSponsorship` in
`src/lib/chain-actions.ts`), the swipe or the review button being the
confirmation, and Privy's fee payer covers the network fee. Settings keeps a
"Fee-free trading · on / off" row to revoke. When the backend has sponsorship
but the signer cannot be attached, the trade fails with a plain sentence
rather than falling back to a self-signed send the wallet cannot pay for.
Preview builds must be produced with Metro's transform cache cleared when the
API address changes: `EXPO_PUBLIC_*` values are inlined at transform time and
`%TEMP%\metro-cache` kept a stale one, shipping a "production" build that
still pointed at this PC.

## Instant fills, 2026-09-17

The swipe reuses the dock's live quote when it matches the size and is under
8 s old, the backend answers as soon as the send is accepted, the fill dialog
shows at once, and the cached portfolio is adjusted from the quote
(`applyOptimistic` in `src/lib/chain-actions.ts`) while confirmation is
watched in the background; a failure raises a toast and the balances are
refetched. Refetches after a trade are limited to portfolio, activity,
performance, dividends and the SOL balance.

Later the same day: a first-time buy adds the token row at once from the
quote and the page's asset, and trades stay "pending" in the app for up to
30 s: every refetch that still shows the pre-trade balance gets the trade
re-applied, so figures never flick back. The backend now reads balances at
"confirmed" rather than "finalized", which was the ten-second lag.

## Round of 2026-09-17 (evening)

- Buy / Sell pair is always laid out under the dock and fades with the
  card's own progress, so closing the fill card reveals the buttons instead
  of popping them in.
- Headline price and the stat beside it share a 40 px line box each with
  the text on its bottom edge, so their baselines meet at any price size;
  sub-cent moves show the percentage alone on the change line.
- Share and watchlist targets overlap their padding so the glyphs sit close.
- "Prices are delayed" no longer fires for placeholder data (no fetch time
  yet) or for one failed refresh of a young figure; only when the figure has
  aged past the limit (or a third of it after an error).
- A token page seeded from a holding spreads over `emptyAsset`, so a
  slimmer holding row cannot crash the page (the USDC / ZDOG "try again"
  screen).
- Dividends page hides "Load more" when there is nothing on the page.
- Connect X ends itself after 60 s with a toast; X is still off in the
  Privy dashboard (`twitter_oauth: false`), which is why it never returned.
- Deposit and Send headers drop the logo; deposit carries the caution
  "Other assets sent to this address may be lost."; the Send address field
  fills its row (Paste at the end), "To" at 15 px and the address at 13 px.

## Delayed-data strip removed (2026-09-17)

The "Prices / Balances are delayed" strip is gone: it showed during ordinary
refetches and read as a problem. `lib/freshness.ts` stays for callers that
want the state; nothing reports to the banner store now.
