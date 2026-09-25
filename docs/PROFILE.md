# Profile

The profile page follows the flat style of the rest of the app. A borderless header holds the avatar, display name and handle; on your own profile the info and settings icons sit at the right as quiet icons, on another trader it is a Follow / Following pill. The handle and follower counts are not shown; bio, the X link and "Edit profile" are plain text on one line. An empty positions list is centred text with no card.

The performance period (24h, 7d, 30d, All) is a flat text control. Trading P&L and Dividends are two unboxed figures in Inter, P&L coloured by sign. Positions / Activity / Dividends are underlined text tabs rather than a pill switcher; the lists beneath are the shared row components. Report and Block on another trader's profile are muted text links at the end.

## Settings

Settings is a flat list: a Hide balances row with a small switch, then Sign-in methods (Google and X, each a row with Connected / Connect +; wallets cannot be connected from Settings), a "More" group with OMEN on X, Terms of Service and Privacy Policy, then Sign out and Request account deletion as text rows, and an "Omen © All rights reserved" footer. Dialogs share the same treatment: near-black sheet with a card border, small heading, quiet close, and plain text actions.

## Deposit and Send

Both screens use the shared quiet header with the OMEN mark at the top right. Deposit shows one line ("Send any Solana asset to this address."), a QR code as wide as the address card (fixed QR version 4 so the piece size follows the card width), one card with the shortened address and a copy glyph (tapping either copies), and "Previous deposits": the last five received transfers as flat rows with icon, name, ticker and date, and the token amount plus USD value on the right. Send is an amount-first screen: a "To" row with the address field and Paste, a large amount with its rough USD value beneath, an asset pill showing the available balance with a swap glyph that opens the asset sheet (any held asset, plus SOL), a 25% / 50% / 75% / Max row, a calculator keypad (one decimal point, no leading zeros), and a slide-to-confirm. Balances format to at most six significant digits, never trailing zeros. Transfers are not connected yet; completing the slide explains that nothing was sent.

## Dividends

The Dividends tab is incoming payout history. Under the title: a flat period control (24h, 7d, 30d, All), a "Received" figure (the period's dividend total in Inter, from the performance endpoint), then, when more than one payout asset exists, flat text filters, and the payouts as flat rows: payout asset icon and name, date and time, and the token amount in green on the right. No USD value at receipt is shown. Older pages load behind a "Load more" link; an empty period is centred text.

## Edit profile and activity, 2026-09-17

Edit profile follows the flat profile screens: the avatar as it will appear (72 px, the chosen tone, the first letter of the name) above four tone swatches (the selected one ringed in ice), then underlined fields with a quiet label and a character count (Display name 40, Username 24, Bio 160, X profile), the public-profile note, and a single Save that stays disabled until something changed and validates (username `a-z0-9_`, 3 to 24, X links only). Avatar tones (`avatarTones` in `market-ui.tsx`) now colour the profile header and people rows as well.

Activity rows name deposits and withdrawals as such ("Deposit", "Withdrawal") with the deposit and withdraw tray glyphs; they come from the same wallet index as trades and dividends.

## Deposit and Send, 2026-09-17

Deposit says "Send USDC to this address." (the wallet accepts any Solana
asset, but the product is a USDC balance and everything else is tokens), and
the QR is sized from the window width before the first frame, so it no
longer appears a beat after the page and shifts the content. The Send
slider's label is "Send"; sliders have no outline.

## Dividends and edit profile (2026-09-17, late)

- The dividends page draws its own header row with the timeframe chips
  (24h, 7d, 30d, All) on one line: as the Omen tab, the page title; as a
  pushed route, back and a heading (the route chrome leaves the screen to
  itself). The figure is labelled by the window ("All time",
  "Last 7d") instead of "Received".
- Edit profile uses the app's row pattern: the field name leads at 15 px,
  the value fills the row, one rule under each, the count appearing at the
  row's end only once the field is 80% full. Avatar at 80 px with the tone
  swatches under it.
- Send does not scroll; its content fits the screen.
- The navigation's OMEN mark is back at 32 px.

## X as the app identity (2026-09-17)

- With X linked in Settings, the profile's name, username and picture are
  X's (the backend syncs them on every `me` request); Edit profile shows
  them fixed with the X mark and edits only the bio. The note explains that
  unlinking X in Settings frees them.
- Settings offers "Unlink" on the X row (`useUnlinkOAuth`); Privy refuses
  when X is the only sign-in. Linking or unlinking invalidates the app's
  queries so the profile follows at once.
- The profile header shows the X picture when there is one, the X mark
  beside the name (tap: "X verified") and the @username under it.
- Edit profile rows have no rules between them; the only note is "Your
  profile and OMEN wallet activity are public."
- No banner: Privy does not expose X's banner image.
- Settings, after linking or unlinking X: Privy's user refresh has been seen
  to never settle once the browser hands back, which left the row spinning
  until the app was reopened. The refresh now gets 4 s, and the row always
  clears its spinner; the linked state comes from the provider's user.
- The profile skeleton mirrors the profile row for row (avatar with name
  and handle plus the two round targets, the link line, the timeframe chips,
  the two stats, the section tabs, rows) at the same heights.
- The own-profile query (`me`) refetches every minute and on pull to refresh
  on the Profile tab. It used to load once per app start, so a picture or
  name synced on the server after that never appeared until the app was
  reopened (the X picture report of 2026-09-17). A picture that fails to
  load gives way to the initial.
- Dividends timeframe sits beside the amount as a drop-down menu
  (`Dropdown` in market-ui: the chosen window with a caret; a tap opens a
  small card under it, the chosen one marked). The amount row has a fixed
  44 px height and keeps the last figure, dimmed, while a new window loads,
  so nothing below it moves when the span changes.
- Navigation: the OMEN mark is 26 px at 0.85 (selected) / 0.55 opacity, so it
  sits with the line icons instead of shining over them.
- Activity rows show the token's image from the row itself (`image` on the
  activity payload), so a payout in a token the wallet does not hold (ZEC
  from ZCAT) has its picture. The dividends list asks the backend for
  dividends alone (`kind=dividend`), so "load more" appears only when there
  are more dividends.
- Asset icons: a token image the bitmap Image cannot draw (SVG, as Zcash's
  is) is drawn again through `SvgCssUri` (the CSS-aware loader, since token
  SVGs colour shapes through a <style> block); only when that fails too does the
  initial show.

## Reinvest dividends (2026-09-18, revised the same day)

- Only the payout tokens the backend supports are listed (`drip-config`:
  ZEC, xSOL, XBTC, STONK, NEAR, WBTC). Under each payout row, one line per
  holding that pays it with its own drop-down: "Same as ZEC" (follows the
  rule above) or "Into X" (a `drip-from` rule that overrides it).
- Switching a rule on attaches the drip signer (`ensureDripSigner`), a
  separate swaps-only session signer; the trading signer comes along if it
  is missing.
- Dividend rows read "From ZCAT · Sep 17 · 10:41 PM"; the token page's
  dividends and the Omen tab's chips filter by source.
- The footer states the supported tokens and the 2 % fee.

## Reinvest dividends (2026-09-18, first cut)

- The Omen tab lists, under the amount, each token the wallet is paid
  dividends in (from the holdings' payout token, plus any existing rule) with
  a drop-down: Off, or "Into X". The tokens that pay it come first, then the
  rest of the wallet, then USDC.
- Choosing a target attaches the session signer if needed and saves a `drip`
  strategy (`includeExisting: true`, so dividends already in the wallet are
  reinvested too). The second line shows what the server last did: last
  reinvested date, a wait reason, or the threshold.
- The server does the swapping (see the backend's docs/DRIP.md); the swap
  appears in activity as a trade.
- 2026-09-18, later: the section is titled "DRIP". Source chips on the
  Dividends tab come from attributed sources only (an unattributed payout
  is never a chip); the backend now also attributes a payout to the one
  reward token the wallet holds that pays in that token when the index has
  no answer. Dates and "you received" lines use the numeric face (Inter),
  whose zero reads plainly. Deposit history on Receive is paged from the
  server (`activity` with `kind=deposit`), more loading as the list nears
  its end.
