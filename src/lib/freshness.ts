import { useEffect, useState, useSyncExternalStore } from "react";

export type Freshness = "fresh" | "delayed" | "unavailable";

/**
 * Whether a live figure may still be called live. Data older than
 * `maxAgeMs`, or data whose latest refresh failed, is "delayed": it stays on
 * screen but the UI must say so instead of presenting a stale price as live.
 */
export function freshness(input: {
  hasData: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  now: number;
  maxAgeMs: number;
}): Freshness {
  if (!input.hasData) return "unavailable";
  // Placeholder data (the token as the list knew it) has no fetch time yet;
  // the first request is in flight, and its failure would show as an error.
  if (!input.dataUpdatedAt) return "fresh";
  const age = input.now - input.dataUpdatedAt;
  // One failed refresh of a figure fetched moments ago is not a delay worth
  // a banner; it becomes one when the figure has aged a third of the limit.
  if (input.isError && age > input.maxAgeMs / 3) return "delayed";
  if (age > input.maxAgeMs) return "delayed";
  return "fresh";
}

/** The clock-time label shown next to a delayed figure. */
export function updatedAtLabel(dataUpdatedAt: number): string {
  if (!Number.isFinite(dataUpdatedAt) || dataUpdatedAt <= 0) return "";
  return new Date(dataUpdatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---- Which live sources are delayed right now, for one banner at the top ----
const delayed = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: string[] = [];
const publish = () => {
  snapshot = [...delayed].sort();
  listeners.forEach((l) => l());
};
/** Marks a named source delayed or fresh; the banner shows while any is delayed. */
export function reportFreshness(source: string, state: Freshness) {
  const was = delayed.has(source);
  if (state === "delayed") delayed.add(source);
  else delayed.delete(source);
  if (was !== delayed.has(source)) publish();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The delayed sources, newest snapshot; empty when everything is live. */
export function useDelayedSources(): string[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

type LiveQuery = { data: unknown; isError: boolean; dataUpdatedAt: number };

/**
 * `freshness` for a React Query result, re-evaluated every few seconds while
 * mounted. With `source`, the state is also reported for the top banner and
 * cleared when the screen goes away.
 */
export function useFreshness(query: LiveQuery, maxAgeMs: number, source?: string): Freshness {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const state = freshness({
    hasData: query.data !== undefined,
    isError: query.isError,
    dataUpdatedAt: query.dataUpdatedAt,
    now,
    maxAgeMs,
  });
  useEffect(() => {
    if (!source) return;
    reportFreshness(source, state);
    return () => reportFreshness(source, "fresh");
  }, [source, state]);
  return state;
}
