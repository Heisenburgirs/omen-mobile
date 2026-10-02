import {
  compact,
  curatedListOf,
  findAssetRows,
  portfolioRows,
  withPeaks,
  dividendSummary,
  dripRules,
  findAssets,
  isResearch,
  marketScan,
  mentionedSymbols,
  portfolioSummary,
  recentDividends,
  type Fetcher,
} from "./tools";
import { EXTERNAL_TOOLS, postsForWriter } from "./external-tools";
import { SCOUT } from "./scout-tool";
import { dossiers } from "./dossier";
import { solanaRefs } from "./extract";
import { dexRef, mergeRefs, postRefs, refsOf, tokenRef, type MessageRefs } from "./refs";
import type { TokenRow } from "./tools";

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
/** The agent's own money: the USDC the user funded it with, in its Ryvo channel. */
export type AgentAccount = {
  /** "none" before the first funding; "open" while it can pay for replies. */
  state: string;
  availableUsdc: number;
  depositUsdc: number;
  spentUsdc: number;
  /** USDC in the agent's wallet outside the channel (a refund or a funding on its way). */
  idleUsdc: number;
};
export type ToolContext = {
  text: string;
  /** The agent's balance as the app knows it now. */
  agent?: () => AgentAccount | null;
  fetch: Fetcher;
  /** Past messages matching a query, from the device. */
  search: (query: string) => Promise<{ role: string; text: string }[]>;
  habits: Habits;
  /**
   * A Ryvo tool call (X, web search, Solana RPC), paid from the agent's
   * channel. Absent when the agent has no balance to pay with.
   */
  paid?: (tool: string, input: Record<string, unknown>) => Promise<{ data: unknown; costMicro: number | null }>;
  /** A few words on what the tool is doing now, shown to the user while it runs. */
  status?: (line: string) => void;
  /** The other tools running this turn, so one does not buy what another already is. */
  planned?: string[];
  /** A write to the app's API, for what the agent learns and keeps (the X network). */
  post?: <T = unknown>(resource: string, body: unknown) => Promise<T>;
};
/** What a tool hands the writer, and what its paid calls cost in millionths of a USDC. */
export type ToolResult = { data: string; args?: Record<string, string>; costMicro?: number; refs?: MessageRefs };

export type Tool = {
  id: string;
  /** One line Jev answers yes or no about: "Does answering need …?" */
  describe: string;
  kind: "read" | "prepare";
  source: ToolSource;
  run: (ctx: ToolContext) => Promise<ToolResult>;
  /** How long the harness waits for it; a multi-step paid lookup needs more than the 30 s default. */
  timeoutMs?: number;
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
    describe: "the user's own wallet: their current holdings, cash and total value (not the agent's balance)",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const { text, holdings } = await portfolioRows(ctx.fetch);
      return { data: text, refs: refsOf(holdings.map(tokenRef)) };
    },
  },
  {
    id: "agent_balance",
    describe: "the agent's own balance: the USDC the user funded the agent with, what it has spent on replies, and what is left",
    kind: "read",
    source: "device",
    run: async (ctx) => {
      const a = ctx.agent?.();
      if (!a) return { data: "agent balance unknown right now" };
      const usd = (n: number) => n.toFixed(2);
      if (a.state !== "open" && a.idleUsdc < 0.005) return { data: "the agent is not funded: balance 0.00 USDC. The user can fund it from the menu, Fund." };
      return {
        data: compact({
          agentBalanceUsdc: usd((a.state === "open" ? a.availableUsdc : 0) + a.idleUsdc),
          fundedUsdc: usd(a.depositUsdc),
          spentOnRepliesUsdc: usd(a.spentUsdc),
          ...(a.idleUsdc >= 0.005 ? { onItsWayUsdc: usd(a.idleUsdc) } : {}),
          note: "This is the agent's prepaid balance for its replies, separate from the user's portfolio.",
        }),
      };
    },
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
      const found = await Promise.all(queries.map((q) => findAssetRows(ctx.fetch, q)));
      return {
        data: found.map((f, i) => `${queries[i]}: ${f.text}`).join("\n"),
        args: { symbols: symbols.join(",") },
        refs: refsOf(found.flatMap((f) => f.rows.map(tokenRef))),
      };
    },
  },
  {
    id: "market",
    describe:
      "what is moving in the market now, new launches and low-cap tokens: the lists to pick ideas and potential plays from",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const scan = await marketScan(ctx.fetch, ctx.text, ctx.status);
      // Research wants the crowd too: one X search over the shortlist's
      // cashtags (top posts, last day), paid from the agent's balance.
      if (ctx.paid && isResearch(ctx.text) && scan.symbols.length) {
        try {
          ctx.status?.("Checking what X says about them");
          const query = scan.symbols.slice(0, 4).map((s) => "$" + s).join(" OR ");
          const call = await ctx.paid("x.search", { query, sort: "top", sinceMinutes: 1_440, pages: 1 });
          const chatter = postsForWriter(call.data, 12);
          return {
            data: scan.data + "\nxChatter: " + compact({ query, posts: chatter }, 3_500),
            costMicro: call.costMicro ?? 0,
            refs: refsOf(scan.refs, postRefs(chatter)),
          };
        } catch {
          // The scan stands on its own.
        }
      }
      return { data: scan.data, refs: refsOf(scan.refs) };
    },
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
    id: "tokens",
    describe:
      "a Solana token the user names, including a launch minutes old: its main contract, price, cap, liquidity, volume, age, peak, holders, and who on X is talking about it (big accounts, calls carrying the contract, momentum); or the trending and curated lists (majors, stocks, ETFs, RWAs, metals, stablecoins)",
    kind: "read",
    source: "omen",
    run: async (ctx) => {
      const { addresses } = solanaRefs(ctx.text);
      if (addresses[0]) {
        const { data } = await ctx.fetch<{ data: unknown }>("tokens", { mint: addresses[0] });
        return { data: compact(data, 3000), args: { mint: addresses[0] } };
      }
      const symbols = mentionedSymbols(ctx.text).slice(0, 3);
      // A named token gets the dossier: main contract, chart, holders, and
      // above all who on X is talking about it and how.
      if (symbols.length) return dossiers(ctx, symbols);
      const list = curatedListOf(ctx.text) ?? "trending";
      const { data } = await ctx.fetch<{ data: TokenRow[] }>("tokens", { list, limit: "25" });
      return { data: compact({ list, tokens: data }, 8000), args: { list } };
    },
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

// The app's own data first, then what the agent buys per call.
TOOLS.push(...EXTERNAL_TOOLS, SCOUT);

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
