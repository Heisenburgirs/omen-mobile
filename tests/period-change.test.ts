import test from "node:test";
import assert from "node:assert/strict";
import { periodChange } from "../src/domain/market";

const candle = (time: number, open: number, close: number) => ({
  time,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume: 1,
});

test("the window change runs from the first open to the live price", () => {
  const move = periodChange([candle(1, 2, 2.5), candle(2, 2.5, 3)], 4);
  assert.ok(move);
  assert.equal(move.abs, 2);
  assert.equal(move.pct, 100);
});

test("without a live price the last close stands in", () => {
  const move = periodChange([candle(1, 4, 3), candle(2, 3, 2)], null);
  assert.ok(move);
  assert.equal(move.abs, -2);
  assert.equal(move.pct, -50);
});

test("an empty window has no change", () => {
  assert.equal(periodChange([], 1), null);
});
