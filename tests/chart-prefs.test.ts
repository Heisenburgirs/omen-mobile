import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseChartPrefs } from "../src/lib/chart-prefs";

test("saved chart preferences are validated before use", () => {
  assert.deepEqual(parseChartPrefs('{"period":"4H","candlestick":true}'), { period: "4H", candlestick: true });
  // Unknown values fall back to the current defaults rather than breaking the chart.
  assert.deepEqual(parseChartPrefs('{"period":"2Y","candlestick":"yes"}'), { period: "24H", candlestick: false });
  assert.equal(parseChartPrefs("not json"), null);
  assert.equal(parseChartPrefs(null), null);
  assert.equal(parseChartPrefs("[]"), null);
});
