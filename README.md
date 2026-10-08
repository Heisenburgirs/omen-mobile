# OMEN

A Solana trading app for the phone: buy and sell tokens, tokenized stocks and
leveraged tokens, auto-compound the dividends that Stonk tokens and tokenized
stocks pay, and ask an on-device research agent what is moving and why.

Built for the [Solana Mobile](https://solanamobile.com) Seeker and any Android
phone. React Native with Expo SDK 57, Privy embedded wallets, and the OMEN
website as its one backend.

## What it does

- **Trade.** Every Stonk token, xStocks / Ondo / Backpack tokenized stocks,
  PreStocks and Hylo leveraged tokens, quoted and routed through DFlow. Trades
  are sponsored: no SOL needed, the user pays in USDC, and OMEN's session
  signer signs on a Privy policy so a tap is a trade.
- **Dividends.** Holdings that pay dividends are tracked per wallet; a DRIP
  rule turns each payout into more of the token, another token, or cash.
- **Agent.** A personal analyst that reads X, the chain and the market, with a
  memory on the phone. Replies and lookups are paid per call through
  [Ryvo](https://ryvo.network) (an x402 payment channel) or from free credits
  a Seeker owner gets at sign-up.
- **Cash.** Deposit by crypto or by card (Mercuryo), withdraw to any wallet,
  one Cash page with its own history.
- **Referrals.** Every account has a code; a friend who joins with it gets agent
  credits and a month of discounted fees, the referrer gets credits too.
- **SKR.** Seeker's token can be staked with Solana Mobile's Guardian from its
  token page.

## How it is put together

```
app/            Expo Router entry (one route; the app draws its own screens)
src/screens/    market-shell.tsx holds the tabs and every pushed screen
src/components/ UI pieces: lists, sheets, charts, buttons, the tab bar
src/agent/      the research agent: planner, tools, harness, memory, Ryvo client
src/lib/        session, queries (TanStack Query policy), chain actions, Privy facade
src/domain/     models and pure market/accounting helpers
modules/        omen-wallets: a small Expo module over Android's wallet discovery
plugins/        Expo config plugins (release signing, system bars)
tests/          node:test suites for the pure parts (agent, markup, queries)
scripts/        android.ps1 (dev builds), release.ps1 (store builds), serve-web.mjs
```

The app has no server of its own. Everything goes to the OMEN website
(`/api/mobile?resource=…`): market data, the portfolio, trades, dividends,
drip rules, the agent's free credits. Market data is served
stale-while-revalidate and kept in the database, and the app keeps its own
cache on the device, so screens open with the last figures and refresh behind
them. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The same code builds for the browser (`platforms: ["android", "web"]`); the
web build is served at [getomen.xyz/app](https://www.getomen.xyz/app).

## Run it

Requirements: Node 22+, Android Studio's SDK and an emulator or a phone, and a
Privy app with a mobile client.

```sh
npm ci
cp .env.example .env        # fill in the Privy ids; the API URL points at the backend
npm run android             # dev build on the emulator, with Metro
npm run android -- -Phone   # the same on a connected phone
npm run android -- -Phone -Preview -ApiUrl https://www.getomen.xyz
                            # a self-contained APK pointed at production
npm test                    # the unit suites
npm run typecheck
```

`scripts/android.ps1` is the Windows launcher (it configures the emulator,
`adb reverse` and the API tunnel); on another OS, `npx expo run:android` with
the same environment variables does the equivalent.

Release builds for the Play Console / dApp Store:

```sh
powershell -File scripts/release.ps1 -BuildNumber <n>
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the data layer, the agent, the backend contract
- [docs/TRADING-UX.md](docs/TRADING-UX.md): the rules the trade flow follows
- [docs/ONBOARDING.md](docs/ONBOARDING.md), [docs/LOADING.md](docs/LOADING.md)
- [brand.md](brand.md): colours and type
- [AGENTS.md](AGENTS.md): notes for coding agents working in this repo

## License

[MIT](LICENSE).
