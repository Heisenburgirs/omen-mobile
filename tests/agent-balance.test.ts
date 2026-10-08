import assert from "node:assert/strict";
import test from "node:test";
import { guessIntent, isAgentBalance } from "../src/agent/intent";
import { MODELS } from "../src/agent/models";
import { keywordPlan } from "../src/agent/planner";
import { toolById, type ToolContext } from "../src/agent/registry";

test("questions about the agent's own money are told apart from the portfolio", () => {
  for (const text of [
    "what is my agent balance",
    "What's the agent's balance?",
    "how much do you have left",
    "how much have you spent",
    "what's your balance",
    "how much money is on the agent",
  ]) {
    assert.ok(isAgentBalance(text), text);
    assert.equal(guessIntent(text), "agent", text);
    assert.deepEqual(keywordPlan(text).tools, ["agent_balance"], text);
  }
  for (const text of ["what is my balance", "what's my portfolio worth", "how much ZEC do I have"]) {
    assert.equal(isAgentBalance(text), false, text);
  }
});

const ctx = (agent: ToolContext["agent"]): ToolContext => ({
  text: "what is my agent balance",
  fetch: (async () => {
    throw new Error("the agent's balance never goes to the network");
  }) as unknown as ToolContext["fetch"],
  search: async () => [],
  habits: {},
  ...(agent ? { agent } : {}),
});

test("the agent balance tool reads the channel, not the portfolio", async () => {
  const tool = toolById("agent_balance")!;
  const open = await tool.run(
    ctx(() => ({ state: "open", availableUsdc: 4.99, depositUsdc: 5, spentUsdc: 0.01, idleUsdc: 0 })),
  );
  assert.match(open.data, /"agentBalanceUsdc":"4\.99"/);
  assert.match(open.data, /"spentOnRepliesUsdc":"0\.01"/);

  const unfunded = await tool.run(
    ctx(() => ({ state: "none", availableUsdc: 0, depositUsdc: 0, spentUsdc: 0, idleUsdc: 0 })),
  );
  assert.match(unfunded.data, /not funded/);
});

test("the judge tier turns a model's default reasoning off so the budget goes to the reply", () => {
  assert.equal(MODELS.judge.reasoning, "none");
  assert.ok(MODELS.judge.maxTokens >= 1000);
  assert.equal(MODELS.chat.reasoning, undefined);
});

test("free credits count in the agent's balance and an invite says what the friend gets", async () => {
  const { inviteMessage } = await import("../src/agent/credits");
  const msg = inviteMessage("1234567", { refereeMicro: 5_000_000, referrerMicro: 2_000_000, seekerMicro: 5_000_000, feeDiscountBps: 5000 });
  assert.match(msg, /code 1234567/);
  assert.match(msg, /\$5 of free agent credits/);
  assert.match(msg, /50% off fees/);
  const tool = toolById("agent_balance")!;
  const ctx = { text: "what is my agent balance", agent: () => ({ state: "none", availableUsdc: 0, depositUsdc: 0, spentUsdc: 0, idleUsdc: 0, creditUsdc: 4.2 }) } as unknown as ToolContext;
  const out = await tool.run(ctx);
  assert.match(out.data, /"agentBalanceUsdc":"4.20"/);
  assert.match(out.data, /"ofWhichFreeCreditsUsdc":"4.20"/);
});
