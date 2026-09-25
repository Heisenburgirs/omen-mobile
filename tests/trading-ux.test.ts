import { strict as assert } from "node:assert";
import { test } from "node:test";
import { stableOrder } from "../src/lib/stable-order";
import { freshness, updatedAtLabel } from "../src/lib/freshness";

type Row = { mint: string; price: number };
const key = (r: Row) => r.mint;

test("a live list keeps its first order while values change", () => {
  const first: Row[] = [{ mint: "a", price: 1 }, { mint: "b", price: 2 }, { mint: "c", price: 3 }];
  const shown = stableOrder([], first, key);
  assert.deepEqual(shown.map(key), ["a", "b", "c"]);
  // The server now ranks c first and a last; the rows stay put, values update.
  const resorted: Row[] = [{ mint: "c", price: 9 }, { mint: "b", price: 2 }, { mint: "a", price: 0.5 }];
  const next = stableOrder(shown.map(key), resorted, key);
  assert.deepEqual(next.map(key), ["a", "b", "c"]);
  assert.equal(next[0]!.price, 0.5);
  assert.equal(next[2]!.price, 9);
});

test("new rows append and departed rows drop", () => {
  const next = stableOrder(["a", "b", "c"], [{ mint: "d", price: 4 }, { mint: "b", price: 2 }], key);
  assert.deepEqual(next.map(key), ["b", "d"]);
});

test("a duplicate key is shown once", () => {
  const next = stableOrder([], [{ mint: "a", price: 1 }, { mint: "a", price: 2 }], key);
  assert.equal(next.length, 1);
});

test("a figure is live only while its refresh is recent and succeeded", () => {
  const base = { hasData: true, isError: false, dataUpdatedAt: 1_000_000, maxAgeMs: 45_000 };
  assert.equal(freshness({ ...base, now: 1_030_000 }), "fresh");
  assert.equal(freshness({ ...base, now: 1_046_000 }), "delayed");
  // One failed refresh of a young figure is not a delay; it is once the
  // figure has aged a third of the limit.
  assert.equal(freshness({ ...base, now: 1_001_000, isError: true }), "fresh");
  assert.equal(freshness({ ...base, now: 1_016_000, isError: true }), "delayed");
  // Placeholder data has no fetch time yet: its request is in flight.
  assert.equal(freshness({ ...base, dataUpdatedAt: 0, now: 1_046_000 }), "fresh");
  assert.equal(freshness({ ...base, now: 1_001_000, hasData: false }), "unavailable");
});

test("the delayed label is a clock time or nothing", () => {
  assert.equal(updatedAtLabel(0), "");
  assert.match(updatedAtLabel(Date.UTC(2026, 8, 16, 12, 30)), /\d/);
});
