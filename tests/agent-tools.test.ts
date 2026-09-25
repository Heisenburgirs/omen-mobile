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
