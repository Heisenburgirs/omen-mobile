import {
  compact,
  dividendSummary,
  dripRules,
  findAssets,
  mentionedSymbols,
  portfolioSummary,
  recentDividends,
  type Fetcher,
} from "./tools";

// Everything the agent can look up or prepare, as one registry. Jev reads
// each tool's `describe` line and says whether a message needs it; code
// finds the arguments and runs it. A tool only reads, or prepares an action
// the user confirms in the app: nothing here moves money.
//
// The same shape carries what comes next. A tool can be a web or X search,
// an on-chain query through a paid gateway, or a sub-agent that plans its
// own tools and model: it still has a description Jev can judge, arguments
// code can find, and a `run` that returns compact data for the writer.
export type ToolSource = "omen" | "device" | "chain" | "web" | "x" | "news";

export type Habits = {
  /** The P&L period the user asks about most, when a message names none. */
  pnlPeriod?: Period;
};
export type ToolContext = {
  text: string;
  fetch: Fetcher;
  /** Past messages matching a query, from the device. */
  search: (query: string) => Promise<{ role: string; text: string }[]>;
  habits: Habits;
};
export type ToolResult = { data: string; args?: Record<string, string> };

export type Tool = {
  id: string;
  /** One line Jev answers yes or no about: "Does answering need …?" */
  describe: string;
  kind: "read" | "prepare";
  source: ToolSource;
  run: (ctx: ToolContext) => Promise<ToolResult>;
};

export type Period = "24h" | "7d" | "30d" | "All";
/** The period a message names: "today", "this week", "last month", "all time". */
export function periodOf(text: string): Period | undefined {
  const t = text.toLowerCase();
  if (/\b(today|24 ?h|24 hours|since yesterday|daily)\b/.test(t)) return "24h";
  if (/\b(week|7 ?d|7 days|weekly)\b/.test(t)) return "7d";
  if (/\b(month|30 ?d|30 days|monthly)\b/.test(t)) return "30d";
  if (/\b(all[- ]time|ever|since (i|the) start|overall|lifetime)\b/.test(t)) return "All";
  return undefined;
}

export type TradeArgs = { side?: "buy" | "sell"; amount?: string; symbol?: string };
/** "buy 25 of ZEC", "sell 0.5 SOL", "swap 10 USDC into xSOL". */
export function tradeArgsOf(text: string): TradeArgs {
  const t = text.toLowerCase();
  const side = /\b(sell|dump|exit)\b/.test(t) ? "sell" : /\b(buy|get|ape|swap|into)\b/.test(t) ? "buy" : undefined;
  const amount = text.match(/\$?\s?(\d+(?:[.,]\d+)?)/)?.[1]?.replace(",", ".");
  const symbols = mentionedSymbols(text).filter((s) => s.toUpperCase() !== "USDC");
  return { side, amount, symbol: symbols[symbols.length - 1] };
}

type Asset = { mint?: string; symbol?: string; name?: string };

export const TOOLS: Tool[] = [
  {
    id: "balance",
    describe: "the user's current holdings, cash and total value",
    kind: "read",
    source: "omen",
    run: async (ctx) => ({ data: await portfolioSummary(ctx.fetch) }),
  },
  {
    id: "pnl",
    describe: "how the user's portfolio performed over a period (profit and loss)",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const period = periodOf(ctx.text) ?? ctx.habits.pnlPeriod ?? "7d";
      const { data } = await ctx.fetch<{ data: unknown }>("performance", { period });
      return { data: compact({ period, performance: data }, 1400), args: { period } };
    },
  },
  {
    id: "dividends",
    describe: "which holdings pay the user dividends and how much each pays",
    kind: "read",
    source: "omen",
    run: async (ctx) => ({ data: await dividendSummary(ctx.fetch) }),
  },
  {
    id: "payouts",
    describe: "the dividend payments the user received recently",
    kind: "read",
    source: "omen",
    run: async (ctx) => ({ data: await recentDividends(ctx.fetch) }),
  },
  {
    id: "activity",
    describe: "the user's recent trades, deposits and transfers",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const { data } = await ctx.fetch<{ data: unknown }>("activity");
      return { data: compact(data, 1400) };
    },
  },
  {
    id: "asset",
    describe: "facts about a specific token or stock the user names: price, market data, dividend",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const symbols = mentionedSymbols(ctx.text);
      const queries = symbols.length ? symbols : [ctx.text.slice(0, 40)];
      const found = await Promise.all(queries.map((q) => findAssets(ctx.fetch, q).then((d) => `${q}: ${d}`)));
      return { data: found.join("\n"), args: { symbols: symbols.join(",") } };
    },
  },
  {
    id: "market",
    describe: "what is moving in the market right now: top tokens by volume",
    kind: "read",
    source: "omen",
    run: async (ctx) => ({ data: await findAssets(ctx.fetch, "") }),
  },
  {
    id: "quote",
    describe: "a price quote for buying or selling a specific amount of a token",
    kind: "prepare",
    source: "omen",
    run: async (ctx) => {
      const args = tradeArgsOf(ctx.text);
      const missing = [!args.side && "buy or sell", !args.amount && "amount", !args.symbol && "token"].filter(Boolean);
      if (missing.length) return { data: `quote needs: ${missing.join(", ")}. Ask the user for them.` };
      const { data: assets } = await ctx.fetch<{ data: Asset[] }>("assets", { q: args.symbol! });
      const asset = (Array.isArray(assets) ? assets : []).find(
        (a) => a.symbol?.toLowerCase() === args.symbol!.toLowerCase(),
      ) ?? (Array.isArray(assets) ? assets[0] : undefined);
      if (!asset?.mint) return { data: `No token found for ${args.symbol}.` };
      const { data } = await ctx.fetch<{ data: unknown }>("quote", { side: args.side!, mint: asset.mint, amount: args.amount! });
      return {
        data: compact({ side: args.side, amount: args.amount, token: asset.symbol, quote: data }, 1200),
        args: { side: args.side!, amount: args.amount!, symbol: asset.symbol ?? args.symbol! },
      };
    },
  },
  {
    id: "drip",
    describe: "the user's automatic dividend reinvesting (drip) rules",
    kind: "read",
    source: "omen",
    run: async (ctx) => ({ data: await dripRules(ctx.fetch) }),
  },
  {
    id: "recall",
    describe: "something the user and the agent talked about before",
    kind: "read",
    source: "device",
    run: async (ctx) => {
      const past = await ctx.search(ctx.text);
      return { data: past.length ? JSON.stringify(past.map((m) => ({ [m.role]: m.text.slice(0, 240) }))) : "nothing found" };
    },
  },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
