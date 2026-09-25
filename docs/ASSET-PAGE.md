# Asset page

The token page is a single flat column. A compact header holds a plain back arrow, the token icon and symbol with its name beneath, then share and watchlist. Below it the price and 24h change sit on the left; on the right one headline figure cycles on tap through market cap, 24h volume and the estimated APR.

The chart offers 1h, 4h, 1d, 7d and All (up to 30 days of history) as flat text controls, with the candlestick toggle beside them. Nothing else about the market (liquidity, supply, public trades) is shown on this page.

"Your position" always appears as one compact card: the USD value, the token amount beneath it in smaller type, and the unrealized P&L in dollars on the right. With no holding it shows $0 and 0 tokens. Price caveats (estimated / stale) are not shown on this page.

A quick-trade dock floats over the bottom of the page, kept flat: Buy and Sell are plain words with a coloured underline on the active side, the amount is an underlined field followed by the unit, and 10% / 25% / 50% / Max are plain text setting a share of the available balance (SOL for buys, the token for sells). Confirmation is a slide-to-confirm control labelled simply "Slide" (drag the knob fully right); the unit label beside the amount has a fixed width so switching between SOL and the token never resizes the field so a stray tap cannot trade. Execution is not connected yet; completing the slide explains that nothing was submitted.

Reward stonks get a "Dividends" card stating the payout asset, transfer tax and estimated APR; it opens the dividends history. "About" is a plain section with the description, the copyable mint and outbound links.

## Review round, 2026-09-16

Changes from the user's first phone review of the token page:

- The star answers at once: the icon fills white, a toast names the token
  and what happened, and the server state takes over when it agrees.
- The headline change reads `▲ $0.0000123 (+5.66%) 1d`: an arrow, the dollar
  move and the percentage over the chart window that is selected below,
  computed from the window's first open to the live price
  (`periodChange` in `src/domain/market.ts`). No "value · label" pairs
  anywhere on the page; parentheses instead of dots.
- Market cap, 24 h volume and APR sit on a rotor under the price: the chosen
  figure in the middle at full strength, the other two faded at the sides and
  tappable to rotate. Figure first, description under it.
- The chart lost its baseline and the date footer; the timeframe chips and
  the line/candle toggle sit centred under it.
- The dock has Buy / Sell tabs (green / red underline). A percentage or typed
  amount always applies to the balance the tab names, the caption says which,
  and the slider is one direction in the side's colour: "Slide to buy MUL".
  Tapping the slider's label opens the order review instead.
- APR reads `62269% APR`, estimated ones `≈ 12% APR (estimated)`.
- The dividends panel is titled `{TICKER} dividends`, says `Pays USDC (1% tax)`,
  and opens the dividends screen filtered to that token with the same title.
- About: description, then Transactions 24h (trades, buys / sells, buy / sell
  volume, traders), Holders (count, top-10 share), Stats (market cap, volume,
  liquidity, supply, created) and the contract address to copy. The figures
  come from the backend's new `stats` field on the asset resource
  (Birdeye token overview + holder page, cached 60 s / 5 min).
- Content scrolling under the trade dock fades into the canvas
  (`expo-linear-gradient`); a true blur needs `expo-blur` and a native rebuild.

## Review round 2, 2026-09-16

- The headline stat is back beside the price, compact: figure over its name,
  market cap first (so the price has its scale), tap to cycle volume and APR.
- Young tokens fill the chart: the backend picks the finest bar that keeps the
  token's lifetime under ~200 bars for 7D / 30D / All (`candlePlanFor` in
  omen-landing `lib/mobile/market.ts`), so a two-day-old token charts
  15-minute bars instead of a dozen 4-hour ones. The line is continuous
  across bars with no trades.
- Scrubbing the chart puts that moment's price in the headline and the
  second line becomes how far it sits from the live price
  (`▼ $0.0000021 (-3.2%) vs now, Sep 15, 14:30`).
- Delayed prices or balances raise one strip at the top of the app,
  "Prices are delayed. Retrying…" (`StaleBanner`, fed by `useFreshness` with
  a source name); the inline labels are gone.
- The dock is closed by default: a Buy and a Sell button. Tapping one raises
  the panel (220 ms, none under Reduce Motion) with a close button, the side
  as its title, a small "Sell" / "Buy" link to switch, `$` flush against the
  amount, one row with the token quantity on the left and cash (or proceeds)
  on the right, no "≈" and no dots, and grey pill percentages. The slider is
  the side's colour.

## Review round 3, 2026-09-16

- Scrub line drops "vs now"; the stat beside the price uses the same two
  line heights as the price and change line (40 / 18) so both columns sit
  level.
- APR past a thousand is compact: `62.3K% APR` (`formatApr`).
- A finger on the chart owns the touch: the page no longer scrolls while
  scrubbing (`onResponderTerminationRequest` false on the chart).
- Long periods are hourly everywhere: 7D 168 bars, 30D 720 bars, All the
  token's whole life in hours (4-hour bars only past Birdeye's 5000 cap);
  finer-than-hourly bars remain for tokens younger than the window. The line
  chart is a rounded Catmull-Rom curve, not straight segments.
- "Available history" line removed; the dividends card reads "{TICKER}
  Dividends" with only the payout line; Explorer chip removed.
- About: group titles are headings; buy / sell figures are green / red pairs.
- Dock: Buy / Sell buttons and percent tiles at 10 px radius, darker tiles
  (#121212, chosen #222222), a barely-there card border, "Close" as text, a
  second tap on a chosen percentage clears it, one dollars-only line
  ("$5.00 available": cash when buying, the position's value when selling),
  the slider says "Enter an amount" and stays locked until there is one, then
  "Slide to buy" or "Slide to sell"; rise 160 ms, fall 110 ms.

## Dock header and chart scrubbing, 2026-09-17

The open dock no longer repeats "Buy TICKER" in its header: "Close" sits on
the left and the side switch ("Sell" while buying, "Buy" while selling) on the
right, and the slider itself names the action. While a finger is on the chart
the page's ScrollView is disabled (`scrollEnabled={!scrubbing}` via the
chart's `onScrubStart` / `onScrubEnd`), so a drag that drifts vertically reads
the chart instead of scrolling the screen; the responder-termination refusal
alone did not stop the native scroll on Android.

## Chart switching, 2026-09-16

Switching timeframe used to swap the chart for a placeholder of a different
size for about a second while the period's candles loaded. Now the query keeps
the previous timeframe's chart on screen (React Query `keepPreviousData`,
dimmed to 45%) until the new one arrives, every chart state is exactly the
chart's 220 px, and the other four timeframes are prefetched the moment a
token page opens (`usePrefetchMobile` in `src/lib/mobile-api.ts`), so a
switch reads from cache and is instant.

## Keyboard and the amount, 2026-09-17

The window is edge-to-edge (`edgeToEdgeEnabled`), so `adjustResize` no longer
shrinks it and `KeyboardAvoidingView` could not lift the absolutely placed
dock: the keyboard covered most of the slider. The dock now listens to
`keyboardDidShow` / `keyboardDidHide` and translates up by the keyboard's
height (140 ms, none under Reduce Motion), and the fade beneath it grows by
the same amount, so the slider is in reach the moment an amount is typed.
The dollar sign and the figure share one size (34) and the input hugs its
digits, left-aligned, so "$25" reads as one number.

## Fills without popups, 2026-09-17

After a swipe the slider keeps its track and reads "Buying ZINU…"; on
success the card shrinks to one line, "Bought 7,687 ZINU" or "Sold 7,687
ZINU for $0.55" with a tick, and closes itself 1.4 s later exactly as Close
would. No dialog. A failure stays in the card as a red line under the
slider. The height change uses LayoutAnimation (180 ms, none under Reduce
Motion).

Opening and closing move three things together with one ease-out curve:
the card (native driver), the keyboard lift, and the space the page keeps
free under the dock, which is now an animated spacer at the end of the
content (90 px closed, 300 px open) instead of a padding that jumped when the
card finished. So a page scrolled to the bottom slides up at the rate the
card comes down. Close dismisses the keyboard and animates the lift away at
once rather than waiting for the keyboard event; the old ease-in on close
was the "lag at first". The fade under the dock follows the same spacer.

## Dock header and errors, 2026-09-17 (later)

The header names what the card is doing, "Buy ZINU" or "Sell ZINU" in the
side's colour, with the switch glyph at the top-left to flip it and Close at
the right; the old header showed the *other* side as a link, which read as
the current mode. Sliders have no outline (buy/sell, trade, send). A failed
attempt shakes the slider, buzzes the phone, locks the knob for 200 ms and
springs it home; the reason goes to a toast, so nothing under the slider
moves. On a fill the free space and the fade shrink to 130 px with the
one-line card, and the fade is a touch lighter, so the line does not sit
under a tall dark band.

## Fill card, second pass (2026-09-17)

The swipe never bounces back to text: the card becomes the fill line the
moment the drag completes, "Bought 7,687 ZINU" with three dots rising and
falling while the send is out; when it lands, "for $1.00" fades in beside it
(220 ms) and the card closes 1.4 s later. A failure returns the form, shakes
the slider and raises a toast. The slider cross-fades between enabled and
disabled (160 ms). The switch glyph in the dock header has no background.
The delayed-data notice is a permanent 22 px strip under the status bar that
fades in and out, so it never moves the screen. "Pays X" on tiles is quiet
grey at 11 px; on the token page it is mist. Agent is hidden from the tab bar.
Settings has no fee-free switch: sponsorship is simply on.

## Opening a token (2026-09-17)

- The page opens with the token the tapped list already holds (any cached
  `mobile` list query with that mint seeds the `asset` query as placeholder
  data), so the header, price and chart frame render on the first frame and
  the request only refreshes them.
- Activity and holder figures for the About section come from their own
  `stats` request, refreshed every 60 s. The backend no longer holds the
  `asset` response for those two Birdeye calls (3–5 s when not cached).
- Sub-cent prices step the headline size down by length (34 → 28 → 24) instead
  of relying on shrink-to-fit; the headline stat keeps a fixed 116 px column.
- The fill card lays out its tick, line and "for $Y" tail from the first
  frame (the expected dollar figure, then the filled one) and only fades
  them in; the dots sit over the tail's slot. Nothing reflows mid-trade.

## Round of 2026-09-17 (late)

- The header row (back, token, share, watchlist) is rendered above the
  scroll view, so it stays put while the page scrolls. The back target
  overlaps the page edge (no dead space on the left); 10 px between the
  token image and its names.
- The headline price is sized to the measured width of its column (bold
  figures average 0.6 em a glyph), between 18 and 34 pt, so a long sub-cent
  price stays on one line beside the stat.
- The headline stat carries a small switch glyph under its figure to show it
  cycles (market cap, volume, APR).
- Closing the fill card takes 320 ms eased both ways; the Buy / Sell pair
  fades in under it at the same pace.
- "Pays X" is now a stacked-coins glyph followed by the payout symbol, in
  list tiles and the token page's dividends panel.
- Loading skeleton (2026-09-17): no header row of its own any more (the real
  header sits above the scroll view), so no second back button or title
  while loading; it starts at the price row and mirrors the page's heights.
- About (2026-09-18): a description over 260 characters shows four lines
  under a fade with "Read more" / "Show less".
- Dividends panel: a reward token's panel adds "You received $X over N
  payouts" (from `dividend-sources`); a payout token's page (ZEC) lists the
  tokens that pay dividends in it with tax and what each paid the wallet,
  each opening that token's dividends page, which now leads with the amount
  that token paid.
- Payout token card (2026-09-18, revised): "Dividends in ZEC" with up to
  five payer icons stacked and "+N", captioned "12 tokens pay ZEC"; it opens
  the Payers screen (route `payers`) listing every token that pays in it,
  with tax and what each paid the wallet, each opening that token's
  dividends page. List rows for payout tokens carry `payers`, so the card
  draws on the first frame; opened from a holding it shows a same-height
  loading card until the page's own data arrives.
- Dividends tab: the timeframe drop-down sits at the top right of the title
  row; the amount shows the window in words beside it; no footer note.
- The payout token card is a fixed 90 px (`PAYERS_CARD_HEIGHT`) loaded or
  loading, titled with the payout glyph and "in ZEC"; the icon stack row is
  28 px.
- Search (backend 7953e88): words typed also search tokens.xyz; its top
  matches (ZEC, SOL, TSLAx…) lead the Stonk matches.
- Dividends hub (2026-09-19): the `payers` route and the DRIP dropdowns are
  gone. The Dividends tab is insight and management in one: "Paying you"
  lists the holdings that pay dividends (what each paid, its rule in words,
  a Manage pill; the row opens the token page), then one "Paid in ZEC"
  group per payout token (what the wallet received in it, its rule, Manage,
  and the tokens that pay in it with what each paid, "Show all N"), then
  History. A reward token's card opens the page scoped to that source
  (`role: "source"`: "$X over N payouts" on one baseline, its payout, its
  history); a payout token's card opens it scoped to the payout
  (`role: "payout"`: total paid in it, "Paid by" list, its history).
- DRIP flow (route `drip`): "What should happen to ZEC dividends from
  ZCAT?" with four answers: keep as ZEC, buy back ZCAT (source rules only),
  convert to cash (USDC), buy another asset (a search by name or contract
  address). Save writes the `drip` / `drip-from` rule (`includeExisting`),
  attaching the drip signer the first time a rule is switched on.
- Cash (2026-09-19): USDC, USDT, PYUSD and USDG show as one "Cash" row, first
  in the portfolio, on a green banknote glyph.
- Dividends tab (2026-09-19, revised): no title; the window's dividends
  large with "N payouts · last 7d", a dividends chart (`dividend-series`,
  green line from a zero baseline; scrubbing shows a bucket's figure and
  date), windows 1h/4h/1d/7d/30d/All under it; then "Active" cards (one
  per holding that pays: $TICKER, what it paid, the payout token, the rule
  in a word — Keep / Buyback / Cash out / Swap for $X — and Manage); then
  History, five at a time behind "View more". The "Paid in" group only
  shows on a payout token's own page.
- DRIP flow (revised): ⓘ in the header explains DRIP; "$ZEC dividends from
  $ZCAT"; slim answer rows (Keep / Buyback / Cash out / Swap); the Swap
  search ("Search an asset...", Paste) appears unfocused; Save is docked
  under the page and the page pads by the keyboard's height. Fee 1 %.
