import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, mentionedSymbols, portfolioSummary } from "../src/agent/tools";

test("mentionedSymbols picks tickers the user named and skips filler", () => {
  assert.deepEqual(mentionedSymbols("Should I hold $ZEC or move into xSOL? I think SOL is fine"), ["ZEC", "xSOL", "SOL"]);
  assert.deepEqual(mentionedSymbols("what paid me this week"), []);
  assert.deepEqual(mentionedSymbols("I like ETF and AI"), []);
});

test("compact trims long data and rounds numbers", () => {
  assert.equal(compact({ a: 1.23456789 }), '{"a":1.234568}');
  const long = compact({ text: "x".repeat(5000) }, 100);
  assert.equal(long.length, 101);
  assert.ok(long.endsWith("…"));
});

test("portfolioSummary lists holdings largest first with a total", async () => {
  const fetch = (async () => ({
    data: {
      holdings: [
        { asset: { symbol: "USDC", mint: "u" }, valueUsd: "12.5" },
        { asset: { symbol: "ZEC", mint: "z" }, valueUsd: "100" },
        { asset: { symbol: "DUST", mint: "d" }, valueUsd: null },
      ],
    },
  })) as never;
  const text = await portfolioSummary(fetch);
  const parsed = JSON.parse(text);
  assert.equal(parsed.totalUsd, 112.5);
  assert.deepEqual(parsed.holdings.map((h: { symbol: string }) => h.symbol), ["ZEC", "USDC", "DUST"]);
});

test("guessIntent reads the obvious ones without Jev", async () => {
  const { guessIntent } = await import("../src/agent/intent");
  assert.equal(guessIntent("Hi"), "chat");
  assert.equal(guessIntent("what model is this"), "chat");
  assert.equal(guessIntent("What paid me this week?"), "dividends");
  assert.equal(guessIntent("how is my portfolio doing"), "portfolio");
  assert.equal(guessIntent("should I buy more ZEC"), "trade");
  assert.equal(guessIntent("tell me about $SOL"), "token");
  assert.equal(guessIntent("set up a drip into xSOL"), "drip");
});

test("the market scan carries each shortlisted token's peak, and findAssets too", async () => {
  const { marketScan, findAssets } = await import("../src/agent/tools");
  const calls: string[] = [];
  const fetch = (async (resource: string, params: Record<string, string> = {}) => {
    calls.push(resource);
    if (resource === "assets") return { data: [{ symbol: "BACKPACK", mint: "m1", price: 0.0006, marketCap: 500_000, liquidity: 60_000, volume24h: 200_000, createdAt: new Date().toISOString() }] };
    if (resource === "tokens") return { data: [] };
    if (resource === "peaks") {
      assert.equal(params.mints, "m1");
      return { data: { m1: { athMarketCap: 3_000_000, athAt: "x", hoursSinceAth: 72, fromAthPct: -83.3, lowSinceAthMarketCap: 480_000, peaked: true } } };
    }
    return { data: null };
  }) as never;
  const scan = await marketScan(fetch, "find me some gems");
  assert.match(scan.data, /"athMarketCap":3000000/);
  assert.match(scan.data, /"peaked":true/);
  const found = await findAssets(fetch, "BACKPACK");
  assert.match(found, /"fromAthPct":-83.3/);
});
