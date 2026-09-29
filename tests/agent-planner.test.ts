import { test } from "node:test";
import assert from "node:assert/strict";
import { isSmallTalk, keywordPlan, planFromAnswers, planQuestions, USE } from "../src/agent/planner";
import { emptyPresets, learn, recall, signature, TRUST_AFTER } from "../src/agent/presets";
import { periodOf, tradeArgsOf, TOOLS } from "../src/agent/registry";

test("Jev gets one question per tool plus the kind of answer, within the site's cap", () => {
  const q = planQuestions();
  assert.equal(Object.keys(q).length, TOOLS.length + 2);
  assert.ok(Object.keys(q).length <= 32);
  assert.equal(q.tier.type, "choice");
  assert.equal(q.use_balance.type, "boolean");
});

test("the plan takes every tool above the threshold, or the likeliest one", () => {
  const plan = planFromAnswers({
    tier: { type: "choice", choice: "judge" },
    use_balance: { type: "boolean", probability: 0.8 },
    use_asset: { type: "boolean", probability: 0.9 },
    use_market: { type: "boolean", probability: 0.2 },
  });
  assert.deepEqual(plan.tools, ["asset", "balance"]);
  assert.equal(plan.tier, "judge");
  const weak = planFromAnswers({ tier: { type: "choice", choice: "lookup" }, use_pnl: { type: "boolean", probability: 0.4 } });
  assert.deepEqual(weak.tools, ["pnl"]);
  const chat = planFromAnswers({ tier: { type: "choice", choice: "chat" }, use_balance: { type: "boolean", probability: USE + 0.1 } });
  assert.deepEqual(chat.tools, []);
});

test("the keyword plan reads the obvious requests and their kind of answer", () => {
  assert.deepEqual(keywordPlan("how is my portfolio performing this week").tools, ["balance", "pnl"]);
  assert.equal(keywordPlan("should I buy ZEC").tier, "judge");
  assert.equal(keywordPlan("what paid me this week").tier, "lookup");
  assert.ok(isSmallTalk("hi"));
  assert.ok(!isSmallTalk("should I buy ZEC"));
});

test("arguments come from the text: periods and trades", () => {
  assert.equal(periodOf("how did I do this week"), "7d");
  assert.equal(periodOf("pnl today"), "24h");
  assert.equal(periodOf("all time performance"), "All");
  assert.equal(periodOf("how am I doing"), undefined);
  assert.deepEqual(tradeArgsOf("buy 25 ZEC"), { side: "buy", amount: "25", symbol: "ZEC" });
  assert.deepEqual(tradeArgsOf("sell 0.5 $SOL"), { side: "sell", amount: "0.5", symbol: "SOL" });
});

test("one kind of request, one signature, whatever the token", () => {
  assert.equal(signature("Should I buy ZEC?"), signature("should i buy $SOL"));
  assert.notEqual(signature("should I buy ZEC"), signature("should I sell ZEC"));
});

test("a preset is trusted only once Jev agreed with itself, and habits follow use", () => {
  const sig = signature("how is my portfolio doing this week");
  const plan = { tools: ["balance", "pnl"], tier: "lookup" as const, source: "jev" as const };
  let doc = emptyPresets();
  doc = learn(doc, sig, plan, { period: "7d" });
  assert.equal(recall(doc, sig), null);
  for (let i = 1; i < TRUST_AFTER; i++) doc = learn(doc, sig, plan, { period: "7d" });
  assert.deepEqual(recall(doc, sig), { tools: ["balance", "pnl"], tier: "lookup", source: "preset" });
  assert.equal(doc.habits.pnlPeriod, "7d");
  doc = learn(doc, sig, { ...plan, tools: ["balance"] });
  assert.equal(recall(doc, sig), null, "a different plan restarts the preset");
});
