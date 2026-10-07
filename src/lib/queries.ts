// How each kind of data is kept: how often it refreshes while on screen, how
// long an answer counts as fresh, whether the last answer stays up while a
// changed request loads, and whether it is saved on the device so the next
// launch opens with it. One table, read by `useMobile`; screens never set
// any of this themselves.
export type Policy = {
  /** Refetch this often while the screen that asked is active; absent means only when stale. */
  interval?: number;
  /** An answer this old is fresh: shown without a refetch when asked for again. */
  stale: number;
  /** Keep the previous answer on screen while a changed request (new params) loads. */
  keep?: boolean;
  /** Saved on the device between launches. */
  persist?: boolean;
};
const MINUTE = 60_000;
const POLICIES: Record<string, Policy> = {
  // The market: lists and pages poll every ten seconds while watched.
  assets: { interval: 10_000, stale: 10_000, keep: true, persist: true },
  asset: { interval: 10_000, stale: 10_000, keep: true, persist: true },
  stats: { interval: 30_000, stale: 30_000, keep: true, persist: true },
  candles: { stale: 30_000, keep: true, persist: true },
  peaks: { stale: 5 * MINUTE, keep: true, persist: true },
  // The account: the book every twenty seconds, the rest when stale.
  portfolio: { interval: 20_000, stale: 15_000, keep: true, persist: true },
  wallets: { interval: 30_000, stale: 30_000, persist: true },
  balance: { interval: 20_000, stale: 15_000 },
  watchlist: { stale: MINUTE, persist: true },
  strategies: { interval: 30_000, stale: 15_000, persist: true },
  activity: { stale: 15_000, keep: true, persist: true },
  performance: { stale: 30_000, keep: true, persist: true },
  dividends: { stale: 30_000, keep: true, persist: true },
  "dividend-sources": { interval: MINUTE, stale: 30_000, keep: true, persist: true },
  "dividend-series": { stale: 30_000, keep: true, persist: true },
  "drip-config": { stale: 5 * MINUTE, persist: true },
  "skr-stake": { interval: 30_000, stale: 15_000, keep: true },
  me: { stale: MINUTE, persist: true },
  "agent-credits": { stale: MINUTE, persist: true },
  onramp: { stale: 30_000 },
  people: { stale: MINUTE, keep: true },
  profile: { stale: MINUTE, keep: true, persist: true },
  relations: { stale: MINUTE, keep: true },
  blocked: { stale: MINUTE },
};
const DEFAULT: Policy = { stale: 15_000 };
export const policyFor = (resource: string): Policy => POLICIES[resource] ?? DEFAULT;

/** Bumped whenever a cached answer's shape changes; the saved cache is dropped on launch. */
export const CACHE_SCHEMA = "2";

/** What Search shows first (every token by market cap): the splash fetches this before anything else. */
export const DEFAULT_SEARCH_PARAMS = { scope: "stonk", type: "tokens", q: "", sort: "cap", direction: "desc", filters: "{}" };

/** Query keys, built one way everywhere: ["mobile", user, resource, params]. */
export const keys = {
  all: ["mobile"] as const,
  user: (userId: string | undefined) => ["mobile", userId] as const,
  resource: (userId: string | undefined, resource: string) => ["mobile", userId, resource] as const,
  query: (userId: string | undefined, resource: string, params: Record<string, string>) =>
    ["mobile", userId, resource, params] as const,
};

/**
 * What an action can change, so a save refreshes only that. A resource not
 * listed refreshes everything, which is the safe default for a new action.
 */
export const TOUCHES: Record<string, string[]> = {
  watchlist: ["watchlist", "assets"],
  strategies: ["strategies", "portfolio"],
  referral: ["me", "agent-credits"],
  profile: ["me", "people", "profile"],
  follow: ["me", "profile", "people", "relations"],
  block: ["me", "profile", "people", "blocked"],
  onboarding: ["me"],
  onramp: ["onramp"],
  report: [],
};
