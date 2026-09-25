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

/** Symbols the user named: $SOL, ZEC, xSOL. */
export function mentionedSymbols(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,9})|\b([A-Z][A-Z0-9]{1,9}|x[A-Z]{2,6})\b/g)) {
    const symbol = (match[1] ?? match[2] ?? "").trim();
    if (symbol && !["I", "A", "USD", "OK", "AI", "ETF", "APY", "PNL"].includes(symbol.toUpperCase())) out.add(symbol);
  }
  return [...out].slice(0, 3);
}
