import test from "node:test";
import assert from "node:assert/strict";
import {
  filterAssets,
  cleanCandles,
  safeUrl,
  assetMarketSummary,
  assetSortMetric,
  stonkApr,
} from "../src/domain/market";
import { emptyAsset, ZCAT } from "../src/domain/models";
import {
  decimal,
  decimalString,
  valuation,
  reduceLots,
  positionMetrics,
  periodPnl,
  eligibleRank,
} from "../src/domain/accounting";
test("unknown numbers never pass a numeric filter", () => {
  const a = emptyAsset(ZCAT);
  assert.equal(filterAssets([a], { capMin: 0 }, "cap").length, 0);
  assert.equal(filterAssets([a], {}, "volume").length, 1);
});
test("same symbols retain separate mint identity and watchlists", () => {
  const a = { ...emptyAsset("a"), symbol: "CAT", marketCap: 100 },
    b = { ...a, mint: "b" };
  assert.deepEqual(
    filterAssets([a, b], { watchlisted: true }, "cap", ["b"]).map(
      (a) => a.mint,
    ),
    ["b"],
  );
});
test("zero tax is an explicit filter", () => {
  const a = emptyAsset("a");
  a.stonk = {
    deployment: "x",
    kind: "standard",
    payoutMint: null,
    payoutSymbol: null,
    taxBps: 0,
    stage: null,
    eligibility: null,
    evidence: "test",
  };
  assert.equal(
    filterAssets([a, emptyAsset("b")], { taxBps: 0 }, "cap").length,
    1,
  );
});
test("decimal valuation preserves large balances without JS rounding", () => {
  assert.equal(
    valuation("9007199254740993123", 9, "2.5"),
    "22517998136.852482807500000000",
  );
  assert.equal(decimalString(decimal("-0.001")), "-0.001000000000000000");
});
test("deposits and dividends are excluded; fees already reduce closing equity", () => {
  assert.equal(
    periodPnl(
      decimal("100"),
      decimal("169"),
      decimal("50"),
      decimal("20"),
      true,
    ),
    decimal("-1"),
  );
  assert.equal(periodPnl(null, decimal("10"), 0n, 0n, false), null);
});
test("partial sell reduces weighted costs and seven-day basis proportionally", () => {
  const l = reduceLots(
    [
      {
        raw: 100n,
        cost: decimal("100"),
        weekBasis: decimal("120"),
        dividend: false,
      },
    ],
    40n,
  );
  const r = positionMetrics(l, 0, "2");
  assert.equal(r.unrealized, decimal("60"));
  assert.equal(r.weekly, decimal("48"));
});
test("unknown deposits never become zero-cost profit", () => {
  const r = positionMetrics(
    [{ raw: 10n, cost: null, weekBasis: null, dividend: false }],
    0,
    "100",
  );
  assert.equal(r.unrealized, null);
  assert.equal(r.weekly, null);
});
test("dividend units are excluded from weekly ranking gains", () => {
  const r = positionMetrics(
    [
      {
        raw: 10n,
        cost: decimal("10"),
        weekBasis: decimal("10"),
        dividend: true,
      },
    ],
    0,
    "20",
  );
  assert.equal(r.weekly, 0n);
});
test("stale and illiquid positions do not qualify", () => {
  const now = Date.now();
  assert.equal(
    eligibleRank(
      decimal("200"),
      decimal("5"),
      10001,
      new Date(now).toISOString(),
      true,
      now,
    ),
    true,
  );
  assert.equal(
    eligibleRank(
      decimal("200"),
      decimal("5"),
      9999,
      new Date(now).toISOString(),
      true,
      now,
    ),
    false,
  );
  assert.equal(
    eligibleRank(
      decimal("200"),
      decimal("5"),
      20000,
      new Date(now - 121000).toISOString(),
      true,
      now,
    ),
    false,
  );
});
test("charts reject invalid candles and never fill missing history", () => {
  const c = { time: 1, open: 2, high: 3, low: 1, close: 2, volume: null };
  assert.equal(cleanCandles([c, c, { ...c, time: 100, high: 0 }]).length, 1);
});
test("row figures follow the active sort and never substitute FDV for market cap", () => {
  const asset = {
    ...emptyAsset("a"),
    marketCap: 6_500_000,
    fdv: 90_000_000,
    volume24h: 1_200_000,
    liquidity: 250_000,
  };
  assert.equal(assetMarketSummary(asset), "$6.5M MC");
  // No figure reads as a dash, never as a false zero.
  assert.equal(assetMarketSummary({ ...asset, marketCap: null }), "— MC");
  assert.equal(assetMarketSummary({ ...asset, marketCap: NaN }), "$0 MC");
  assert.equal(assetSortMetric(asset, "cap"), "$6.5M MC");
  assert.equal(assetSortMetric(asset, "volume"), "$1.2M vol");
  assert.equal(assetSortMetric({ ...asset, volume24h: null }, "volume"), "— vol");
  // Not a reward stonk: no yield, shown as zero rather than N/A.
  assert.equal(assetSortMetric(asset, "apr"), "0% APR");
  const reward = {
    ...asset,
    stonk: {
      deployment: "test",
      kind: "reward" as const,
      payoutMint: "zec",
      payoutSymbol: "ZEC",
      taxBps: 300,
      stage: null,
      eligibility: null,
      evidence: "",
    },
  };
  // 1.2M * 3% * 365 / 6.5M = 202%
  assert.equal(assetSortMetric(reward, "apr"), "202% APR");
});

test("Estimated APR needs a reward stonk with tax, volume, market cap and a real market; sorts unknowns last", () => {
  const reward = {
    ...emptyAsset("a"),
    marketCap: 1_000_000,
    volume24h: 100_000,
    liquidity: 50_000,
    stonk: {
      deployment: "d",
      kind: "reward" as const,
      payoutMint: ZCAT,
      payoutSymbol: "ZCAT",
      taxBps: 300,
      stage: null,
      eligibility: null,
      evidence: "",
    },
  };
  // 100k * 3% * 365 / 1M = 109.5%
  assert.equal(stonkApr(reward)?.toFixed(1), "109.5");
  assert.equal(stonkApr({ ...reward, stonk: { ...reward.stonk, kind: "standard" } }), null);
  assert.equal(stonkApr({ ...reward, stonk: { ...reward.stonk, taxBps: null } }), null);
  assert.equal(stonkApr({ ...reward, marketCap: null }), null);
  assert.equal(stonkApr({ ...reward, volume24h: 0 }), null);
  // Thin markets are ineligible even with huge ratios.
  assert.equal(stonkApr({ ...reward, marketCap: 3_800, volume24h: 170_000 }), null);
  assert.equal(stonkApr({ ...reward, liquidity: 5_000 }), null);
  // Unreported liquidity is not a disqualifier: the feed omits it for majors.
  assert.equal(stonkApr({ ...reward, liquidity: null })?.toFixed(1), "109.5");
  const weaker = { ...reward, mint: "b", volume24h: 10_000 };
  const unknown = { ...emptyAsset("c"), marketCap: 5, volume24h: 5 };
  assert.deepEqual(
    filterAssets([unknown, weaker, reward], {}, "apr").map((x) => x.mint),
    ["a", "b", "c"],
  );
  // Ascending flips eligible assets but still keeps unknowns last.
  assert.deepEqual(
    filterAssets([unknown, weaker, reward], {}, "apr", [], Date.now(), "asc").map(
      (x) => x.mint,
    ),
    ["b", "a", "c"],
  );
});

test("unsafe links never render", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
});
