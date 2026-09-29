import assert from "node:assert/strict";
import test from "node:test";
import { titleFrom } from "../src/agent/titles";

test("a short opening message is the title as written", () => {
  assert.equal(titleFrom("What paid me this week?"), "What paid me this week?");
  assert.equal(titleFrom("  should i buy more zec  "), "Should i buy more zec");
});

test("only the first sentence names the conversation", () => {
  assert.equal(titleFrom("How is my portfolio doing? Also check ZEC."), "How is my portfolio doing?");
  assert.equal(titleFrom("Sell half my SOL."), "Sell half my SOL");
});

test("a long message is cut at a word with an ellipsis", () => {
  const title = titleFrom("compare the dividend yield of every tokenized stock I hold against last month");
  assert.equal(title, "Compare the dividend yield of every…");
  assert.ok(title.length <= 43);
});

test("an empty message falls back to the attachment or a default", () => {
  assert.equal(titleFrom("", "statement.pdf"), "statement.pdf");
  assert.equal(titleFrom("   "), "New conversation");
});
