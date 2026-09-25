# Compact Home update

Home now contains the logo/activity header, balance, inline 24-hour trading P&L, deposit/send arrows, a compact dividends row, watchlist and trending Stonk assets. The Home search bar, holdings preview, top positions and following feed were removed. Search remains a separate tab, per the user's clarification.

Asset cards show icon, ticker and 24-hour change on one row, with price below. Buttons, icon controls, segmented controls, chips and dialog actions use flat fills and uniform borders.

Send is an explicitly labeled UI preview. It permits asset/amount/recipient selection and a non-transactional preview sheet. It does not construct, sign or submit transactions. Deposit opens the existing address and QR screen.

## P&L percentage

The USD P&L retains the existing calculation: closing value minus opening value, net deposits and newly received dividends. Percentage return uses beginning capital plus cash flows weighted by their time within the observation period. Dividend receipts are included as added capital because their receipt value is excluded from trading P&L. Amount arithmetic stays in fixed-point integers; only the final display percentage is converted to a number.

This is an approximation based on the [Modified Dietz method](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/), not a claim of GIPS compliance. Incomplete history, invalid timestamps and nonpositive capital leave the percentage unavailable. UI never substitutes a token's price change for portfolio performance.

Performance reads now bound event timestamps by the ending observation, so events after a stored closing snapshot cannot enter that snapshot's return calculation.

## Validation

TypeScript and all 82 tests passed, including cash-flow timing, loss, deposit/dividend exclusion and unavailable-return cases. Android build succeeded in 1m 15s and was installed with `adb install -r`, retaining the session. Home, both arrow routes, amount/recipient entry and the preview review sheet were checked on the emulator. The preview used a dummy address and did not construct or submit a transaction. A 360 x 720 logical screen at 1.3 font scale retained legible cards and reachable controls; normal display settings were then restored. No React Native or Android runtime errors were observed.

Screenshots: E:/OMEN/android/logs/omen-compact-home.png, omen-compact-small.png, omen-send-preview.png and omen-send-review.png.

Physical Seeker testing and live transfers remain outside this UI revision.

## 2026-09-17

The 24-hour P&L line is shown only once there is a figure; an account whose history is still being checked shows nothing under the balance rather than "24h Pending". The dividends row reads `Dividends $0 (24h) >`: label, amount, the window in parentheses, chevron.

Later on 2026-09-17: the 24-hour P&L line under the balance is gone entirely (the user's call); trading P&L stays on the profile. The balance is followed directly by the deposit and withdraw arrows and the dividends row.

## 2026-09-17, later

Home is the user's own things: the watchlist first, then Positions (the same
rows as the profile's Positions tab). Best APY Stonks and Top Stonks are
hidden for now; Search still ranks everything.

## 2026-09-18

- Under the balance, one 28 px line: the day's trading P&L as "-$0.12 24h" (green, red or
  ice by sign), then "Dividends $0.10 24h" (no parentheses). Both pulse as
  skeletons while the portfolio loads.
- The centre tab is "Dividends" with the payout glyph, in place of the OMEN
  mark.

## No content shift (2026-09-18)

Every loading state is laid out at the loaded state's exact heights:

- Home: balance 52 px line; P&L 20 px and Dividends 28 px lines (skeleton
  boxes the same); one fixed 18 px note line under the balance card
  (empty most of the time); Watchlist keeps "View all" while the watchlist
  loads and its tiles, skeleton tiles and empty note all sit in a 76 px box
  (`TILE_HEIGHT`, the tile's own fixed height); Positions rows and their
  skeleton are both 64 px.
- Dividends tab: the amount row is 44 px; the Reinvest section renders a
  same-height skeleton row while it loads and a same-height note when the
  wallet has nothing to reinvest; the source chips row (36 px) appears only with more than one source.
- Activity rows are 60 px like their skeleton.
- Profile: stat label 16 px and figure 28 px lines match the skeleton.
- Token page: the About stat groups lay out every row with a placeholder
  figure while stats load.
- Revised the same day: under the balance, two small stat columns ("P&L
  24h" / "Dividends 24h", label over figure, the second opening the
  Dividends tab) in a 40 px box, skeletons the same; the note line is only
  drawn when there is a note; the block pulls the Watchlist up by 16 px.
- Stat labels are glyphs: a rising-line glyph + "24h" for P&L, the payout
  glyph + "24h" for dividends. The watchlist is fetched at app start rather
  than after the profile (retried once a new profile exists), so the Home
  tiles are not the last to arrive.
- 2026-09-18, evening: the figures under the balance are one 26 px line,
  glyph before number, no labels: unrealized P&L over the open positions
  (`portfolio.unrealizedUsd`: the index's own basis first, with a deposit
  costing what it was worth on arrival; Birdeye's per-token figure for
  positions the index has no basis for), then the day's dividends.
