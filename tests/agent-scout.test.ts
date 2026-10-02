import assert from "node:assert/strict";
import test from "node:test";
import { candidatesFrom, cashtagsIn, leadPost, postIdOf, xActivity, type WriterPost } from "../src/agent/scout";

const now = Date.UTC(2026, 9, 2, 12);
const post = (by: string, text: string, extra: Partial<WriterPost> = {}): WriterPost => ({
  by,
  text,
  followers: 2_000,
  accountSince: 2021,
  at: new Date(now - 3600e3).toISOString(),
  likes: 10,
  replies: 2,
  reposts: 1,
  url: `https://x.com/${by.slice(1)}/status/1${by.length}2345`,
  ...extra,
});

test("cashtags skip majors, numbers and words that only look like tickers", () => {
  assert.deepEqual(cashtagsIn("$HOOKED is cooking, $SOL and $BTC are not plays, $100 is money, $ca no"), ["HOOKED"]);
});

test("candidates are tickers several accounts name, shill lists left out, the user's own excluded", () => {
  const posts = [
    post("@a", "$ABC just launched, sending"),
    post("@b", "$ABC CA below"),
    post("@c", "$ABC $DEF $GHI $JKL $MNO $PQR all going"),
    post("@d", "$DEF looks early", { followers: 50 }),
    post("@e", "$HOOKED again"),
    post("@f", "$HOOKED again"),
    post("@whale", "$ZZZ aped", { followers: 80_000 }),
  ];
  const c = candidatesFrom(posts, ["hooked"]);
  assert.deepEqual(
    c.map((x) => x.symbol),
    ["ABC", "ZZZ"],
  );
  assert.equal(c[0]?.accounts, 2);
});

test("the X score rewards many real accounts talking now and discounts a bot farm", () => {
  const lively = Array.from({ length: 20 }, (_, i) => post(`@user${i}`, `$ABC is the play`, { followers: 5_000 + i * 1000, likes: 40, replyTo: i % 3 === 0 ? "@user0" : undefined }));
  const farm = Array.from({ length: 20 }, (_, i) => post(`@bot${i}`, `$ABC 100x`, { followers: 10, accountSince: 2026, automated: true, likes: 0 }));
  const a = xActivity(lively, now);
  const b = xActivity(farm, now);
  assert.ok(a.score > 70, String(a.score));
  assert.ok(b.score < 30, String(b.score));
  assert.equal(a.accounts, 20);
  assert.equal(a.recentShare, 1);
  assert.equal(b.weakShare, 1);
  assert.ok(a.threads >= 1);
  assert.equal(a.topAccounts[0]?.handle, "@user19");
  assert.equal(xActivity([], now).score, 0);
});

test("the lead post is the most engaged one and its id comes from the url", () => {
  const posts = [post("@a", "x", { likes: 1 }), post("@b", "y", { likes: 50, replies: 10, url: "https://x.com/b/status/987654321" })];
  assert.equal(leadPost(posts)?.by, "@b");
  assert.equal(postIdOf(leadPost(posts)?.url), "987654321");
  assert.equal(postIdOf(undefined), undefined);
});

test("the dossier's X read: big accounts, calls carrying the CA, first seen", async () => {
  const { kolsOf, caCalls, firstSeen } = await import("../src/agent/dossier");
  const mint = "9fJAWKQpkY93hfuZxrHfh5wEh2AV9vjkWNQfzfbziHd2";
  const posts = [
    post("@big", "$ABC " + mint, { followers: 120_000, at: new Date(now - 5 * 3600e3).toISOString() }),
    post("@big", "$ABC again", { followers: 120_000 }),
    post("@mid", "$ABC CA: " + mint, { followers: 15_000 }),
    post("@small", "$ABC", { followers: 300 }),
  ];
  const kols = kolsOf(posts);
  assert.deepEqual(kols.map((k) => [k.handle, k.posts]), [["@big", 2], ["@mid", 1]]);
  assert.equal(caCalls(posts, mint), 2);
  assert.equal(firstSeen(posts), new Date(now - 5 * 3600e3).toISOString());
});
