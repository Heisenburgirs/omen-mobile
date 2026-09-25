import test from "node:test";
import assert from "node:assert/strict";
import { formatApr } from "../src/domain/market";

test("APR figures stay short: decimals under 100, none to 1000, compact beyond", () => {
  assert.equal(formatApr(0), "0");
  assert.equal(formatApr(12.34), "12.3");
  assert.equal(formatApr(202.4), "202");
  assert.equal(formatApr(1000), "1K");
  assert.equal(formatApr(2500), "2.5K");
  assert.equal(formatApr(62269), "62.3K");
  assert.equal(formatApr(1_250_000), "1.3M");
});
