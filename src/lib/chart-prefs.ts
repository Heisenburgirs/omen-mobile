import type { Period } from "../domain/models";

/**
 * The chart the user last asked for. Leaving a token page and coming back,
 * or opening another token, keeps the same timeframe and chart style instead
 * of resetting to the defaults.
 */
export type ChartPrefs = { period: Period; candlestick: boolean };
const PERIODS: Period[] = ["1H", "4H", "24H", "7D", "30D", "All"];
const KEY = "omen.chart.prefs";
let current: ChartPrefs = { period: "24H", candlestick: false };
let loading: Promise<ChartPrefs> | null = null;

export const chartPrefs = (): ChartPrefs => current;

export function parseChartPrefs(raw: string | null | undefined): ChartPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChartPrefs> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      period: PERIODS.includes(parsed.period as Period) ? (parsed.period as Period) : current.period,
      candlestick: typeof parsed.candlestick === "boolean" ? parsed.candlestick : current.candlestick,
    };
  } catch {
    return null;
  }
}

// The native store is loaded lazily so the pure parts run in plain Node tests.
const store = () => import("./secure-store");

/** Reads the saved preference once; later calls return the same promise. */
export function loadChartPrefs(): Promise<ChartPrefs> {
  loading ??= store()
    .then((s) => s.getItemAsync(KEY))
    .then((raw) => {
      const saved = parseChartPrefs(raw);
      if (saved) current = saved;
      return current;
    })
    .catch(() => current);
  return loading;
}

export function saveChartPrefs(next: Partial<ChartPrefs>): ChartPrefs {
  current = { ...current, ...next };
  void store()
    .then((s) => s.setItemAsync(KEY, JSON.stringify(current)))
    .catch(() => undefined);
  return current;
}
