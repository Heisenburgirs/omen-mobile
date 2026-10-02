import type { ToolContext } from "./registry";
import { cashtagsIn, postIdOf, type WriterPost } from "./scout";

// The X network as the agent uses it: every post it reads becomes a call
// (who named which token, when) that the site stores and prices, and the
// agent asks back who called a token before, what their record is, and
// what else an account pushes. The web the user wants: accounts to tickers
// to price, over time.

export type CallIn = {
  postId: string;
  handle: string;
  followers?: number;
  symbol: string;
  mint?: string;
  postedAt: string;
  text?: string;
  url?: string;
  source?: string;
};

/** Calls from a run of posts about one symbol (the search's) or each post's own cashtags (a profile's). */
export function callsFrom(posts: WriterPost[], symbol: string | undefined, mint: string | undefined, source: string): CallIn[] {
  const out: CallIn[] = [];
  for (const p of posts) {
    const postId = postIdOf(p.url);
    const handle = p.by.replace(/^@/, "");
    if (!postId || !handle || handle === "?" || !p.at) continue;
    const symbols = symbol ? [symbol] : cashtagsIn(p.text).slice(0, 4);
    for (const s of symbols) {
      out.push({
        postId,
        handle,
        ...(p.followers != null ? { followers: p.followers } : {}),
        symbol: s.toUpperCase(),
        ...(symbol && mint ? { mint } : {}),
        postedAt: p.at,
        text: p.text.slice(0, 300),
        ...(p.url ? { url: p.url } : {}),
        source,
      });
    }
  }
  return out;
}

/** Stores calls on the site; failures are silent, the network is a bonus. */
export async function recordCalls(ctx: ToolContext, calls: CallIn[]): Promise<void> {
  if (!ctx.post || !calls.length) return;
  await ctx.post("xgraph", { calls: calls.slice(0, 60) }).catch(() => undefined);
}

export type SymbolGraph = {
  symbol: string;
  firstCall: { handle: string; followers: number | null; at: string; mcapAt: number | null; multiple: number | null; url: string | null } | null;
  callers24h: number;
  bigCallers: number;
  calls: { handle: string; followers: number | null; at: string; mcapAt: number | null; maxMcapAfter: number | null; multiple: number | null; url: string | null; source: string }[];
  accounts: { handle: string; followers: number | null; callsSeen: number; tokensCalled: number; callsScored: number; doubledAfterCall: number; hitRate: number | null; firstSeen: string }[];
};
export type HandleGraph = {
  account: { handle: string; followers?: number | null; callsSeen: number; tokensCalled?: number; callsScored?: number; doubledAfterCall?: number; hitRate?: number | null };
  callsPerDay: number;
  tokens: { symbol: string; calls: number; bestMultiple: number | null; last: string }[];
  recent: SymbolGraph["calls"];
};

export async function graphOf(ctx: ToolContext, symbol: string): Promise<SymbolGraph | null> {
  try {
    const { data } = await ctx.fetch<{ data: SymbolGraph | null }>("xgraph", { symbol });
    return data ?? null;
  } catch {
    return null;
  }
}
export async function graphOfHandle(ctx: ToolContext, handle: string): Promise<HandleGraph | null> {
  try {
    const { data } = await ctx.fetch<{ data: HandleGraph | null }>("xgraph", { handle: handle.replace(/^@/, "") });
    return data ?? null;
  } catch {
    return null;
  }
}

/** What the network says about a token, for the writer. */
export function symbolGraphSummary(g: SymbolGraph | null) {
  if (!g || !g.calls.length) return null;
  return {
    firstCall: g.firstCall,
    callers24h: g.callers24h,
    bigCallers: g.bigCallers,
    // Accounts with a record first: those whose calls have doubled before.
    callers: g.accounts
      .slice()
      .sort((a, b) => (b.hitRate ?? -1) - (a.hitRate ?? -1) || (b.followers ?? 0) - (a.followers ?? 0))
      .slice(0, 8)
      .map((a) => ({ handle: a.handle, followers: a.followers, tokensCalled: a.tokensCalled, callsScored: a.callsScored, doubled: a.doubledAfterCall, hitRate: a.hitRate })),
    recentCalls: g.calls.slice(-6).map((c) => ({ handle: c.handle, at: c.at, mcapAt: c.mcapAt, multiple: c.multiple })),
  };
}
