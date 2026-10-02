// What the agent can look up. Every tool is a plain function over the app's
// own API, chosen by code from Jev's reading of the message, never by a model
// emitting JSON. Each returns a compact text the writing model reads as data.
export type Fetcher = <T = unknown>(resource: string, params?: Record<string, string>) => Promise<T>;

const MAX = 1800;
/** JSON, trimmed to what a reply needs. */
export function compact(value: unknown, max = MAX): string {
  const text = JSON.stringify(value, (_key, v) => (typeof v === "number" ? Number(v.toFixed(6)) : v));
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type Envelope<T> = { data: T; coverage?: string; message?: string | null };
type Holding = {
  asset?: { symbol?: string; name?: string; mint?: string };
  symbol?: string;
  mint?: string;
  amount?: string | number;
  valueUsd?: string | number | null;
  changeUsd?: string | number | null;
};

/** The user's holdings across their wallets, largest first. */
export async function portfolioSummary(fetch: Fetcher): Promise<string> {
  const { data } = await fetch<Envelope<{ holdings?: Holding[]; totalUsd?: string | number; cashUsd?: string | number }>>("portfolio");
  const holdings = (data?.holdings ?? [])
    .map((h) => ({
      symbol: h.asset?.symbol ?? h.symbol ?? "?",
      name: h.asset?.name,
      mint: h.asset?.mint ?? h.mint,
      amount: h.amount,
      valueUsd: Number(h.valueUsd ?? 0),
      changeUsd: h.changeUsd == null ? undefined : Number(h.changeUsd),
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 14);
  const total = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
  return compact({ totalUsd: Number(data?.totalUsd ?? total), holdings });
}

/** Where the user's dividends come from and what they have paid. */
export async function dividendSummary(fetch: Fetcher): Promise<string> {
  const { data } = await fetch<Envelope<unknown>>("dividend-sources");
  return compact(data);
}

/** The latest dividend payments received. */
export async function recentDividends(fetch: Fetcher): Promise<string> {
  const { data } = await fetch<Envelope<unknown>>("activity", { kind: "dividend" });
  return compact(data, 1400);
}

/** The user's drip (reinvesting) rules. */
export async function dripRules(fetch: Fetcher): Promise<string> {
  const { data } = await fetch<Envelope<unknown>>("strategies");
  return compact(data, 1200);
}

/** Tokens matching a name or symbol, with their market fields. */
export async function findAssets(fetch: Fetcher, query: string): Promise<string> {
  const { data } = await fetch<Envelope<unknown[]>>("assets", { q: query.slice(0, 40) });
  const list = Array.isArray(data) ? data.slice(0, 5) : data;
  return compact(Array.isArray(list) ? await withPeaks(fetch, list as { mint?: string }[]) : list, 2000);
}

/**
 * Where a token has been: its all-time-high market cap, when, and how far
 * it sits below it now. A run whose peak is days old and 80% above the
 * price is attention that already came and went.
 */
export type Peak = {
  athMarketCap: number;
  athAt: string;
  hoursSinceAth: number;
  fromAthPct: number;
  lowSinceAthMarketCap: number;
  peaked: boolean;
};
export async function peaksOf(fetch: Fetcher, mints: (string | undefined | null)[]): Promise<Record<string, Peak | null>> {
  const unique = [...new Set(mints.filter((m): m is string => Boolean(m)))].slice(0, 24);
  if (!unique.length) return {};
  try {
    const { data } = await fetch<Envelope<Record<string, Peak | null>>>("peaks", { mints: unique.join(",") });
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}
/** Rows with a mint gain a peak field: ATH cap, hours since, and distance below it. */
export async function withPeaks<T extends { mint?: string | null }>(fetch: Fetcher, rows: T[]): Promise<(T & { peak?: unknown })[]> {
  const peaks = await peaksOf(fetch, rows.map((r) => r.mint));
  return rows.map((r) => {
    const p = r.mint ? peaks[r.mint] : null;
    return p
      ? { ...r, peak: { athMarketCap: p.athMarketCap, hoursSinceAth: p.hoursSinceAth, fromAthPct: p.fromAthPct, lowSinceAthMarketCap: p.lowSinceAthMarketCap, peaked: p.peaked } }
      : r;
  });
}

/** One token's page: price, market fields and dividends. */
export async function assetDetail(fetch: Fetcher, mint: string): Promise<string> {
  const { data } = await fetch<Envelope<unknown>>("asset", { mint });
  return compact(data, 1600);
}

/** A request for ideas: what to buy, what could run, gems, low caps, research. */
export function isResearch(text: string): boolean {
  return /\b(10x|100x|gems?|plays?|alpha|research|low[ -]?caps?|small[ -]?caps?|micro[ -]?caps?|moon|opportunit\w*|what (?:should|could|can) i buy|find (?:me )?(?:some |new |a )?(?:tokens?|coins?|plays?)|new (?:tokens?|coins?|launches)|worth (?:a )?(?:look|buying)|undervalued|runners?|narratives?)\b/i.test(text);
}

type ScanRow = {
  symbol?: string;
  name?: string;
  mint?: string;
  price?: number | null;
  change24h?: number | null;
  marketCap?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  createdAt?: string | null;
  stonk?: { payoutSymbol?: string | null; taxBps?: number | null } | null;
};

/**
 * The market as a scan for ideas: the day's gainers, the newest launches and
 * the busiest tokens, each row with what a pick turns on (cap, liquidity,
 * volume, age, change, what it pays). "Low cap", "gems" or "under $5m"
 * narrow it by market cap; everything is kept above a little liquidity.
 */
export async function marketScan(fetch: Fetcher, text: string, onStatus?: (line: string) => void): Promise<{ data: string; symbols: string[] }> {
  const t = text.toLowerCase();
  const under = t.match(/\bunder \$?(\d+(?:\.\d+)?)\s*(k|m)\b/);
  const capMax = under
    ? Number(under[1]) * (under[2] === "k" ? 1_000 : 1_000_000)
    : /\b(low|small|micro)[ -]?caps?\b|\bgems?\b|\b10x\b|\b100x\b/.test(t)
      ? 10_000_000
      : undefined;
  const filters = JSON.stringify({ ...(capMax ? { capMax } : {}), liquidityMin: 5_000 });
  const list = (sort: string) =>
    fetch<Envelope<ScanRow[]>>("assets", { scope: "stonk", type: "tokens", q: "", sort, direction: "desc", filters, cursor: "0", chain: "skip" })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => [] as ScanRow[]);
  // tokens.xyz's trending list reaches the whole chain, not only OMEN's index.
  const trendingList = fetch<Envelope<TokenRow[]>>("tokens", { list: "trending", limit: "20" })
    .then((r) => (Array.isArray(r.data) ? r.data : []))
    .catch(() => [] as TokenRow[]);
  const [gainers, newest, volume, trending] = await Promise.all([list("gainers"), list("newest"), list("volume"), trendingList]);
  const days = (iso: string | null | undefined) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000)) : null);
  const row = (a: ScanRow) => ({
    symbol: a.symbol,
    name: a.name,
    mint: a.mint,
    price: a.price ?? null,
    change24h: a.change24h ?? null,
    marketCap: a.marketCap ?? null,
    liquidity: a.liquidity ?? null,
    volume24h: a.volume24h ?? null,
    ageDays: days(a.createdAt),
    ...(a.stonk?.payoutSymbol ? { pays: a.stonk.payoutSymbol, taxPct: a.stonk.taxBps != null ? a.stonk.taxBps / 100 : null } : {}),
  });
  // Every shortlisted token carries where it peaked, so a run that is already
  // over reads as one.
  onStatus?.("Checking where they peaked");
  const shortlist = [...gainers.slice(0, 8), ...newest.slice(0, 8), ...volume.slice(0, 8)];
  const peaks = await peaksOf(fetch, shortlist.map((a) => a.mint));
  const take = (rows: ScanRow[]) =>
    rows.slice(0, 8).map((a) => {
      const p = a.mint ? peaks[a.mint] : null;
      return p ? { ...row(a), peak: { athMarketCap: p.athMarketCap, hoursSinceAth: p.hoursSinceAth, fromAthPct: p.fromAthPct, peaked: p.peaked } } : row(a);
    });
  const symbols = [...new Set([...gainers, ...newest, ...volume].map((a) => a.symbol).filter((s): s is string => Boolean(s)))];
  const trendingRows = trending.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    mint: r.mint,
    category: r.category,
    price: r.price,
    change1h: r.change1h ?? null,
    change24h: r.change24h,
    volume24h: r.volume24h,
    volume1h: r.volume1h ?? null,
    trades24h: r.trades24h ?? null,
    wallets24h: r.wallets24h ?? null,
    liquidity: r.liquidity,
    ...(r.advisory ? { advisory: r.advisory } : {}),
  }));
  const section = (label: string, rows: unknown[], max: number) =>
    `${label} (${rows.length}): ${rows.length ? compact(rows, max) : "none matched"}`;
  return {
    data: [
      capMax ? `market cap at most $${capMax.toLocaleString("en-US")}, liquidity at least $5,000` : "liquidity at least $5,000",
      section("gainers24h, OMEN index", take(gainers), 3_600),
      section("newest launches, OMEN index", take(newest), 3_600),
      section("busiest by volume, OMEN index", take(volume), 3_600),
      section("trending across Solana, tokens.xyz", trendingRows, 6_000),
    ].join("\n"),
    symbols,
  };
}

/** A row of the token universe (tokens.xyz through the app's API). */
export type TokenRow = {
  symbol: string | null;
  name: string | null;
  assetId: string | null;
  mint: string | null;
  category: string | null;
  issuer?: string | null;
  trustTier?: string | null;
  price: number | null;
  change1h?: number | null;
  change24h: number | null;
  volume24h: number | null;
  volume1h?: number | null;
  trades24h?: number | null;
  wallets24h?: number | null;
  liquidity: number | null;
  marketCap?: number | null;
  fdv?: number | null;
  advisory?: string | null;
  risk?: { score: number | null; grade: string | null; label: string | null; trustedLaunch: boolean; caps: string[] } | null;
};

/** Which curated list a message asks for, if any. */
export function curatedListOf(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(stocks?|equit(y|ies)|xstocks?)\b/.test(t)) return "stocks";
  if (/\betfs?\b/.test(t)) return "etfs";
  if (/\brwas?\b|real[ -]world/.test(t)) return "rwas";
  if (/\b(metals?|gold|silver)\b/.test(t)) return "metals";
  if (/\b(majors?|blue[ -]?chips?|large[ -]?caps?)\b/.test(t)) return "majors";
  if (/\blsts?\b|liquid staking/.test(t)) return "lsts";
  if (/\b(stable ?coins?|currenc(y|ies))\b/.test(t)) return "currencies";
  return null;
}

/** Symbols the user named: $SOL, ZEC, xSOL. */
export function mentionedSymbols(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,9})|\b([A-Z][A-Z0-9]{1,9}|x[A-Z]{2,6})\b/g)) {
    const symbol = (match[1] ?? match[2] ?? "").trim();
    if (symbol && !["I", "A", "USD", "OK", "AI", "ETF", "APY", "PNL"].includes(symbol.toUpperCase())) out.add(symbol);
  }
  return [...out].slice(0, 3);
}
