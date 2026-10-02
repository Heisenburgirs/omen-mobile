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
  image?: string;
  launchpad?: string;
};
export type PostRef = { handle: string; url?: string; followers?: number; verified?: boolean; since?: number };

/**
 * An account's size as a badge: the reader knows in a glance whether a
 * handle is a nobody, a mid account or a whale. Rank orders the tiers.
 */
export function followerTier(followers: number | null | undefined): { label: string; rank: number } {
  const f = followers ?? 0;
  if (f >= 100_000) return { label: "100K+", rank: 5 };
  if (f >= 50_000) return { label: "50K+", rank: 4 };
  if (f >= 30_000) return { label: "30K+", rank: 3 };
  if (f >= 10_000) return { label: "10K+", rank: 2 };
  if (f >= 1_000) return { label: "1K+", rank: 1 };
  return { label: "<1K", rank: 0 };
}

/** Where a token launched, from its mint, its DEX and the index. */
export function launchpadOf(mint: string | null | undefined, dex?: string | null, stonk?: boolean): string | null {
  if (stonk) return "stonk";
  const d = (dex ?? "").toLowerCase();
  if (d.includes("pump")) return "pump.fun";
  if (d.includes("launchlab") || (mint ?? "").endsWith("bonk")) return "launchlab";
  if ((mint ?? "").endsWith("pump")) return "pump.fun";
  if (d.includes("meteora") || d.includes("dbc")) return "meteora";
  return null;
}
export type MessageRefs = { tokens: TokenRef[]; posts: PostRef[] };

export const EMPTY_REFS: MessageRefs = { tokens: [], posts: [] };

const score = (t: TokenRef) =>
  (t.mint ? 4 : 0) + (t.price != null ? 1 : 0) + (t.marketCap != null ? 1 : 0) + (t.liquidity != null ? 1 : 0) + (t.ageHours != null ? 1 : 0) + (t.peak ? 1 : 0);

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
      const merged: PostRef = {
        handle: have?.handle ?? p.handle,
        ...(have?.url || p.url ? { url: have?.url ?? p.url } : {}),
        ...((have?.followers ?? 0) >= (p.followers ?? 0) ? (have?.followers != null ? { followers: have.followers } : {}) : { followers: p.followers }),
        ...(have?.verified || p.verified ? { verified: true } : {}),
        ...(have?.since ?? p.since ? { since: have?.since ?? p.since } : {}),
      };
      posts.set(key, merged);
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
  image?: string | null;
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
    ...(row.image ? { image: row.image } : {}),
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
  imageUrl?: string | null;
  dex?: string;
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
    ...(row.imageUrl ? { image: row.imageUrl } : {}),
    ...(launchpadOf(row.address, row.dex) ? { launchpad: launchpadOf(row.address, row.dex)! } : {}),
    price: num(row.priceUsd),
    change24h: num(row.change24h),
    marketCap: num(row.marketCap) ?? num(row.fdv),
    liquidity: num(row.liquidityUsd),
    volume24h: num(row.volume24h),
    ageHours: row.ageHours ?? null,
  };
}

/** The accounts behind a run of posts, as the writer sees them (by: "@name", url). */
export function postRefs(posts: { by?: string; url?: string; followers?: number; verified?: boolean; accountSince?: number }[]): PostRef[] {
  const out: PostRef[] = [];
  for (const p of posts) {
    const handle = (p.by ?? "").replace(/^@/, "");
    if (handle && handle !== "?")
      out.push({
        handle,
        ...(p.url ? { url: p.url } : {}),
        ...(p.followers != null ? { followers: p.followers } : {}),
        ...(p.verified ? { verified: true } : {}),
        ...(p.accountSince ? { since: p.accountSince } : {}),
      });
  }
  return out;
}

/** An age as a person says it: "40m", "6h", "3d". */
export function ageText(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export const refsOf = (tokens: (TokenRef | null)[] = [], posts: PostRef[] = []): MessageRefs => ({
  tokens: tokens.filter((t): t is TokenRef => t !== null),
  posts,
});
