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
  return compact(list, 1600);
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
export async function marketScan(fetch: Fetcher, text: string): Promise<{ data: string; symbols: string[] }> {
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
  const [gainers, newest, volume] = await Promise.all([list("gainers"), list("newest"), list("volume")]);
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
  const take = (rows: ScanRow[]) => rows.slice(0, 8).map(row);
  const symbols = [...new Set([...gainers, ...newest, ...volume].map((a) => a.symbol).filter((s): s is string => Boolean(s)))];
  return {
    data: compact(
      {
        ...(capMax ? { marketCapAtMost: capMax } : {}),
        gainers24h: take(gainers),
        newest: take(newest),
        busiest: take(volume),
      },
      9_000,
    ),
    symbols,
  };
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
