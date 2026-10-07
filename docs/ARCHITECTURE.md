# Architecture

## One backend

The app talks only to the OMEN website (Next.js on Vercel). One route,
`/api/mobile?resource=<name>`, serves every read and action; the resource
name picks the handler (`lib/mobile/handler.ts` in the website repo). Every
request carries the user's Privy session token; there are no public
resources. The website owns the keys (Birdeye, Helius, DFlow, Supabase,
Privy, Ryvo) and the app ships none.

Resources the app uses: `assets`, `asset`, `stats`, `candles`, `peaks`,
`portfolio`, `wallets`, `watchlist`, `activity`, `dividends`,
`dividend-sources`, `dividend-series`, `strategies`, `drip-config`, `quote`,
`swap`, `transfer`, `skr-stake`, `onramp`, `me`, `profile`, `people`,
`referral`, `agent-credits`, `agent-run`, `agent-wallet`.

## Data on the phone

`src/lib/queries.ts` is the one table that says, per resource, how often it
polls while on screen, how long an answer counts as fresh, whether the last
answer stays up while a changed request loads, and whether it is saved on
the device. `src/lib/mobile-api.ts` reads it:

- `useMobile` for one answer, `useMobilePages` for a cursor-paged list
  (Search, histories), `useMobileMutation` for an action with an optimistic
  write and rollback, `useMobileAction` for a plain action.
- Keys are `["mobile", userId, resource, params]`. `TOUCHES` says which
  resources an action invalidates, so a star does not refetch the portfolio.
- The cache persists through SQLite (localStorage on the web) for 24 hours,
  busted by app version and `CACHE_SCHEMA`; the next launch opens with the
  last session's figures and refreshes them behind.
- The Search tab's first list is requested the moment the session is known,
  before Home draws.

On the server, lists, token figures and stats are served
stale-while-revalidate (`lib/mobile/swr.ts`) and stored in
`omen_mobile.cache`, so a fresh instance answers from the last computed
result; a warming pass refreshes the lists every five minutes.

## Trading

`src/lib/chain-actions.ts`: a quote (`resource=quote`), then `swap` or
`transfer` with `execute: true`. The server builds the transaction, OMEN's
session signer signs it under a Privy policy, Privy's sponsor pays the
network fee, and rent for any new token account is charged to the user in
USDC inside the same transaction. The app shows the fill optimistically and
refetches the portfolio, activity and balance when the chain confirms.

## Dividends

A DRIP rule (`resource=strategies`) names a payout token and what its
dividends become. The website's executor runs rules every minute from its
own payout index, swapping through a separate swaps-only signer. The token
page shows what a token pays, its rule, and its dividend history.

## The agent

`src/agent/harness.ts` runs one turn:

1. **Plan.** Small talk and balance questions are routed by keyword; a request
   for plays goes to the scout; anything else is planned by a cheap model
   over the tool catalogue (`registry.ts`), with learned presets short-cutting
   repeats.
2. **Fetch.** The planned tools run in parallel (portfolio, token dossiers,
   X searches, web, chain), each with a status line the user sees.
3. **Second look.** For a judgement, a cheap model reads the question against
   what came back and names what is still missing; those lookups run and it
   looks again, up to two rounds under a spend cap (`followup.ts`).
4. **Write.** The tier's model writes a short reply; refs (tokens, X
   accounts, posts) make tickers and handles tappable (`refs.ts`, `markup.ts`).
5. **Learn.** Durable preferences go to the on-device memory; the rest does not.

Paid calls go through Ryvo: the agent's own wallet funds a payment channel,
and each reply or lookup is a signed voucher. A user with free credits runs
the same calls through the website instead (`resource=agent-run`), which pays
Ryvo and debits the credit ledger.

## Web

Metro resolves `.web.tsx` twins for the few modules that differ in a browser
(Privy, storage, the web view). Twins must share the extension of the native
file. The export is served under `/app` on the website's origin.
