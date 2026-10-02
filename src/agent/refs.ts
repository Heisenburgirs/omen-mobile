// What a reply can point at: the tokens it names, with where they trade
// and what the tools learned about them, and the X accounts and posts it
// cites. Tools hand these back next to their text; the message keeps them;
// the chat renders a ticker as a link to its page, a token's figures as a
// card, and a handle or post as a link out to X.

export type TokenRef = {
  symbol: string;
  name?: string;
  /** The mint: the token has a page in the app. */
  mint?: string;
  price?: number | null;
  change24h?: number | null;
  marketCap?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  ageHours?: number | null;
  peak?: { athMarketCap: number; fromAthPct: number; hoursSinceAth: number } | null;
};
export type PostRef = { handle: string; url?: string };
export type MessageRefs = { tokens: TokenRef[]; posts: PostRef[] };

export const EMPTY_REFS: MessageRefs = { tokens: [], posts: [] };

const score = (t: TokenRef) =>
  (t.mint ? 4 : 0) + (t.price != null ? 1 : 0) + (t.marketCap != null ? 1 : 0) + (t.liquidity != null ? 1 : 0) + (t.peak ? 1 : 0);

/** Refs from several tools as one set: one entry per symbol, the fullest kept; one per handle. */
export function mergeRefs(...parts: (MessageRefs | undefined | null)[]): MessageRefs {
  const tokens = new Map<string, TokenRef>();
  const posts = new Map<string, PostRef>();
  for (const part of parts) {
    for (const t of part?.tokens ?? []) {
      if (!t.symbol) continue;
      const key = t.symbol.toUpperCase();
      const have = tokens.get(key);
      if (!have || score(t) > score(have)) tokens.set(key, { ...have, ...t, symbol: t.symbol.toUpperCase() });
      else tokens.set(key, { ...t, ...have });
    }
    for (const p of part?.posts ?? []) {
      if (!p.handle) continue;
      const key = p.handle.toLowerCase();
      const have = posts.get(key);
      if (!have || (!have.url && p.url)) posts.set(key, { handle: p.handle, ...(p.url ? { url: p.url } : {}) });
    }
  }
  return { tokens: [...tokens.values()], posts: [...posts.values()] };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

const peakOf = (v: unknown) => {
  const p = v && typeof v === "object" ? (v as { athMarketCap?: unknown; fromAthPct?: unknown; hoursSinceAth?: unknown }) : null;
  return p && typeof p.athMarketCap === "number" && typeof p.fromAthPct === "number"
    ? { athMarketCap: p.athMarketCap, fromAthPct: p.fromAthPct, hoursSinceAth: typeof p.hoursSinceAth === "number" ? p.hoursSinceAth : 0 }
    : undefined;
};

/** A token row from the app's index, the scan, tokens.xyz or a holding. */
export function tokenRef(row: {
  symbol?: string | null;
  name?: string | null;
  mint?: string | null;
  price?: unknown;
  change24h?: unknown;
  marketCap?: unknown;
  fdv?: unknown;
  liquidity?: unknown;
  volume24h?: unknown;
  ageDays?: number | null;
  createdAt?: string | null;
  peak?: unknown;
}): TokenRef | null {
  if (!row.symbol) return null;
  const age = row.ageDays != null ? row.ageDays * 24 : row.createdAt ? Math.max(0, (Date.now() - Date.parse(row.createdAt)) / 36e5) : null;
  const peak = peakOf(row.peak);
  return {
    symbol: row.symbol,
    ...(row.name ? { name: row.name } : {}),
    ...(row.mint ? { mint: row.mint } : {}),
    price: num(row.price),
    change24h: num(row.change24h),
    marketCap: num(row.marketCap) ?? num(row.fdv),
    liquidity: num(row.liquidity),
    volume24h: num(row.volume24h),
    ageHours: age != null && Number.isFinite(age) ? Math.round(age) : null,
    ...(peak ? { peak } : {}),
  };
}

/** A token row from DexScreener. */
export function dexRef(row: {
  symbol?: string;
  name?: string;
  address?: string;
  url?: string;
  priceUsd?: unknown;
  change24h?: unknown;
  marketCap?: unknown;
  fdv?: unknown;
  liquidityUsd?: unknown;
  volume24h?: unknown;
  ageHours?: number | null;
}): TokenRef | null {
  if (!row.symbol) return null;
  return {
    symbol: row.symbol,
    ...(row.name ? { name: row.name } : {}),
    ...(row.address ? { mint: row.address } : {}),
    price: num(row.priceUsd),
    change24h: num(row.change24h),
    marketCap: num(row.marketCap) ?? num(row.fdv),
    liquidity: num(row.liquidityUsd),
    volume24h: num(row.volume24h),
    ageHours: row.ageHours ?? null,
  };
}

/** The accounts behind a run of posts, as the writer sees them (by: "@name", url). */
export function postRefs(posts: { by?: string; url?: string }[]): PostRef[] {
  const out: PostRef[] = [];
  for (const p of posts) {
    const handle = (p.by ?? "").replace(/^@/, "");
    if (handle && handle !== "?") out.push({ handle, ...(p.url ? { url: p.url } : {}) });
  }
  return out;
}

export const refsOf = (tokens: (TokenRef | null)[] = [], posts: PostRef[] = []): MessageRefs => ({
  tokens: tokens.filter((t): t is TokenRef => t !== null),
  posts,
});
