import assert from "node:assert/strict";
import test from "node:test";
import { durableLine } from "../src/agent/durable";

test("USER.md keeps how the agent should behave or present things", () => {
  assert.equal(durableLine("style", "Keep answers short and skip the pleasantries"), "style: Keep answers short and skip the pleasantries");
  assert.equal(durableLine("preference", "Always show percentages, not raw amounts"), "preference: Always show percentages, not raw amounts");
});

test("USER.md never keeps money, holdings, goals or token wishes", () => {
  assert.equal(durableLine("holding", "I hold 500 ZEC and some xSOL"), null);
  assert.equal(durableLine("goal", "Find me the next Orbiod on Robinhood chain"), null);
  assert.equal(durableLine("other", "I have $500 to play with"), null);
  assert.equal(durableLine("preference", "I have $500 to play with"), null);
  assert.equal(durableLine("style", "My budget is 2k usd, size trades from that"), null);
  assert.equal(durableLine("preference", "Buy anything that can 10x"), null);
  assert.equal(durableLine("style", ""), null);
});
