export function assertWalletRequestActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw { code: "ERROR_ASSOCIATION_CANCELLED" };
}

// Bound native wallet handoffs, reject stale results, and let the UI cancel.
export function runWalletRequest<T>(run: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: { error: unknown } | { value: T }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if ("error" in outcome) reject(outcome.error); else resolve(outcome.value);
    };
    const cancel = () => { controller.abort(); finish({ error: { code: "ERROR_ASSOCIATION_CANCELLED" } }); };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => { controller.abort(); finish({ error: { code: "ERROR_SESSION_TIMEOUT" } }); }, timeoutMs);
    Promise.resolve().then(() => { assertWalletRequestActive(controller.signal); return run(controller.signal); })
      .then(value => finish({ value }), error => finish({ error }));
  });
}
