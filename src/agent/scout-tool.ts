import { postsForWriter } from "./external-tools";
import { chainHint } from "./extract";
import { dexRef, postRefs, refsOf, type TokenRef } from "./refs";
import type { Tool, ToolContext } from "./registry";
import { candidatesFrom, leadPost, postIdOf, xActivity, type WriterPost } from "./scout";
import { compact, marketScan, mentionedSymbols, peaksOf } from "./tools";

// The scout: a research question answered the way a trader would work it.
// Search X for what people just started talking about, take the tickers
// several accounts name, dig into each one's conversation (who, how many,
// how engaged, how recent, how many of them are bots), read the replies
// under the lead post for the two liveliest, then pull each one's chart
// figures and peak. The writer ranks from that, not from what the index
// already lists as top volume, which has usually run.

const SIX_HOURS = 360;
const DAY = 1_440;

type Dex = Parameters<typeof dexRef>[0] & { twitter?: string | null; address?: string; chain?: string };

/** The discovery searches: launch chatter now, and gem talk today. */
const DISCOVERY = [
  { query: '(solana OR "$SOL" OR pumpfun OR "pump.fun" OR launchlab OR bonk OR stonk) (CA OR launched OR launch OR sending OR aped OR "100x" OR gem OR runner OR cooking) -is:retweet min_faves:3', sort: "latest", sinceMinutes: SIX_HOURS, pages: 2 },
  { query: '(solana OR sol) (gem OR runner OR "next 100x" OR "low cap" OR microcap OR "early") -is:retweet min_faves:10', sort: "top", sinceMinutes: DAY, pages: 1 },
] as const;

async function paid(ctx: ToolContext, tool: string, input: Record<string, unknown>) {
  if (!ctx.paid) throw new Error("unfunded");
  return ctx.paid(tool, input);
}

export const SCOUT: Tool = {
  id: "scout",
  describe:
    "fresh plays found on X: tickers people just started talking about, who is talking, how active and how real the conversation is, what the replies say, with each one's chart figures and peak",
  kind: "read",
  source: "x",
  timeoutMs: 150_000,
  run: async (ctx) => {
    if (!ctx.paid) {
      const scan = await marketScan(ctx.fetch, ctx.text, ctx.status);
      return {
        data: "X scouting needs the agent funded; this is only the index, which lists what already ran:\n" + scan.data,
        refs: refsOf(scan.refs),
      };
    }
    let cost = 0;
    const charge = (c: { costMicro: number | null }) => (cost += c.costMicro ?? 0);

    // 1. Discover.
    ctx.status?.("Scouting X for new tickers");
    const discovery: WriterPost[] = [];
    for (const d of DISCOVERY) {
      try {
        const call = await paid(ctx, "x.search", { query: d.query, sort: d.sort, sinceMinutes: d.sinceMinutes, pages: d.pages });
        charge(call);
        discovery.push(...(postsForWriter(call.data, 60) as WriterPost[]));
      } catch {
        // One empty search does not end the scout.
      }
    }
    const named = mentionedSymbols(ctx.text);
    const candidates = candidatesFrom(discovery, named, 5);
    if (!candidates.length) {
      const scan = await marketScan(ctx.fetch, ctx.text, ctx.status);
      return { data: "X had no ticker several accounts were naming in the last hours. The index, for context (what already ran):\n" + scan.data, refs: refsOf(scan.refs), costMicro: cost };
    }

    // 2. Dig into each one.
    const dug: { symbol: string; posts: WriterPost[]; x: ReturnType<typeof xActivity> }[] = [];
    for (const [i, c] of candidates.entries()) {
      ctx.status?.(`Digging into $${c.symbol} (${i + 1}/${candidates.length})`);
      try {
        const call = await paid(ctx, "x.search", { query: `$${c.symbol} -is:retweet`, sort: "top", sinceMinutes: DAY, pages: 1 });
        charge(call);
        const posts = postsForWriter(call.data, 40) as WriterPost[];
        dug.push({ symbol: c.symbol, posts, x: xActivity(posts) });
      } catch {
        dug.push({ symbol: c.symbol, posts: [], x: xActivity([]) });
      }
    }
    dug.sort((a, b) => b.x.score - a.x.score);

    // 3. Replies under the lead post, for the two liveliest.
    const replies = new Map<string, WriterPost[]>();
    for (const d of dug.slice(0, 2)) {
      const lead = leadPost(d.posts);
      const postId = postIdOf(lead?.url);
      if (!postId) continue;
      ctx.status?.(`Reading replies on $${d.symbol}`);
      try {
        const call = await paid(ctx, "x.replies", { postId, sort: "likes" });
        charge(call);
        replies.set(d.symbol, postsForWriter(call.data, 8) as WriterPost[]);
      } catch {
        // Replies are a bonus.
      }
    }

    // 4. The chart: figures and the peak, for each.
    ctx.status?.("Checking their charts");
    const chain = chainHint(ctx.text) ?? "solana";
    const charts = await Promise.all(
      dug.map(async (d) => {
        const rows = await ctx
          .fetch<{ data: Dex[] }>("dex", { q: d.symbol, limit: "2", chain })
          .then((r) => (Array.isArray(r.data) ? r.data : []))
          .catch(() => [] as Dex[]);
        return rows[0] ?? null;
      }),
    );
    const peaks = await peaksOf(ctx.fetch, charts.map((c) => (c?.chain === "solana" ? c.address : null)));

    const tokens: (TokenRef | null)[] = [];
    const cited: WriterPost[] = [];
    const report = dug.map((d, i) => {
      const main = charts[i];
      const peak = main?.chain === "solana" && main.address ? peaks[main.address] : null;
      const ref = main ? dexRef(main) : { symbol: d.symbol };
      if (ref && peak) ref.peak = { athMarketCap: peak.athMarketCap, fromAthPct: peak.fromAthPct, hoursSinceAth: peak.hoursSinceAth };
      tokens.push(ref);
      const lead = d.posts.slice(0, 3);
      cited.push(...lead, ...(replies.get(d.symbol) ?? []));
      return {
        symbol: d.symbol,
        x: d.x,
        leadPosts: lead.map((p) => ({ by: p.by, followers: p.followers, likes: p.likes, replies: p.replies, at: p.at, text: p.text.slice(0, 200), url: p.url })),
        ...(replies.has(d.symbol) ? { repliesUnderLead: (replies.get(d.symbol) ?? []).map((p) => ({ by: p.by, followers: p.followers, text: p.text.slice(0, 140) })) } : {}),
        chart: main
          ? {
              chain: main.chain,
              address: main.address,
              priceUsd: main.priceUsd,
              marketCap: main.marketCap ?? main.fdv,
              liquidity: main.liquidityUsd,
              volume24h: main.volume24h,
              change24h: main.change24h,
              ageHours: main.ageHours,
              ...(main.twitter ? { xAccount: main.twitter } : {}),
            }
          : "no DEX pair found: may not be tradable yet, or not on this chain",
        ...(peak ? { peak: { athMarketCap: peak.athMarketCap, fromAthPct: peak.fromAthPct, hoursSinceAth: peak.hoursSinceAth, peaked: peak.peaked } } : {}),
      };
    });

    return {
      data: compact(
        {
          method: "X discovery (launch chatter, last 6h; gem talk, last 24h) -> tickers several accounts named -> each one's X conversation scored 0-100 -> replies under the lead post for the top two -> chart and peak",
          xScoreMeans: "posts, distinct accounts, follower reach, engagement, recency; discounted for accounts under 100 followers, new this year, or automated",
          candidates: report,
          discoveryPosts: discovery.length,
        },
        14_000,
      ),
      refs: refsOf(tokens, postRefs(cited)),
      costMicro: cost,
      args: { candidates: dug.map((d) => d.symbol).join(",") },
    };
  },
};
