# Onboarding (2026-09-18)

Four full-screen pages a swipe apart (route `onboarding`, no chrome):
Trade anything (spot trading), Tokens that pay you (dividends and DRIP),
Discover alpha (data for a thesis; the agent noted as coming), and the
referral code, optional. Skip jumps to the last page; Start (or "Redeem and
start" with a code) redeems the code through `POST referral`, marks the
profile through `POST onboarding`, refetches the profile and returns.

The shell opens the flow once per session when the profile's `onboardedAt`
is null. Home has a "Replay onboarding" link at its foot while the flow is
being tuned. Settings shows "Fee-free spot trading until <date>" during a
referral month; quotes from the server carry no fee then, so the trade
dock's fee note disappears on its own.

## Revised the same day

Titles and copy as the founder set them (Trade anything / Get dividends /
Discover narratives, "Coming soon" tag / Have a referral?). White discs with
the glyph in ink; a white rectangular button in the trade buttons' shape;
no Skip (everyone goes through; leaving part-way starts over since the
profile is marked only at the end). Pages are top-aligned; the keyboard's
height pads the screen's bottom so the button rises with it, and the last
page folds its glyph away while typing so the field and button stay clear.
