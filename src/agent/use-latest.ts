import { useRef } from "react";

/**
 * The latest value in a ref that never changes identity. The agent's
 * callbacks read Privy's functions and objects through this, because those
 * are new on every render: listing them as dependencies made every render
 * rebuild the callbacks, re-run the effects that call them, and loop.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
