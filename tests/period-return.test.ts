import test from "node:test";
import assert from "node:assert/strict";
import {
  decimal,
  periodPnl,
  periodReturnPercent,
} from "../src/domain/accounting";

const start = 1_000,
  end = 101_000;
test("period return preserves gains and losses without cash flows", () => {
  assert.equal(
    periodReturnPercent(decimal("199"), decimal("995"), start, end, []),
    20,
  );
  assert.equal(
    periodReturnPercent(decimal("-20"), decimal("100"), start, end, []),
    -20,
  );
});
test("new deposits and dividends cannot create a positive return", () => {
  const pnl = periodPnl(
    decimal("100"),
    decimal("250"),
    decimal("100"),
    decimal("50"),
    true,
  );
  assert.equal(
    periodReturnPercent(pnl, decimal("100"), start, end, [
      { amount: decimal("100"), time: 51_000 },
      { amount: decimal("50"), time: 76_000 },
    ]),
    0,
  );
});
test("return adjusts for when cash enters and leaves the account", () => {
  assert.equal(
    periodReturnPercent(decimal("30"), decimal("100"), start, end, [
      { amount: decimal("100"), time: 51_000 },
    ]),
    20,
  );
  assert.equal(
    periodReturnPercent(decimal("15"), decimal("100"), start, end, [
      { amount: decimal("-50"), time: 51_000 },
    ]),
    20,
  );
});
test("incomplete history, invalid flow times and nonpositive capital have no return percentage", () => {
  assert.equal(periodReturnPercent(null, decimal("100"), start, end, []), null);
  assert.equal(periodReturnPercent(decimal("10"), null, start, end, []), null);
  assert.equal(periodReturnPercent(0n, 0n, start, end, []), null);
  assert.equal(
    periodReturnPercent(decimal("10"), decimal("100"), start, end, [
      { amount: decimal("20"), time: Number.NaN },
    ]),
    null,
  );
  assert.equal(
    periodReturnPercent(decimal("10"), decimal("100"), start, end, [
      { amount: decimal("20"), time: end + 1 },
    ]),
    null,
  );
  assert.equal(
    periodReturnPercent(decimal("10"), decimal("100"), start, end, [
      { amount: decimal("-200"), time: start },
    ]),
    null,
  );
});
