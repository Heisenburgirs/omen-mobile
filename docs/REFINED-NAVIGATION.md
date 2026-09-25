# Refined Home and navigation

Home has no header row or activity icon. The balance starts near the top, with small transparent deposit and send icons. Their touch targets remain 44 logical pixels. Activity remains accessible through Profile. The icon-only navigation contains Home, Search, OMEN dividends, Agent and Profile. It sits in a floating dock capped at 344 logical pixels wide, with at least 24-pixel side margins and a 10-pixel bottom gap. The enclosed rounded outline has a straight top edge with no central bump. The logo and other icons are vertically aligned. The textured OMEN mark is 32 pixels and other icons are 20 pixels. Selection uses icon contrast, with no blue underline or shadow. Each icon retains its screen-reader label and selected state. The dock reserves its own layout space so scrollable content remains reachable above it.

OMEN opens the existing dividend history. Agent is an explicitly labeled coming-soon screen; it contains no working-looking agent controls. Send remains a UI preview only.

## Zero state

An unused wallet can display `24h $0 (0%)` and zero dividends before historical indexing has an opening snapshot. This fallback requires all fetched finalized holdings to be zero and empty finalized signature histories for the wallet and every currently owned token account. Provider failures, malformed results, any prior signature, or any positive holding leave the metric unknown. Zero current balance alone is insufficient. Incomplete Home metrics display `Pending` rather than `N/A`.

## Yield section

The section title is `Best APY Stonks`. The connected [Stonk public token endpoint](https://www.stonkfun.xyz/api/public/v1/tokens/HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR) supplies reward identity, current tax and market values, but no verified APY field in the inspected response. The section therefore shows live reward-asset previews with `APY ranking coming soon`. Its information sheet states that previews are sorted by volume and card percentages are 24-hour price changes. Actual APY ranking still requires a supported yield source and methodology; no APY is inferred from volume or token price change.

## Validation

TypeScript passed. All 85 tests passed, including unused-wallet, previously funded/emptied wallet, token-account history and provider-failure cases. The final Android build succeeded and was installed with the existing login preserved. All five tabs, deposit, activity and the Send preview were checked. The final display reads `24h $0 (0%)`. The 360 x 720 logical screen at 1.3 font scale retained usable navigation and scrollable cards. Normal display settings were restored and Home was left open. No React Native or Android runtime errors were observed. Physical Seeker validation remains separate.

Screenshots: `E:/OMEN/android/logs/omen-refined-home.png`, `omen-refined-agent.png`, `omen-refined-small.png` and `omen-refined-small-scrolled.png`.

## Floating dock follow-up

Removed the Home activity row and narrowed the dock, with smaller icons and a flatter central rise. TypeScript passed and the Android build succeeded in 1m 10s. Installed with the login retained. Verified the activity control is absent, all five tab targets remain comfortably above 44 pixels, and the smaller OMEN logo opens dividends. Home was left visible; no runtime errors were observed. Screenshot: `E:/OMEN/android/logs/omen-floating-dock.png`.

## Flat top edge

Removed the central bump entirely and aligned the OMEN mark with the other icons. TypeScript and the Android build passed. Installed and visually checked the flat floating dock in the emulator. Screenshot: `E:/OMEN/android/logs/omen-flat-dock.png`.

## 2026-09-17

The centre tab is labelled "Omen" (tab id `Omen`, screen-reader label unchanged: "OMEN dividends"). Every glyph, the 26-pixel mark included, sits in the same 24-pixel box, so the five labels share one baseline; previously the larger mark pushed its label lower than the others.
