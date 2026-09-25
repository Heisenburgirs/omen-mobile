# OMEN mobile data setup

The Android UI contains Home, Search, Profile, asset details, chart controls, receive QR, watchlists, activity, dividend history, profile editing, follows, block/report, and account connections. It does not send trades or route funds.

## One backend (2026-09-12)
The app no longer runs its own API. Every request goes to the OMEN website, which serves both products from one codebase (omen-landing, Next.js on Vercel):

- `GET|POST|PATCH|DELETE /api/mobile?resource=...` — the mobile API (lib/mobile/handler.ts in the website repo; the former api/mobile.ts).
- `GET /api/balance?address=...` — SOL balance for the wallet screen (lib/mobile/balance-service.ts).
- `GET /api/mobile/sync` — one indexer pass plus a Stonk token-index refresh, for the site's cron (CRON_SECRET bearer). `?full=1` opens a resumable full pass over every feed page; the cursor is stored in `omen_mobile.sync_state` and each call advances it within its time budget, so the daily Vercel cron plus the two-minute pg_cron job (`omen-mobile-sync`) complete the ~430 pages within the hour even under Vercel's 60-second route limit.

Market data comes from the website's Birdeye adapter (lib/stonk/birdeye.ts) through lib/mobile/market.ts, so the site and the app share one key, one budget and one Postgres-backed cache: quotes via /defi/multi_price (10-second memory cache), candles via /defi/v3/ohlcv (1H: 1m×60, 4H: 5m×48, 24H: 15m×96, 7D: 1H×168, 30D/All: 4H×180; cached 30s–10min by period), and receipt prices via /defi/historical_price_unix (cached one hour). Helius still provides holdings, metadata and transfer fees; Supabase (same project, omen_mobile schema) still holds social data, indexes and the Stonk token index; Privy tokens are verified server-side with the mobile app's PRIVY_APP_ID.

Server-only configuration therefore lives in the website's environment (Vercel and omen-landing/.env.local): BIRDEYE_API_KEY, HELIUS_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), PRIVY_APP_ID, PRIVY_APP_SECRET, SOLANA_NETWORK, CRON_SECRET. The mobile .env keeps only EXPO_PUBLIC_ values. The SQL migrations moved to omen-landing/supabase/mobile/. Development: run `npm run dev` in omen-landing (port 3100); scripts/android.ps1 forwards that port into the emulator and warns when nothing listens on it. Production builds point EXPO_PUBLIC_API_URL at https://www.getomen.xyz.

Yield (2026-09-13): the app shows the website's rates. `asset.dividends` carries the 3-day trailing APR on eligible holdings (basis `eligible`, or `fdv` until the sync has inspected the token), the daily-reinvestment APY after the transfer tax and assumed costs, `young` when the token is younger than the window, and the run-rate estimate. `stonkApr` prefers the measured rate with no market-cap floor and falls back to the volume model only when the index has nothing; `loopApy` is what the Best APY tiles show. Strategies per holding (`resource=strategies`, kind `loop`) decide whether APY applies to a position.

Trading and sending (2026-09-13): the trade dock quotes through the backend (`resource=quote`, refreshed every 8 s while an amount is entered) and shows the quoted output; sliding runs quote → `swap` (unsigned transaction from DFlow with the 0.5% fee) → sign with the Privy embedded wallet (`src/lib/signer.ts`, web3.js `VersionedTransaction`) → `submit` → poll `transaction` until confirmed (`src/lib/chain-actions.ts`). Send uses the same path with `transfer`. No RPC endpoint or key is in the app.

One-tap trading (2026-09-14): on the first trade or send the app asks the user to enable one-tap trading, which adds OMEN's session signer to their embedded wallet (`useSigners().addSigners`, signer id and policy ids come from `resource=signer`). From then on `src/lib/chain-actions.ts` sends `execute: true` and the backend signs and sends with Privy paying the fee; declining, or a backend without the signer configured, falls back to signing in the app. Settings shows "One-tap trading · on/off" and can revoke the signer.

Release builds: `scripts/release.ps1 -BuildNumber N` produces `E:OMENeleases<version>-<N>omen-release.apk` (sideload) and `.aab` (Play Console) for package `com.omen.myapp`, signed with the upload key in `E:OMENkeys` through `plugins/with-release-signing.js`, with `EXPO_PUBLIC_API_URL` set to the production site. The Privy dashboard must allow the `com.omen.myapp` identifier and the `omen` scheme for sign-in to work on that build.

The notes below predate the merge and describe the same logic where it now lives in the website repo.

## Configure social data
1. Run supabase/migrations/202609100001_omen_mobile.sql in the Supabase SQL Editor.
2. Add omen_mobile to the project's exposed Data API schemas. The migration grants access only to service_role; do not add anon or authenticated grants.
3. In the mobile project's .env set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PRIVY_APP_SECRET. These are server-only.
4. Restart the local API, then retry Profile in the emulator. The API verifies the primary embedded Solana address against Privy, not client-supplied wallet data.
5. The local API scans registered wallets and their owned token accounts every minute, ten profiles per batch. Unfinished histories remain incomplete. For a one-off pass run npm run index:once.

## Market data: Birdeye and OMEN's Stonk index
BIRDEYE_API_KEY enables live market data. Keep it server-only, without an EXPO_PUBLIC_ prefix. The adapter in server/mobile/birdeye.ts sends it only to https://public-api.birdeye.so in the X-API-KEY header with x-chain: solana. Birdeye has been removed entirely; there is no fallback provider. Restart the API after changing the key, then run `node --env-file=.env --import tsx scripts/check-birdeye.ts` to confirm quotes, candles and a historical price.

Birdeye supplies: live quotes with update timestamps, 24h change and liquidity (/defi/multi_price, 100 mints per request, 10-second cache), OHLCV candles for the chart periods 1h/4h/1d/7d/All (/defi/ohlcv with 1m/5m/15m/1H/4H bars, all under the 1000-record cap), and the price at a dividend receipt (/defi/history_price, 1-minute samples, latest sample at or before the receipt within five minutes). Requests share a cache, coalesce identical calls and run at most four at a time; 429 and 401/403 surface as busy / needs configuration, and success=false bodies are never cached.

OMEN keeps its own index of every token launched on Stonk in omen_mobile.stonk_tokens (migration 202609120001_stonk_tokens.sql). The API's background sync fills it from the public feed: every page once on first run against an empty table and daily after that (about 430 pages at 100 rows with a short pause between pages), and the three most active plus two newest pages every two minutes. Each row stores the mint, pool, quote asset, transfer tax, status, launch times, a market snapshot (feed volume and market cap) and the raw feed row. Listings read the table ordered by feed volume (top 300 rows, then the same supported-configuration filter and top-100 cap as before); the feed itself is only a cold-start fallback when the table is empty. Token detail and Stonk classification for any mint also read the table, so a launch outside the active list still resolves without calling the feed. Database exclusions in stonk_registry still win.

Helius continues to provide holdings, onchain transfer fees and metadata. When Birdeye is unavailable, feed prices remain explicitly estimated and cannot qualify for ranking.

## Accounting and indexing
- Exact integer token units and fixed-point USD arithmetic; display formatting is separate.
- Pooled Stonk receipts require decoded Token/System transfers from the observed distributor. Payout source token stays null unless independently attributed.
- Net changes through supported DEX programs can produce simple two-asset swap events. Other complex transactions remain unknown and cannot establish cost basis.
- Unknown deposits do not become zero-cost gains. Partial sales reduce average-cost lots proportionally. Dividend units are excluded from weekly ranked gains.
- P&L uses complete marked snapshots and valued net external cash flows, excluding dividends. Fees already reduce closing equity and are not subtracted twice. All profile performance is since tracking began, not a claim of pre-index lifetime returns.
- Position ranking requires fresh verified prices, sufficient liquidity and reconciled complete lots. Without verified liquidity, no row qualifies.
- Indexing is idempotent by wallet + transaction/mint event id. Supabase-backed activity cursors include timestamp and id to retain same-block receipts.
- The fallback without database history displays recent owner and token-account signatures only, labeled partial.

## Operations and remaining gates
Service-role APIs enforce actor ownership and public response projection. No user email, Privy id or external-wallet links are returned in profiles. Client users have no direct grants in the mobile schema.

Review reports through Supabase's table editor; set profiles.moderated=true to hide a reported profile. Account deletion creates a request and hides the public profile immediately; it does not destroy signing keys or move funds. Resolve requests through a documented wallet-access-preserving deletion process before public launch.

Deploying a serverless API alone does not run the local interval worker. Host the worker as a persistent process or invoke index:once from production scheduling before launch. No production deployment or automation was created in this milestone.

Supabase schema accessibility has been verified. External validation still required: authenticated multi-user end-to-end checks; complete market coverage; production moderation/deletion operations; physical Seeker testing. Publishing, buys/sells and routing remain disabled.

Final validation: 70 tests and TypeScript pass. The Android release preview built with the E: SDK and was installed without clearing app data. ZCAT live line/candlestick charts, Stonk discovery, and existing session restoration were checked on the emulator. Physical-device and broader deployment coverage remain open gates.


Top-100 revision validation: 78 automated checks pass, including configuration exclusions, explicit database overrides, no fabricated circulating cap, pagination fill/caching, and price formatting. Live app API returned 100 assets across four pages. Official documentation: https://www.stonkfun.xyz/api/public/v1/openapi.json .

## Storage resilience (2026-09-11)
Supabase became intermittently unreachable from the local API process while fresh Node processes and curl succeeded, which pointed at a wedged keep-alive socket in the global fetch pool. The storage client now opens one fresh HTTPS connection per request with a 10-second timeout (server/mobile/store.ts). Registry overrides keep the last good rows when a read fails, space retries a minute apart, and only when the table has never been readable in the process does public discovery classify Stonk assets on its own (with a logged warning) so an outage no longer blanks the Search list.
