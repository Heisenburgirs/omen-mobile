import {
  postCount,
  recencyOf,
  sinceMinutes,
  solanaRefs,
  wantsTop,
  webQuery,
  xHandles,
  xPostId,
  xSearchQuery,
} from "./extract";
import type { Tool, ToolContext, ToolResult } from "./registry";
import { compact } from "./tools";

// Lookups outside the app, bought per call through Ryvo from the agent's own
// balance: X (twitterapi.io), the web (Perplexity, Exa) and Solana (Alchemy).
// Jev picks which of them a message needs from their descriptions; code reads
// the arguments out of the message (extract.ts) and trims each result to
// what the writing model reads.

type Paid = { data: unknown; costMicro: number | null };

const UNFUNDED = "not available: this lookup is paid from the agent's balance, which is empty. Tell the user to fund the agent from the menu.";

async function paid(ctx: ToolContext, tool: string, input: Record<string, unknown>): Promise<Paid> {
  if (!ctx.paid) throw new Error(UNFUNDED);
  return ctx.paid(tool, input);
}

function result(data: string, calls: Paid[], args?: Record<string, string>): ToolResult {
  const costs = calls.map((c) => c.costMicro ?? 0);
  return { data, ...(args ? { args } : {}), costMicro: costs.reduce((a, b) => a + b, 0) };
}

type Post = {
  id?: string;
  url?: string;
  text?: string;
  createdAt?: string | null;
  author?: { userName?: string; followers?: number | null; accountCreatedAt?: string | null; verified?: boolean; automated?: boolean };
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number | null;
  inReplyTo?: { userName?: string | null } | null;
  quoted?: Post;
};

const year = (date: string | null | undefined) => {
  const y = date ? new Date(date).getFullYear() : NaN;
  return Number.isFinite(y) ? y : undefined;
};

/** One post as the writer reads it: what was said, by whom (and how established they are), and how it landed. */
function postLine(p: Post) {
  return {
    by: `@${p.author?.userName ?? "?"}`,
    followers: p.author?.followers ?? undefined,
    accountSince: year(p.author?.accountCreatedAt),
    ...(p.author?.verified ? { verified: true } : {}),
    ...(p.author?.automated ? { automated: true } : {}),
    at: p.createdAt ?? undefined,
    text: (p.text ?? "").slice(0, 280),
    likes: p.likes,
    reposts: p.reposts,
    replies: p.replies,
    views: p.views ?? undefined,
    ...(p.inReplyTo?.userName ? { replyTo: `@${p.inReplyTo.userName}` } : {}),
    ...(p.quoted ? { quoting: `@${p.quoted.author?.userName ?? "?"}: ${(p.quoted.text ?? "").slice(0, 140)}` } : {}),
    url: p.url,
  };
}

const posts = (data: unknown, limit = 30) => ((data as { posts?: Post[] }).posts ?? []).slice(0, limit).map(postLine);
/** X posts as the writer reads them, for a tool outside this file that bought them. */
export const postsForWriter = posts;

function needHandle(ctx: ToolContext): string | ToolResult {
  const handle = xHandles(ctx.text)[0];
  return handle ?? { data: "no X account named: ask the user which @handle they mean" };
}

export const EXTERNAL_TOOLS: Tool[] = [
  {
    id: "x_posts",
    describe: "the latest posts from a specific X (Twitter) account the user names",
    kind: "read",
    source: "x",
    run: async (ctx) => {
      const handle = needHandle(ctx);
      if (typeof handle !== "string") return handle;
      const call = await paid(ctx, "x.user_posts", { userName: handle });
      const count = postCount(ctx.text) ?? 20;
      return result(compact({ account: `@${handle}`, posts: posts(call.data, count) }, 9000), [call], { handle });
    },
  },
  {
    id: "x_profile",
    describe: "who a specific X (Twitter) account is: bio, followers, account age, verification",
    kind: "read",
    source: "x",
    run: async (ctx) => {
      const handle = needHandle(ctx);
      if (typeof handle !== "string") return handle;
      const call = await paid(ctx, "x.user", { userName: handle });
      return result(compact(call.data, 1500), [call], { handle });
    },
  },
  {
    id: "x_mentions",
    describe: "posts on X (Twitter) that mention or reply to a specific account the user names",
    kind: "read",
    source: "x",
    run: async (ctx) => {
      const handle = needHandle(ctx);
      if (typeof handle !== "string") return handle;
      const minutes = sinceMinutes(ctx.text);
      const call = await paid(ctx, "x.mentions", { userName: handle, ...(minutes ? { sinceMinutes: minutes } : {}) });
      return result(compact({ account: `@${handle}`, mentions: posts(call.data) }, 9000), [call], { handle });
    },
  },
  {
    id: "x_search",
    describe: "what people on X (Twitter) are posting about a token, ticker, project or topic",
    kind: "read",
    source: "x",
    run: async (ctx) => {
      const query = xSearchQuery(ctx.text);
      const minutes = sinceMinutes(ctx.text);
      const pages = Math.min(3, Math.ceil((postCount(ctx.text) ?? 20) / 20));
      const call = await paid(ctx, "x.search", {
        query,
        sort: wantsTop(ctx.text) ? "top" : "latest",
        pages,
        ...(minutes ? { sinceMinutes: minutes } : {}),
      });
      return result(compact({ query: (call.data as { query?: string }).query ?? query, posts: posts(call.data, 60) }, 12000), [call], { query });
    },
  },
  {
    id: "x_replies",
    describe: "a specific X (Twitter) post the user linked, and the replies and discussion under it",
    kind: "read",
    source: "x",
    run: async (ctx) => {
      const postId = xPostId(ctx.text);
      if (!postId) return { data: "no X post link in the message: ask the user for the post's link" };
      const [original, replies] = [
        await paid(ctx, "x.posts", { postIds: [postId] }),
        await paid(ctx, "x.replies", { postId, sort: "likes" }),
      ];
      return result(compact({ post: posts(original.data, 1)[0] ?? null, replies: posts(replies.data) }, 9000), [original, replies], { postId });
    },
  },
  {
    id: "web_search",
    describe: "current information from the web: news, recent events, why something happened, facts the app does not have",
    kind: "read",
    source: "web",
    run: async (ctx) => {
      const query = webQuery(ctx.text);
      const recency = recencyOf(sinceMinutes(ctx.text));
      const call = await paid(ctx, "search.web", { query, maxResults: 5, ...(recency ? { recency } : {}) });
      return result(compact(call.data, 5000), [call], { query });
    },
  },
  {
    id: "web_research",
    describe: "deeper web research on a company, project, person or report, with excerpts from the pages",
    kind: "read",
    source: "web",
    run: async (ctx) => {
      const query = webQuery(ctx.text);
      const call = await paid(ctx, "search.exa", { query, numResults: 5 });
      return result(compact(call.data, 7000), [call], { query });
    },
  },
  {
    id: "chain_lookup",
    describe: "on-chain Solana data for an address, token mint or transaction signature the user gives",
    kind: "read",
    source: "chain",
    run: async (ctx) => {
      const { signatures, addresses } = solanaRefs(ctx.text);
      const rpc = (method: string, params: unknown) => paid(ctx, "solana.rpc", { method, params });
      const rpcResult = (call: Paid) => (call.data as { result?: unknown; error?: { message?: string } }).result;

      if (signatures[0]) {
        const call = await rpc("getTransaction", [signatures[0], { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const tx = rpcResult(call) as {
          slot?: number;
          blockTime?: number | null;
          meta?: { err?: unknown; fee?: number; preTokenBalances?: unknown[]; postTokenBalances?: unknown[]; logMessages?: string[] } | null;
          transaction?: { message?: { accountKeys?: { pubkey?: string; signer?: boolean }[]; instructions?: { program?: string; programId?: string; parsed?: unknown }[] } };
        } | null;
        if (!tx) return result("no transaction found for that signature", [call], { signature: signatures[0] });
        return result(
          compact({
            signature: signatures[0],
            slot: tx.slot,
            time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
            succeeded: !tx.meta?.err,
            feeSol: (tx.meta?.fee ?? 0) / 1e9,
            signers: tx.transaction?.message?.accountKeys?.filter((k) => k.signer).map((k) => k.pubkey),
            instructions: tx.transaction?.message?.instructions?.map((i) => i.program ?? i.programId).slice(0, 12),
            tokenBalancesBefore: tx.meta?.preTokenBalances,
            tokenBalancesAfter: tx.meta?.postTokenBalances,
          }, 5000),
          [call],
          { signature: signatures[0] },
        );
      }

      const address = addresses[0];
      if (!address) return { data: "no Solana address or transaction signature in the message: ask the user for one" };
      const info = await rpc("getAccountInfo", [address, { encoding: "jsonParsed" }]);
      const value = rpcResult(info) as { value?: { owner?: string; lamports?: number; data?: { parsed?: { type?: string } } } | null } | null;
      const account = value?.value ?? null;

      if (account?.data?.parsed?.type === "mint") {
        const asset = await rpc("getAsset", { id: address });
        const a = rpcResult(asset) as {
          content?: { metadata?: { name?: string; symbol?: string } };
          token_info?: { supply?: number; decimals?: number; token_program?: string; mint_authority?: string; freeze_authority?: string };
          mint_extensions?: Record<string, unknown> | null;
        } | null;
        const decimals = a?.token_info?.decimals ?? 0;
        return result(
          compact({
            kind: "token mint",
            mint: address,
            name: a?.content?.metadata?.name,
            symbol: a?.content?.metadata?.symbol,
            supply: a?.token_info?.supply != null ? a.token_info.supply / 10 ** decimals : null,
            decimals,
            tokenProgram: a?.token_info?.token_program,
            mintAuthority: a?.token_info?.mint_authority ?? null,
            freezeAuthority: a?.token_info?.freeze_authority ?? null,
            extensions: a?.mint_extensions ? Object.keys(a.mint_extensions) : [],
          }, 3000),
          [info, asset],
          { address },
        );
      }

      if (/\b(transactions?|activity|history|recent|txs?)\b/i.test(ctx.text)) {
        const sigs = await rpc("getSignaturesForAddress", [address, { limit: 10 }]);
        const list = (rpcResult(sigs) as { signature?: string; blockTime?: number | null; err?: unknown; memo?: string | null }[] | null) ?? [];
        return result(
          compact({
            address,
            solBalance: (account?.lamports ?? 0) / 1e9,
            recentTransactions: list.map((s) => ({
              signature: s.signature,
              time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
              failed: Boolean(s.err),
              ...(s.memo ? { memo: s.memo } : {}),
            })),
          }, 4000),
          [info, sigs],
          { address },
        );
      }

      // A wallet (a system account, or no account yet): what it holds.
      const assets = await rpc("getAssetsByOwner", { ownerAddress: address, page: 1, limit: 50, options: { showFungible: true } });
      const items = ((rpcResult(assets) as { items?: unknown[] } | null)?.items ?? []) as {
        id?: string;
        interface?: string;
        content?: { metadata?: { name?: string; symbol?: string } };
        token_info?: { balance?: number; decimals?: number; price_info?: { total_price?: number } };
      }[];
      const tokens = items
        .filter((i) => i.token_info)
        .map((i) => ({
          symbol: i.content?.metadata?.symbol ?? "",
          name: i.content?.metadata?.name ?? "",
          mint: i.id,
          amount: (i.token_info?.balance ?? 0) / 10 ** (i.token_info?.decimals ?? 0),
          ...(i.token_info?.price_info?.total_price != null ? { valueUsd: i.token_info.price_info.total_price } : {}),
        }));
      return result(
        compact({
          kind: "wallet",
          address,
          solBalance: (account?.lamports ?? 0) / 1e9,
          tokens,
          otherAssets: items.length - tokens.length,
        }, 5000),
        [info, assets],
        { address },
      );
    },
  },
];
