import { postsForWriter } from "./external-tools";
import { ageText, dexRef, launchpadOf, postRefs, refsOf, tokenRef, type MessageRefs } from "./refs";
import { callsFrom, graphOf, graphOfHandle, recordCalls, symbolGraphSummary } from "./xgraph";
import { cashtagsIn } from "./scout";
import type { ToolContext, ToolResult } from "./registry";
import { xActivity, type WriterPost } from "./scout";
import { compact, withPeaks, type TokenRow } from "./tools";

// One named token, researched the way a trader would before touching it:
// where it trades (the main contract, not the copycats), what the chart
// says (figures, peak, holders), and above all what X says: who is
// talking, how big they are, whether the calls carry the contract address
// (the pump-group pattern), when it was first called, and whether the
// conversation is rising or fading. Each part has its own budget so the X
// read is never cut off by a long list of pairs.

type DexRow = Parameters<typeof dexRef>[0] & {
  twitter?: string | null;
  address?: string;
  name?: string;
  dex?: string;
  volume1h?: number;
  volume5m?: number;
  buys1h?: number;
  sells1h?: number;
  buys5m?: number;
  sells5m?: number;
};

const KOL_FOLLOWERS = 10_000;
const DAY = 1_440;
const SIX_HOURS = 360;

/** Accounts large enough that their call moves a small cap, largest first. */
export function kolsOf(posts: WriterPost[], min = KOL_FOLLOWERS) {
  const seen = new Map<string, { handle: string; followers: number; posts: number; url?: string; verified?: boolean; since?: number }>();
  for (const p of posts) {
    if ((p.followers ?? 0) < min) continue;
    const k = seen.get(p.by) ?? {
      handle: p.by,
      followers: p.followers ?? 0,
      posts: 0,
      ...(p.url ? { url: p.url } : {}),
      ...(p.verified ? { verified: true } : {}),
      ...(p.accountSince ? { since: p.accountSince } : {}),
    };
    k.posts += 1;
    seen.set(p.by, k);
  }
  return [...seen.values()].sort((a, b) => b.followers - a.followers).slice(0, 6);
}

/** Posts that carry the contract address: calls, not conversation. */
export function caCalls(posts: WriterPost[], mint: string | undefined) {
  if (!mint) return 0;
  return posts.filter((p) => p.text.includes(mint)).length;
}

/** When X first mentioned it, from the posts in hand. */
export function firstSeen(posts: WriterPost[]): string | undefined {
  const times = posts.map((p) => (p.at ? Date.parse(p.at) : NaN)).filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.min(...times)).toISOString() : undefined;
}

const dedupe = (posts: WriterPost[]) => {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = p.url ?? `${p.by}:${p.text.slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isTrade = (text: string) => /^\s*(buy|sell|swap)\b/i.test(text);

/** The dossier on one symbol: text for the writer, refs for the chat, what the X reads cost. */
export async function tokenDossier(ctx: ToolContext, symbol: string): Promise<{ text: string; refs: MessageRefs; costMicro: number }> {
  const [indexed, dexRows] = await Promise.all([
    ctx
      .fetch<{ data: TokenRow[] }>("tokens", { q: symbol, limit: "3" })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => [] as TokenRow[]),
    ctx
      .fetch<{ data: DexRow[] }>("dex", { q: symbol, limit: "4" })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => [] as DexRow[]),
  ]);
  const main = dexRows[0];
  const mint = main?.address;
  if (!main && !indexed.length) {
    return { text: `${symbol}: not found on any Solana DEX or in the index`, refs: refsOf([]), costMicro: 0 };
  }

  // The chart side: peak and holders for the main contract.
  const [peaked, stats] = await Promise.all([
    mint ? withPeaks(ctx.fetch, [{ mint }]) : Promise.resolve([] as { peak?: unknown }[]),
    mint ? ctx.fetch<{ data: unknown }>("stats", { mint }).then((r) => r.data).catch(() => null) : Promise.resolve(null),
  ]);
  const peak = peaked[0]?.peak;
  const handle = main?.twitter?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/)?.[1];

  // The X side: the conversation (top, last day) and the pulse (latest, last
  // six hours), for the cashtag and the contract address. Not for a trade
  // command, and not when the planner is already buying an X search.
  let costMicro = 0;
  let posts: WriterPost[] = [];
  if (ctx.paid && main && !isTrade(ctx.text) && !ctx.planned?.includes("x_search")) {
    ctx.status?.(`Checking X for $${symbol}`);
    const query = `($${symbol}${mint ? ` OR ${mint}` : ""}) -is:retweet`;
    for (const search of [
      { sort: "top", sinceMinutes: DAY },
      { sort: "latest", sinceMinutes: SIX_HOURS },
    ]) {
      try {
        const call = await ctx.paid("x.search", { query, ...search, pages: 1 });
        costMicro += call.costMicro ?? 0;
        posts.push(...(postsForWriter(call.data, 40) as WriterPost[]));
      } catch {
        // The chart stands on its own.
      }
    }
    posts = dedupe(posts);
  }
  const x = posts.length ? xActivity(posts) : null;
  const kols = kolsOf(posts);

  // The network: what was just read becomes calls; then who called this
  // token before and their records; then the two biggest accounts' own
  // feeds (one paid read each): what else they push and how often.
  let network: Record<string, unknown> | null = null;
  const dives: Record<string, unknown>[] = [];
  if (ctx.post && posts.length) {
    ctx.status?.(`Mapping who called $${symbol}`);
    await recordCalls(ctx, callsFrom(posts, symbol, mint, "search"));
    for (const k of kols.slice(0, 2)) {
      if (!ctx.paid) break;
      try {
        ctx.status?.(`Reading ${k.handle}'s feed`);
        const call = await ctx.paid("x.user_posts", { userName: k.handle.replace(/^@/, "") });
        costMicro += call.costMicro ?? 0;
        const feed = postsForWriter(call.data, 20) as WriterPost[];
        await recordCalls(ctx, callsFrom(feed, undefined, undefined, "profile"));
        const tickers = new Map<string, number>();
        for (const p of feed) for (const s of cashtagsIn(p.text)) tickers.set(s, (tickers.get(s) ?? 0) + 1);
        const record = await graphOfHandle(ctx, k.handle);
        dives.push({
          handle: k.handle,
          followers: k.followers,
          postsRead: feed.length,
          tickersInFeed: [...tickers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => `$${s} x${n}`),
          ...(record ? { callsPerDay: record.callsPerDay, record: record.account, pastCalls: record.tokens.slice(0, 6) } : {}),
        });
      } catch {
        // The dive is a bonus.
      }
    }
    network = symbolGraphSummary(await graphOf(ctx, symbol));
  }
  const lead = [...posts].sort((a, b) => (b.likes ?? 0) + 2 * (b.replies ?? 0) - ((a.likes ?? 0) + 2 * (a.replies ?? 0))).slice(0, 5);

  const sections = [
    `${symbol}:`,
    main
      ? `main contract (the one with the volume; others are copycats): ${compact(
          {
            mint,
            name: main.name,
            priceUsd: main.priceUsd,
            marketCap: main.marketCap ?? main.fdv,
            liquidity: main.liquidityUsd,
            volume24h: main.volume24h,
            change24h: main.change24h,
            age: ageText(main.ageHours),
            launchpad: launchpadOf(main.address, main.dex, indexed.some((r) => r.mint === main.address && (r as { stonk?: unknown }).stonk != null)) ?? "unknown",
            // Flow: what moves the price right now. A cap of 150k on $1k a
            // minute moves on single buys.
            flow: {
              volume5m: main.volume5m ?? null,
              volume1h: main.volume1h ?? null,
              perMinute: main.volume1h != null ? Math.round(main.volume1h / 60) : null,
              buys5m: main.buys5m ?? null,
              sells5m: main.sells5m ?? null,
              buys1h: main.buys1h ?? null,
              sells1h: main.sells1h ?? null,
            },
            ...(handle ? { xAccount: "@" + handle } : {}),
            ...(peak ? { peak } : {}),
          },
          900,
        )}`
      : "no Solana DEX pair found",
    dexRows.length > 1 ? `copycats, ignore unless asked: ${compact(dexRows.slice(1, 4).map((r) => ({ mint: r.address, volume24h: r.volume24h })), 400)}` : "",
    stats ? `holders and activity: ${compact(stats, 700)}` : "",
    indexed.length
      ? `index identity and risk (figures here can lag; the main contract's are current): ${compact(
          indexed.slice(0, 1).map((r) => ({ symbol: r.symbol, name: r.name, mint: r.mint, issuer: r.issuer, trustTier: r.trustTier, ...("risk" in r ? { risk: (r as { risk?: unknown }).risk } : {}) })),
          600,
        )}`
      : "",
    x
      ? `X, last day: ${compact(
          {
            xScore: x.score,
            posts: x.posts,
            accounts: x.accounts,
            recentShare6h: x.recentShare,
            weakAccountShare: x.weakShare,
            engagement: x.engagement,
            threads: x.threads,
            firstSeen: firstSeen(posts),
            callsCarryingTheCA: caCalls(posts, mint),
            bigAccounts: kols,
            topAccounts: x.topAccounts,
          },
          1_600,
        )}`
      : ctx.paid
        ? "X: nothing found for the cashtag or the contract in the last day"
        : "X: not checked (agent unfunded)",
    network ? `network (who called it before, their records): ${compact(network, 1_400)}` : "",
    dives.length ? `profile dives (what the biggest callers push): ${compact(dives, 1_400)}` : "",
    lead.length
      ? `lead posts: ${compact(
          lead.map((p) => ({ by: p.by, followers: p.followers, verified: p.verified ?? false, accountSince: p.accountSince, at: p.at, likes: p.likes, replies: p.replies, text: p.text.slice(0, 220), url: p.url })),
          2_400,
        )}`
      : "",
  ].filter(Boolean);

  // The main contract leads the refs so the card and Copy CA show it, not a copycat.
  const refs = refsOf(
    [...(main ? [{ ...dexRef(main)!, ...(peak ? { peak: peak as never } : {}) }] : []), ...dexRows.slice(1).map(dexRef), ...indexed.map(tokenRef)],
    postRefs([...(handle ? [{ by: "@" + handle, url: `https://x.com/${handle}` }] : []), ...lead, ...posts.slice(0, 20)]),
  );
  return { text: sections.join("\n"), refs, costMicro };
}

/** The tool result for several symbols. */
export async function dossiers(ctx: ToolContext, symbols: string[]): Promise<ToolResult> {
  const out: { text: string; refs: MessageRefs; costMicro: number }[] = [];
  for (const s of symbols) out.push(await tokenDossier(ctx, s));
  const refs = out.reduce<MessageRefs>((acc, d) => ({ tokens: [...acc.tokens, ...d.refs.tokens], posts: [...acc.posts, ...d.refs.posts] }), { tokens: [], posts: [] });
  return { data: out.map((d) => d.text).join("\n\n"), args: { symbols: symbols.join(",") }, refs, costMicro: out.reduce((s, d) => s + d.costMicro, 0) };
}
