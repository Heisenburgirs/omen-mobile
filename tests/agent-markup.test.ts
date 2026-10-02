import assert from "node:assert/strict";
import test from "node:test";
import { blocks, segments, urlLabel } from "../src/agent/markup";
import { dexRef, mergeRefs, postRefs, tokenRef, type MessageRefs } from "../src/agent/refs";

const refs: MessageRefs = {
  tokens: [
    { symbol: "PUMPE", name: "Pumpkin Pepe", mint: "9fJAW", price: 0.00046, change24h: 10494, marketCap: 459_887, liquidity: 63_340, volume24h: 1_291_954, ageHours: 6 },
    { symbol: "GG", mint: "gg1", price: null, change24h: null, marketCap: null, liquidity: null, volume24h: null, ageHours: null },
  ],
  posts: [{ handle: "TrenchWatchX", url: "https://x.com/TrenchWatchX/status/1234" }],
};

test("a reply's tickers, handles, links and signed figures become segments", () => {
  const segs = segments("$PUMPE is up 10,218% in a day; @TrenchWatchX reports a -55% exit. See https://x.com/TrenchWatchX/status/1234 and $ZZZ.", refs);
  const kinds = segs.map((s) => s.kind + ":" + s.text);
  assert.ok(kinds.includes("ticker:$PUMPE"));
  assert.ok(kinds.includes("number:10,218%"));
  assert.ok(kinds.includes("handle:@TrenchWatchX"));
  assert.ok(kinds.includes("number:-55%"));
  assert.ok(kinds.some((k) => k.startsWith("url:https://x.com/TrenchWatchX/status/1234")));
  const unknown = segs.find((s) => s.kind === "ticker" && s.text === "$ZZZ");
  assert.ok(unknown && unknown.kind === "ticker" && unknown.token === null);
  const up = segs.find((s) => s.kind === "number" && s.text === "10,218%");
  assert.ok(up && up.kind === "number" && up.direction === "up");
  const handle = segs.find((s) => s.kind === "handle");
  assert.ok(handle && handle.kind === "handle" && handle.url === "https://x.com/TrenchWatchX/status/1234");
});

test("a bare known symbol links too, a plain word does not, and a handle without a post opens the profile", () => {
  const segs = segments("PUMPE and GG look alike, but GAIN is a word. Ask @someoneelse.", refs);
  const tickers = segs.filter((s) => s.kind === "ticker").map((s) => s.text);
  assert.deepEqual(tickers, ["PUMPE", "GG"]);
  const handle = segs.find((s) => s.kind === "handle");
  assert.ok(handle && handle.kind === "handle" && handle.url === "https://x.com/someoneelse");
  const plain = segs.filter((s) => s.kind === "text").map((s) => s.text).join("");
  assert.ok(plain.includes("GAIN is a word"));
});

test("a token with figures gets one card: after a short title line, before a full paragraph", () => {
  const out = blocks("Two picks.\n\n1. $PUMPE: thin liquidity.\n\n2. $GG: no figures yet.\n\n$PUMPE again.", refs);
  const cards = out.filter((b) => b.kind === "card");
  assert.equal(cards.length, 1);
  assert.equal(out[1]?.kind, "paragraph");
  assert.equal(out[2]?.kind, "card");
  assert.equal(out.filter((b) => b.kind === "paragraph").length, 4);
  const long = blocks("$PUMPE has thin liquidity and a one-day chart, which is why the volume ratio looks like churn more than demand.", refs);
  assert.equal(long[0]?.kind, "card");
  const bullets = blocks("Picks:\n* $GG: nothing yet\n* $PUMPE: cooking", refs);
  const kinds = bullets.map((b) => b.kind);
  assert.deepEqual(kinds, ["paragraph", "paragraph", "paragraph", "card"]);
});

test("labels and refs read cleanly", () => {
  assert.equal(urlLabel("https://x.com/TrenchWatchX/status/1234"), "@TrenchWatchX on X");
  assert.equal(urlLabel("https://www.example.com/a/very/long/path/that/keeps/going/on"), "example.com/a/very/long/path/that…");
  const merged = mergeRefs(
    { tokens: [{ symbol: "pumpe", price: 1 }], posts: [{ handle: "a" }] },
    { tokens: [{ symbol: "PUMPE", mint: "m", price: 2 }], posts: [{ handle: "A", url: "https://x.com/A/status/1" }] },
  );
  assert.equal(merged.tokens.length, 1);
  assert.equal(merged.tokens[0]?.mint, "m");
  assert.equal(merged.posts.length, 1);
  assert.equal(merged.posts[0]?.url, "https://x.com/A/status/1");
  assert.equal(tokenRef({ symbol: "X", mint: "m", price: "0.5", marketCap: 10, ageDays: 2 })?.ageHours, 48);
  assert.equal(dexRef({ symbol: "HOOKED", address: "C1m", fdv: 5e6 })?.mint, "C1m");
  assert.deepEqual(postRefs([{ by: "@t1", url: "u" }, { by: "@?" }]), [{ handle: "t1", url: "u" }]);
});

test("markdown the model slips in is read, not shown, and a contract address becomes a short copy link", () => {
  const out = blocks("Here's the breakdown:\n\n*   **The Play:** $PUMPE (9fJAWKQpkY93hfuZxrHfh5wEh2AV9vjkWNQfzfbziHd2)\n*   **Risk:** thin\n\n### What changes my mind\nVolume dying.", refs);
  const paragraphs = out.filter((b) => b.kind === "paragraph");
  const second = paragraphs[1];
  assert.ok(second && second.kind === "paragraph");
  const kinds = second.segments.map((s) => `${s.kind}:${s.text}`);
  assert.ok(kinds.includes("strong:The Play:"), kinds.join("|"));
  assert.ok(kinds.includes("address:9fJA…iHd2"), kinds.join("|"));
  const addr = second.segments.find((s) => s.kind === "address");
  assert.ok(addr && addr.kind === "address" && addr.address === "9fJAWKQpkY93hfuZxrHfh5wEh2AV9vjkWNQfzfbziHd2");
  assert.ok(second.segments.some((s) => s.kind === "text" && s.text.startsWith("• ")));
  assert.ok(!kinds.some((k) => k.includes("**")));
  const third = paragraphs.find((b) => b.kind === "paragraph" && b.segments[0]?.kind === "strong" && b.segments[0].text === "What changes my mind");
  assert.ok(third, "header paragraph");
});

test("multiples read as one figure, and handles carry who the account is", () => {
  const segs = segments("It went up 9.7x since the call, then -2.1x is nonsense but +$1.2M is not.", refs);
  const figures = segs.filter((s) => s.kind === "number").map((s) => s.text);
  assert.deepEqual(figures, ["9.7x", "-2.1x", "+$1.2M"]);
  const merged = mergeRefs(
    { tokens: [], posts: [{ handle: "big", followers: 120_000 }] },
    { tokens: [], posts: [{ handle: "Big", followers: 90_000, verified: true, since: 2019, url: "https://x.com/big/status/1" }] },
  );
  assert.deepEqual(merged.posts, [{ handle: "big", url: "https://x.com/big/status/1", followers: 120_000, verified: true, since: 2019 }]);
});

test("follower tiers and launchpads read at a glance", async () => {
  const { followerTier, launchpadOf } = await import("../src/agent/refs");
  assert.deepEqual([500, 1_000, 10_000, 30_000, 50_000, 100_000, null].map((f) => followerTier(f).label), ["<1K", "1K+", "10K+", "30K+", "50K+", "100K+", "<1K"]);
  assert.equal(launchpadOf("AeLjtNe7rBpnxdJeqSSBnJ5NcPnuejpY7mhLsyMNpump", "pumpswap"), "pump.fun");
  assert.equal(launchpadOf("9fJAW", "raydium", true), "stonk");
  assert.equal(launchpadOf("abcbonk", "raydium"), "launchlab");
  assert.equal(launchpadOf("9fJAW", "raydium"), null);
});
