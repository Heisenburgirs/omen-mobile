import test from "node:test";
import assert from "node:assert/strict";
import { catalogue, followUpPrompt, parseFollowUp } from "../src/agent/followup";
import type { Tool } from "../src/agent/registry";

const tool = (id: string): Tool => ({ id, describe: "about " + id, kind: "read", source: "omen", run: async () => ({ data: "" }) });
const TOOLS = [tool("balance"), tool("asset"), tool("x_profile"), tool("x_search"), tool("web_search")];

test("the catalogue offers only lookups that take a name, not the portfolio reads", () => {
  const c = catalogue(TOOLS);
  assert.ok(c.includes("asset: about asset"));
  assert.ok(c.includes("x_profile"));
  assert.ok(!c.includes("balance"));
});

test("a follow-up keeps known tools, drops repeats and unknowns, and stops at three", () => {
  const already = [{ tool: "asset", text: "$ZDOG" }];
  const reply = 'Sure: {"calls":[{"tool":"asset","text":"$ZDOG"},{"tool":"x_profile","text":"@toly"},{"tool":"balance","text":"mine"},{"tool":"web_search","text":"zdog launch"},{"tool":"x_search","text":"$ZDOG replies"},{"tool":"x_search","text":"more"}]}';
  const calls = parseFollowUp(reply, TOOLS, already);
  assert.deepEqual(calls.map((c) => c.tool), ["x_profile", "web_search", "x_search"]);
  assert.equal(calls[0]!.text, "@toly");
});

test("no JSON, or no calls, means the data is enough", () => {
  assert.deepEqual(parseFollowUp("looks complete", TOOLS, []), []);
  assert.deepEqual(parseFollowUp('{"calls":[]}', TOOLS, []), []);
});

test("the prompt carries the question, the data and what was already asked", () => {
  const p = followUpPrompt("is $ZDOG a buy?", ["asset: ZDOG $98k cap"], TOOLS, [{ tool: "asset", text: "$ZDOG" }]);
  assert.ok(p.includes("is $ZDOG a buy?"));
  assert.ok(p.includes("ZDOG $98k cap"));
  assert.ok(p.includes("asset: $ZDOG"));
  assert.ok(p.includes('{"calls":[]}'));
});
