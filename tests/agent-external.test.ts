import assert from "node:assert/strict";
import test from "node:test";
import { postCount, sinceMinutes, solanaRefs, wantsTop, webQuery, xHandles, xPostId, xSearchQuery } from "../src/agent/extract";
import { guessIntent } from "../src/agent/intent";
import { isSmallTalk, keywordPlan, planFromAnswers, planQuestions } from "../src/agent/planner";
import { TOOLS, toolById, type ToolContext } from "../src/agent/registry";

test("X handles, post links, windows and counts come out of the words", () => {
  assert.deepEqual(xHandles("get latest 20 posts from @solana"), ["solana"]);
  assert.deepEqual(xHandles("what is https://x.com/aeyakovenko/status/1900000000000000001 about"), ["aeyakovenko"]);
  assert.deepEqual(xHandles("show me posts from zcash on X"), ["zcash"]);
  assert.deepEqual(xHandles("email me at a@b.com"), []);
  assert.equal(xPostId("https://x.com/solana/status/1900000000000000001?s=20"), "1900000000000000001");
  assert.equal(sinceMinutes("top $ZEC posts in the last hour"), 60);
  assert.equal(sinceMinutes("last 30 minutes"), 30);
  assert.equal(sinceMinutes("past 6 hours"), 360);
  assert.equal(sinceMinutes("what happened today"), 1440);
  assert.equal(sinceMinutes("hello"), undefined);
  assert.equal(postCount("get latest 20 posts from @solana"), 20);
  assert.equal(postCount("last 5 tweets"), 5);
  assert.equal(wantsTop("top posts about ZEC"), true);
  assert.equal(wantsTop("latest posts about ZEC"), false);
  assert.equal(xSearchQuery("what are people saying about $ZEC on X"), "$ZEC");
  assert.equal(xSearchQuery("what is twitter saying about tokenized stocks"), "tokenized stocks");
  assert.equal(webQuery("search the web for zcash etf news"), "zcash etf news");
});

test("Solana addresses and signatures are told apart", () => {
  const sig = ("5".repeat(10) + "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789abcdefghijkmnopqrstuvwxyzAB").slice(0, 88);
  const refs = solanaRefs(`check EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v and tx ${sig}`);
  assert.deepEqual(refs.addresses, ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]);
  assert.equal(refs.signatures.length, 1);
});

test("messages about X, the web and the chain are not small talk and plan the right lookup", () => {
  assert.equal(guessIntent("get latest 20 posts from @solana"), "x");
  assert.equal(isSmallTalk("get latest 20 posts from @solana"), false);
  assert.deepEqual(keywordPlan("get latest 20 posts from @solana").tools, ["x_posts"]);
  assert.deepEqual(keywordPlan("who is @zcash on twitter, followers?").tools, ["x_profile"]);
  assert.deepEqual(keywordPlan("what's twitter saying about $ZEC in the last hour").tools, ["x_search"]);
  assert.deepEqual(keywordPlan("replies to https://x.com/solana/status/1900000000000000001").tools, ["x_replies"]);
  assert.deepEqual(keywordPlan("what does wallet Bg8rSP2cfFRRSwj2wVeji6g2fJvwywyS3XUQTxafV7jE hold").tools, ["chain_lookup"]);
  assert.deepEqual(keywordPlan("any news on the zcash etf").tools, ["web_search"]);
});

test("Jev is asked about every tool within the route's question limit", () => {
  const questions = planQuestions(TOOLS);
  assert.ok(Object.keys(questions).length <= 32, `${Object.keys(questions).length} questions`);
  for (const id of ["x_posts", "x_profile", "x_mentions", "x_search", "x_replies", "web_search", "web_research", "chain_lookup"]) {
    assert.ok(questions[`use_${id}`], id);
  }
});

test("one source: an account's posts do not pull in X search and a web search too", () => {
  const b = (probability: number) => ({ type: "boolean" as const, probability });
  const plan = planFromAnswers({
    tier: { type: "choice", choice: "lookup" },
    source: { type: "choice", choice: "x_account" },
    use_x_posts: b(0.95),
    use_x_search: b(0.8),
    use_web_search: b(0.7),
    use_balance: b(0.1),
  });
  assert.deepEqual(plan.tools, ["x_posts"]);
  // Outside the source, only near certainty adds a paid lookup, and never more than two in all.
  const wide = planFromAnswers({
    tier: { type: "choice", choice: "explain" },
    source: { type: "choice", choice: "x_topic" },
    use_x_search: b(0.95),
    use_web_search: b(0.93),
    use_x_profile: b(0.92),
    use_asset: b(0.8),
  });
  assert.deepEqual(wide.tools, ["x_search", "web_search", "asset"]);
  // A source whose tools Jev was unsure of still gets its likeliest one.
  const unsure = planFromAnswers({
    tier: { type: "choice", choice: "lookup" },
    source: { type: "choice", choice: "chain" },
    use_chain_lookup: b(0.5),
    use_web_search: b(0.55),
  });
  assert.deepEqual(unsure.tools, ["chain_lookup"]);
});

function context(text: string, calls: Array<{ tool: string; input: Record<string, unknown> }>, funded = true): ToolContext {
  return {
    text,
    fetch: (async () => ({ data: null })) as unknown as ToolContext["fetch"],
    search: async () => [],
    habits: {},
    ...(funded
      ? {
          paid: async (tool: string, input: Record<string, unknown>) => {
            calls.push({ tool, input });
            return {
              data: {
                posts: [
                  {
                    id: "1",
                    url: "https://x.com/solana/status/1",
                    text: "Alpenglow is live",
                    createdAt: "2026-09-29T10:00:00Z",
                    author: { userName: "solana", followers: 3_000_000, accountCreatedAt: "2018-03-01T00:00:00Z", verified: true, automated: false },
                    likes: 900,
                    reposts: 120,
                    replies: 80,
                    views: 250_000,
                  },
                ],
              },
              costMicro: 6020,
            };
          },
        }
      : {}),
  };
}

test("x_posts reads the named account's posts and reports what the call cost", async () => {
  const calls: Array<{ tool: string; input: Record<string, unknown> }> = [];
  const result = await toolById("x_posts")!.run(context("get latest 20 posts from @solana", calls));
  assert.deepEqual(calls, [{ tool: "x.user_posts", input: { userName: "solana" } }]);
  assert.equal(result.costMicro, 6020);
  assert.match(result.data, /"by":"@solana"/);
  assert.match(result.data, /"followers":3000000/);
  assert.match(result.data, /"accountSince":2018/);
  assert.match(result.data, /Alpenglow is live/);
});

test("x_search turns the message into a query, window and sort", async () => {
  const calls: Array<{ tool: string; input: Record<string, unknown> }> = [];
  await toolById("x_search")!.run(context("top posts about $ZEC in the last hour", calls));
  assert.deepEqual(calls[0], { tool: "x.search", input: { query: "$ZEC", sort: "top", pages: 1, sinceMinutes: 60 } });
});

test("a paid lookup without a funded agent says so instead of calling", async () => {
  await assert.rejects(toolById("x_posts")!.run(context("posts from @solana", [], false)), /fund the agent/);
  const noHandle = await toolById("x_posts")!.run(context("posts from x", []));
  assert.match(noHandle.data, /no X account named/);
});

test("a request for plays is market research, judged, with the market scan", async () => {
  const { isResearch } = await import("../src/agent/tools");
  for (const text of [
    "research new low caps/tokens i can buy that can potentially 10x",
    "find me some gems under $5m",
    "what should I buy today",
    "any good plays this week?",
  ]) {
    assert.ok(isResearch(text), text);
    assert.equal(guessIntent(text), "market", text);
    const plan = keywordPlan(text);
    assert.deepEqual(plan.tools, ["market"], text);
    assert.equal(plan.tier, "judge", text);
  }
  assert.equal(isResearch("what is my ZEC worth"), false);
});
