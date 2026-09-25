# OMEN mobile UI revision, 2026-09-10

The signed-in app uses OMEN cobalt cards, Space Grotesk, a compact balance header, two secondary metrics, asset tiles, blue discovery cards and a pill navigation bar. Home shows watchlisted assets and live Stonk trends. Search retains Stonk, All assets and People with independent filters.

P&L, sorting, public-profile information and moderation confirmations share the OMEN bottom sheet. Filters use the same sheet with pinned Apply and Reset controls. The short profile wallet link and Receive explorer shortcut are removed. Remaining asset, social and transaction links use an in-app browser with HTTPS-only navigation.

The existing custom Expo Android build and Privy account architecture remain intact. No native dependency was added. Shared primitives live in src/components/market-ui.tsx, src/components/omen-sheet.tsx and src/theme.ts.

## Data

Stonk's official public API supplies a bounded top-100 catalog, quote/reward identity, published transfer tax and launch status. Explicit supported configuration rules exclude earlier non-quote-only reward launches. Database exclusions take precedence. Birdeye supplies live prices, charts and receipt prices; Helius supplies holdings and onchain detail checks. See MOBILE-DATA-SETUP.md.

## Validation

78 automated checks and TypeScript pass. Live catalog verification returned 100 unique assets with prices, price timestamps, images and liquidity. Public mobile API pagination returned 30, 30, 30 and 10 rows. Unknown fields remain nullable and unsupported legacy reward rows are rejected.

Home, Stonk and All assets discovery, ZCAT chart/rewards, P&L sheet and Filters sheet were inspected on the Android emulator. The build is installed over the existing app without resetting the user's session. Physical Seeker testing and publishing remain outside this change.
Final emulator checks: Home, Search and Profile were reviewed at 360dp with 130% text. Metrics stack when needed and tab labels stay intact. Restored physical density 420 and font scale 1.0. Final release preview is installed with the original session preserved. Live Stonk reward filters, standard tokens and KNOTS details passed. API process 33136 serves localhost:8787; emulator-5560 uses the E: runtime.
