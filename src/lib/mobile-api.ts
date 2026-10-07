import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { keys, policyFor, TOUCHES } from "./queries";
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
export const PUBLIC_RESOURCES: string[] = [];
const ready = (user: unknown, resource: string) => Boolean(user) || PUBLIC_RESOURCES.includes(resource);
const isPublic = (resource: string) => PUBLIC_RESOURCES.includes(resource);
/** The key's user: none for public market data, which is the same for everyone and shared across sign-in states. */
const owner = (user: { id?: string } | null | undefined, resource: string) => (isPublic(resource) ? undefined : user?.id);
/** The request's token: none for public market data, so the edge cache can serve it. */
const bearer = async (user: unknown, resource: string, getAccessToken: () => Promise<string | null>) =>
  user && !isPublic(resource) ? getAccessToken() : null;
/**
 * One request's answer, kept as `queries.ts` says for its resource: how
 * often it refreshes on screen, how long it is fresh, whether the previous
 * answer stays up while new params load, whether it is saved for the next
 * launch. `interval` and `options` override that for one call.
 */
export function useMobile<T>(
  resource: string,
  params: Record<string, string> = {},
  enabled = true,
  interval?: number,
  options: {
    /** Keep showing the last result while a changed request loads. */
    keepPrevious?: boolean;
    /** What to show until the first result arrives. */
    placeholder?: Envelope<T>;
  } = {},
) {
  const { user, getAccessToken } = usePrivy();
  const policy = policyFor(resource);
  return useQuery({
    queryKey: keys.query(owner(user, resource), resource, params),
    queryFn: async ({ signal }) =>
      mobileFetch<T>(resource, params, await bearer(user, resource, getAccessToken), signal),
    enabled: enabled && ready(user, resource),
    staleTime: policy.stale,
    refetchInterval: (interval ?? policy.interval) || false,
    refetchIntervalInBackground: false,
    placeholderData: options.placeholder
      ? options.placeholder
      : (options.keepPrevious ?? policy.keep)
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
 * A list that pages with a cursor (search results, history): every page
 * fetched so far, flattened and de-duplicated, with the next one a call
 * away. Pages are cached together under one key, so coming back to a list
 * shows all of it at once.
 */
export function useMobilePages<T>(
  resource: string,
  params: Record<string, string>,
  enabled: boolean,
  options: {
    /** What makes a row the same row across pages. */
    id: (row: T) => string;
    /** The cursor of the first page (the backend's "0" or ""). */
    first?: string;
  },
) {
  const { user, getAccessToken } = usePrivy();
  const policy = policyFor(resource);
  const first = options.first ?? "";
  const q = useInfiniteQuery({
    queryKey: keys.query(owner(user, resource), resource, params),
    queryFn: async ({ signal, pageParam }) =>
      mobileFetch<T[]>(
        resource,
        { ...params, ...(pageParam && pageParam !== first ? { cursor: pageParam } : {}) },
        await bearer(user, resource, getAccessToken),
        signal,
      ),
    initialPageParam: first,
    getNextPageParam: (last) => (last.nextCursor && last.nextCursor !== first ? last.nextCursor : undefined),
    enabled: enabled && ready(user, resource),
    staleTime: policy.stale,
    // Polling refetches only the first page (the newest rows); later pages
    // are refetched on demand.
    refetchInterval: policy.interval || false,
    refetchIntervalInBackground: false,
    placeholderData: policy.keep ? keepPreviousData : undefined,
    retry: (count, e) =>
      count < 1 &&
      !(
        e instanceof MobileError && [400, 401, 403, 404, 503].includes(e.status)
      ),
  });
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const page of q.data?.pages ?? [])
      for (const row of page?.data ?? []) {
        const id = options.id(row);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(row);
      }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);
  return {
    rows,
    /** The first page's envelope, for anything that reads beyond the rows. */
    data: q.data?.pages?.[0],
    pageCount: q.data?.pages?.length ?? 0,
    hasNext: Boolean(q.hasNextPage),
    fetchNext: () => {
      if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    },
    isFetchingNext: q.isFetchingNextPage,
    isPending: q.isPending,
    isFetching: q.isFetching,
    isError: q.isError,
    isPlaceholderData: q.isPlaceholderData,
    refetch: () => q.refetch(),
  };
}
/**
 * Warms the cache for a request the user is likely to make next (the other
 * chart timeframes, say), under the same key `useMobile` will read.
 */
export function usePrefetchMobile() {
  const { user, getAccessToken } = usePrivy();
  const client = useQueryClient();
  return (resource: string, params: Record<string, string> = {}, staleMs = 10000) => {
    if (!ready(user, resource)) return;
    void client.prefetchQuery({
      queryKey: keys.query(owner(user, resource), resource, params),
      queryFn: async ({ signal }) => mobileFetch(resource, params, await bearer(user, resource, getAccessToken), signal),
      staleTime: staleMs,
    });
  };
}
/** Warms a paged list's first page, under the key `useMobilePages` will read. */
export function usePrefetchMobilePages() {
  const { user, getAccessToken } = usePrivy();
  const client = useQueryClient();
  return (resource: string, params: Record<string, string>, first = "", staleMs = 10000) => {
    if (!ready(user, resource)) return;
    void client.prefetchInfiniteQuery({
      queryKey: keys.query(owner(user, resource), resource, params),
      queryFn: async ({ signal }) => mobileFetch(resource, params, await bearer(user, resource, getAccessToken), signal),
      initialPageParam: first,
      staleTime: staleMs,
    });
  };
}
/** Refreshes what an action changed: its listed resources, or everything for one not listed. */
export function invalidateTouched(client: QueryClient, resource: string) {
  const touched = TOUCHES[resource];
  return client.invalidateQueries(
    touched
      ? { predicate: (q) => q.queryKey[0] === "mobile" && touched.includes(String(q.queryKey[2])) }
      : { queryKey: keys.all },
  );
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
    // Only what the action can have changed is fetched again; a star does
    // not send the portfolio, the wallets and every list back to the server.
    void invalidateTouched(client, resource);
    return result;
  };
}
/**
 * An action that shows its result before the server answers: `optimistic`
 * rewrites the cached answers it affects at once (each returns the previous
 * value), the request goes out, and on failure the previous values go back.
 * On either outcome the resources the action touches are refetched.
 */
export function useMobileMutation<TBody = unknown, TResult = unknown>(
  resource: string,
  options: {
    method?: string | ((body: TBody) => string);
    /** Cached answers to rewrite at once; returns the keys and values to restore on failure. */
    optimistic?: (client: QueryClient, userId: string | undefined, body: TBody) => { key: readonly unknown[]; previous: unknown }[];
    onError?: (error: unknown, body: TBody) => void;
    onSuccess?: (result: Envelope<TResult>, body: TBody) => void;
  } = {},
) {
  const { user, getAccessToken } = usePrivy();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: TBody) =>
      mobileFetch<TResult>(
        resource,
        {},
        await getAccessToken(),
        undefined,
        typeof options.method === "function" ? options.method(body) : (options.method ?? "POST"),
        body,
      ),
    onMutate: async (body) => {
      const snapshots = options.optimistic?.(client, user?.id, body) ?? [];
      return { snapshots };
    },
    onError: (error, body, context) => {
      for (const s of context?.snapshots ?? []) client.setQueryData(s.key, s.previous);
      options.onError?.(error, body);
    },
    onSuccess: (result, body) => options.onSuccess?.(result, body),
    onSettled: () => void invalidateTouched(client, resource),
  });
}
