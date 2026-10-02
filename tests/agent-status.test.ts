import assert from "node:assert/strict";
import test from "node:test";
import { statusLine, toolStatus, writingStatus } from "../src/agent/status";

test("a tool's status names what it is doing, with the argument it read from the message", () => {
  assert.equal(toolStatus("market", "research low caps"), "Scanning the market");
  assert.equal(toolStatus("x_posts", "latest 20 posts from @heisenburgirr"), "Reading @heisenburgirr's posts");
  assert.equal(toolStatus("x_search", "what is X saying about $PUMPE"), "Searching X for $PUMPE");
  assert.equal(toolStatus("web_search", "why did the market dump so hard this week and what happens next"), "Searching the web");
  assert.equal(toolStatus("chain_lookup", "what is in 9fJAWKQpkY93hfuZxrHfh5wEh2AV9vjkWNQfzfbziHd2"), "Looking at the wallet on chain");
  assert.equal(toolStatus("something_new", "x"), "Looking up something new");
});

test("the line shows one step at a time: the latest still running", () => {
  assert.equal(statusLine([]), "");
  assert.equal(statusLine(["Scanning the market"]), "Scanning the market");
  assert.equal(statusLine(["Scanning the market", "Searching X for $PUMPE"]), "Searching X for $PUMPE");
});

test("the writing step reads by the kind of answer", () => {
  assert.equal(writingStatus("judge"), "Thinking it through");
  assert.equal(writingStatus("chat"), "Writing");
});

