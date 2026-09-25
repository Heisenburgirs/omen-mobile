import type { Asset, Filters, Sort, SortDirection, Candle } from "./models";
export function filterAssets(
  assets: Asset[],
  f: Filters,
  sort: Sort,
  watchlist: string[] = [],
  now = Date.now(),
  direction: SortDirection = "desc",
) {
  const range = (n: number | null, min?: number, max?: number) =>
    (min === undefined && max === undefined) ||
    (n !== null &&
      Number.isFinite(n) &&
      (min === undefined || n >= min) &&
      (max === undefined || n <= max));
  return assets
    .filter(
      (a) =>
        range(a.marketCap, f.capMin, f.capMax) &&
        range(a.liquidity, f.liquidityMin, f.liquidityMax) &&
        range(a.volume24h, f.volumeMin, f.volumeMax) &&
        range(a.change24h, f.changeMin, f.changeMax) &&
        range(
          a.createdAt ? (now - Date.parse(a.createdAt)) / 86400000 : null,
          f.ageMin,
          f.ageMax,
        ) &&
        (!f.watchlisted || watchlist.includes(a.mint)) &&
        (!f.kind || a.stonk?.kind === f.kind) &&
        (!f.payout ||
          a.stonk?.payoutSymbol?.toLowerCase() === f.payout.toLowerCase() ||
          a.stonk?.payoutMint === f.payout) &&
        (f.taxBps === undefined || a.stonk?.taxBps === f.taxBps) &&
        (!f.stage || a.stonk?.stage === f.stage),
    )
    .sort((a, b) => {
      const val = (x: Asset) =>
        sort === "newest"
          ? x.createdAt
            ? Date.parse(x.createdAt)
            : null
          : sort === "cap"
            ? x.marketCap
            : sort === "apr"
              ? stonkApr(x)
              : sort === "liquidity"
                ? x.liquidity
                : sort === "gainers" || sort === "losers"
                  ? x.change24h
                  : x.volume24h;
      const x = val(a),
        y = val(b);
      return x === null
        ? y === null
          ? a.mint.localeCompare(b.mint)
          : 1
        : y === null
          ? -1
          : ((sort === "losers") !== (direction === "asc") ? x - y : y - x) ||
            a.mint.localeCompare(b.mint);
    });
}
export function cleanCandles(c: Candle[]) {
  return [
    ...new Map(
      c
        .filter(
          (x) =>
            [x.time, x.open, x.high, x.low, x.close].every(Number.isFinite) &&
            x.low > 0 &&
            x.high >= Math.max(x.open, x.close) &&
            x.low <= Math.min(x.open, x.close),
        )
        .map((x) => [x.time, x]),
    ).values(),
  ].sort((a, b) => a.time - b.time);
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}
export function usd(
  value: string | number | null | undefined,
  compact = false,
): string {
  if (value == null || !Number.isFinite(Number(value))) return "$0";
  const n = Number(value);
  if (compact && Math.abs(n) >= 1000) {
    const scale = Math.abs(n) >= 1e9 ? 1e9 : Math.abs(n) >= 1e6 ? 1e6 : 1e3;
    return (
      "$" +
      (n / scale).toFixed(1).replace(/\.0$/, "") +
      (scale === 1e9 ? "B" : scale === 1e6 ? "M" : "K")
    );
  }
  if (n !== 0 && Math.abs(n) < 0.01)
    return (
      (n < 0 ? "-" : "") +
      "$" +
      Math.abs(n).toLocaleString("en-US", { maximumSignificantDigits: 3 })
    );
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}
/**
 * Price movement over the charted window: the window's first price to the
 * live price (or the last close when no live price is known).
 */
export function periodChange(
  candles: Candle[],
  price: number | null | undefined,
): { abs: number; pct: number } | null {
  const c = cleanCandles(candles);
  if (!c.length) return null;
  const start = c[0].open || c[0].close;
  const end = price ?? c[c.length - 1].close;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null;
  return { abs: end - start, pct: ((end - start) / start) * 100 };
}
/** An APR figure without its sign: "0", "12.5", "202", and "62.3K" past a thousand. */
export function formatApr(apr: number): string {
  if (!Number.isFinite(apr) || apr === 0) return "0";
  if (Math.abs(apr) >= 1000)
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(apr);
  return apr.toFixed(apr >= 100 ? 0 : 1);
}
/**
 * A token quantity for a sentence ("Bought 7.69K ZINU", "Bought 0.000158
 * ZEC"): compact past a thousand, two decimals above one, and significant
 * digits below so a small fill never reads as zero.
 */
export function tokenQty(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000)
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumSignificantDigits: 3 });
}
export function pct(n: number | null | undefined) {
  return n == null || !Number.isFinite(n)
    ? "0%"
    : (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function assetPrice(value: string | number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "$0";
  const n = Number(value);
  if (n === 0 || Math.abs(n) >= 1) return usd(n);
  return (
    (n < 0 ? "-" : "") +
    "$" +
    Math.abs(n).toLocaleString("en-US", { maximumSignificantDigits: 4 })
  );
}

// Estimated yield for reward stonks: annualised transfer-tax revenue over
// market cap. Null when an input is missing or the market is too thin to
// trust (tiny caps with launch-day volume produce absurd ratios), so those
// sort last and nothing is displayed. The feed omits liquidity for many
// large tokens, so that floor only applies when liquidity is reported.
export const APR_MIN_LIQUIDITY = 10_000;
export const APR_MIN_MARKET_CAP = 25_000;
export function stonkApr(asset: Asset): number | null {
  const measured = measuredApr(asset);
  if (measured !== null) return measured;
  const tax = asset.stonk?.kind === "reward" ? asset.stonk.taxBps : null;
  if (
    !tax ||
    !asset.volume24h ||
    !asset.marketCap ||
    !Number.isFinite(asset.volume24h) ||
    !Number.isFinite(asset.marketCap) ||
    asset.marketCap < APR_MIN_MARKET_CAP ||
    (asset.liquidity !== null &&
      Number.isFinite(asset.liquidity) &&
      asset.liquidity < APR_MIN_LIQUIDITY)
  )
    return null;
  const apr = ((asset.volume24h * (tax / 10000) * 365) / asset.marketCap) * 100;
  return Number.isFinite(apr) ? apr : null;
}
// Yield measured from dividends the payout index actually saw, on the
// current market cap. Same market floor as the estimate; a window shorter
// than an hour is too young to annualise.
export const APR_MIN_WINDOW_HOURS = 1;
export function measuredApr(asset: Asset): number | null {
  const d = asset.dividends;
  if (
    !d ||
    d.apr === null ||
    !Number.isFinite(d.apr) ||
    d.apr < 0 ||
    d.hours < APR_MIN_WINDOW_HOURS ||
    !asset.marketCap ||
    asset.marketCap < APR_MIN_MARKET_CAP
  )
    return null;
  return d.apr;
}
/** Whether the APR shown for an asset is measured or only modeled from volume. */
export function aprBasis(asset: Asset): "measured" | "estimated" | null {
  if (measuredApr(asset) !== null) return "measured";
  return stonkApr(asset) === null ? null : "estimated";
}
export function assetMarketSummary(asset: Asset): string {
  // A token the feeds know no cap for reads "— MC" rather than a false zero.
  return asset.marketCap == null ? "— MC" : `${usd(asset.marketCap, true)} MC`;
}
// The row figure that matches the active sort, so a list sorted by volume
// shows volume, by APR shows the APR estimate, and so on.
export function assetSortMetric(asset: Asset, sort: Sort): string {
  if (sort === "volume")
    return asset.volume24h == null ? "— vol" : `${usd(asset.volume24h, true)} vol`;
  if (sort === "liquidity")
    return asset.liquidity == null ? "— liq" : `${usd(asset.liquidity, true)} liq`;
  if (sort === "gainers" || sort === "losers") return `${pct(asset.change24h)} 24h`;
  if (sort === "apr") return `${formatApr(stonkApr(asset) ?? 0)}% APR`;
  return assetMarketSummary(asset);
}
