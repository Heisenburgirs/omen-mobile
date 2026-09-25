import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "./privy";
import { config } from "../config";
import type { Envelope } from "../domain/models";
export class MobileError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function mobileFetch<T>(
  resource: string,
  params: Record<string, string>,
  token: string | null,
  signal?: AbortSignal,
  method = "GET",
  body?: unknown,
): Promise<Envelope<T>> {
  const query = new URLSearchParams({ resource, ...params });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 30000);
  try {
    const r = await fetch(config.apiUrl + "/api/mobile?" + query, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    let d: any;
    try {
      d = await r.json();
    } catch {
      throw new MobileError("Could not reach OMEN. Please retry.", 503);
    }
    if (!r.ok) throw new MobileError(d.error || "Please try again.", r.status);
    return d;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
/**
 * What the backend serves without a session: the market itself (search,
 * a token, its figures and its chart). A visitor who has not signed in yet
 * can browse these; everything else waits for an account.
 */
export const PUBLIC_RESOURCES = ["assets", "asset", "stats", "candles"];
export function useMobile<T>(
  resource: string,
  params: Record<string, string> = {},
  enabled = true,
  interval = 20000,
  options: {
    /**
     * Keep showing the last result while a changed request loads, e.g. the
     * chart of the previous timeframe, so the layout never collapses to a
     * placeholder between two views of the same thing.
     */
    keepPrevious?: boolean;
    /**
     * What to show until the first result arrives, e.g. the token as the list
     * that was tapped already knows it, so the page opens with content.
     */
    placeholder?: Envelope<T>;
  } = {},
) {
  const { user, getAccessToken } = usePrivy();
  return useQuery({
    queryKey: ["mobile", user?.id, resource, params],
    queryFn: async ({ signal }) =>
      mobileFetch<T>(resource, params, user ? await getAccessToken() : null, signal),
    enabled: enabled && (Boolean(user) || PUBLIC_RESOURCES.includes(resource)),
    refetchInterval: interval || false,
    refetchIntervalInBackground: false,
    placeholderData: options.placeholder
      ? options.placeholder
      : options.keepPrevious
        ? keepPreviousData
        : undefined,
    retry: (count, e) =>
      count < 1 &&
      !(
        e instanceof MobileError && [400, 401, 403, 404, 503].includes(e.status)
      ),
  });
}
/**
 * Warms the cache for a request the user is likely to make next (the other
 * chart timeframes, say), under the same key `useMobile` will read.
 */
export function usePrefetchMobile() {
  const { user, getAccessToken } = usePrivy();
  const client = useQueryClient();
  return (resource: string, params: Record<string, string> = {}, staleMs = 10000) => {
    if (!user && !PUBLIC_RESOURCES.includes(resource)) return;
    void client.prefetchQuery({
      queryKey: ["mobile", user?.id, resource, params],
      queryFn: async ({ signal }) =>
        mobileFetch(resource, params, user ? await getAccessToken() : null, signal),
      staleTime: staleMs,
    });
  };
}
export function useMobileAction() {
  const { getAccessToken } = usePrivy();
  const client = useQueryClient();
  return async <T>(resource: string, body: unknown, method = "POST") => {
    const result = await mobileFetch<T>(
      resource,
      {},
      await getAccessToken(),
      undefined,
      method,
      body,
    );
    void client.invalidateQueries({ queryKey: ["mobile"] });
    return result;
  };
}
