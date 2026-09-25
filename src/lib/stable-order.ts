import { useMemo, useRef } from "react";

/**
 * Rows in the order they were first shown. Live lists refetch every few
 * seconds; re-sorting them under a thumb makes a tap land on the wrong row.
 * Rows keep their place while their values update, new rows append, rows
 * that left drop out. An explicit refresh starts a fresh order.
 */
export function stableOrder<T>(
  previous: readonly string[],
  rows: readonly T[],
  key: (row: T) => string,
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(key(row), row);
  const out: T[] = [];
  for (const k of previous) {
    const row = byKey.get(k);
    if (row === undefined) continue;
    out.push(row);
    byKey.delete(k);
  }
  for (const row of rows) {
    const k = key(row);
    if (!byKey.has(k)) continue;
    out.push(row);
    byKey.delete(k);
  }
  return out;
}

/** `stableOrder` across renders; the order restarts whenever `resetToken` changes. */
export function useStableOrder<T>(
  rows: readonly T[] | undefined,
  key: (row: T) => string,
  resetToken: unknown,
): T[] {
  const order = useRef<{ token: unknown; keys: string[] }>({ token: resetToken, keys: [] });
  return useMemo(() => {
    if (order.current.token !== resetToken) order.current = { token: resetToken, keys: [] };
    const ordered = stableOrder(order.current.keys, rows || [], key);
    order.current.keys = ordered.map(key);
    return ordered;
  }, [rows, key, resetToken]);
}
