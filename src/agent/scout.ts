// The scout's arithmetic: which tickers X is starting to talk about, and
// how alive each one's conversation is. Pure, so it is tested without X.

/** A post as the X tools hand it to the writer. */
export type WriterPost = {
  by: string;
  followers?: number;
  accountSince?: number;
  verified?: boolean;
  automated?: boolean;
  at?: string;
  text: string;
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number;
  replyTo?: string;
  quoting?: string;
  url?: string;
};

/** Tickers that are never a new play. */
export const MAJORS = new Set([
  "SOL", "BTC", "ETH", "USDC", "USDT", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "TRX", "TON", "DOT", "MATIC", "POL",
  "SUI", "APT", "ARB", "OP", "NEAR", "LTC", "BCH", "XLM", "HBAR", "ICP", "FIL", "ATOM", "UNI", "AAVE", "PEPE", "SHIB",
  "WIF", "BONK", "JUP", "PYTH", "JTO", "RAY", "ORCA", "PUMP", "TRUMP", "HYPE", "ENA", "ONDO", "RENDER", "FARTCOIN",
  "SPX", "QQQ", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "COIN", "MSTR", "HOOD", "GOLD", "USD", "EUR",
  "CA", "DEX", "AI", "NFT", "APR", "APY", "ATH", "ATL", "MC", "FDV", "LP", "TVL", "ROI", "PNL", "OTC", "IPO", "ETF",
  "SEC", "FED", "CEO", "USA", "UK", "EU", "GDP", "CPI", "NYSE", "UAW", "DOJ", "FBI", "CIA", "NASA", "GOP", "DNC",
]);

const CASHTAG = /\$([A-Za-z][A-Za-z0-9]{1,9})(?![A-Za-z0-9])/g;

/** The tickers a post names, upper-cased, majors left out. */
export function cashtagsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CASHTAG)) {
    const s = m[1]!.toUpperCase();
    if (!MAJORS.has(s) && !/^\d/.test(s)) out.add(s);
  }
  return [...out];
}

export type Candidate = { symbol: string; posts: number; accounts: number; followersMax: number; followersSum: number };

/**
 * The tickers worth a closer look from a run of discovery posts: those
 * several accounts name, ranked by how many and how large, with anything
 * the user already named left out.
 */
export function candidatesFrom(posts: WriterPost[], exclude: Iterable<string> = [], limit = 5): Candidate[] {
  const skip = new Set([...exclude].map((s) => s.toUpperCase()));
  const tally = new Map<string, { posts: number; accounts: Set<string>; followersMax: number; followersSum: number }>();
  for (const p of posts) {
    const tags = cashtagsIn(p.text).filter((s) => !skip.has(s));
    // A post that sprays many tickers is a shill list, not a signal.
    if (tags.length === 0 || tags.length > 4) continue;
    for (const s of tags) {
      const t = tally.get(s) ?? { posts: 0, accounts: new Set<string>(), followersMax: 0, followersSum: 0 };
      t.posts += 1;
      if (!t.accounts.has(p.by)) {
        t.accounts.add(p.by);
        t.followersSum += p.followers ?? 0;
      }
      t.followersMax = Math.max(t.followersMax, p.followers ?? 0);
      tally.set(s, t);
    }
  }
  return [...tally.entries()]
    .map(([symbol, t]) => ({ symbol, posts: t.posts, accounts: t.accounts.size, followersMax: t.followersMax, followersSum: t.followersSum }))
    .filter((c) => c.accounts >= 2 || c.followersMax >= 5_000)
    .sort((a, b) => b.accounts - a.accounts || b.followersSum - a.followersSum || b.posts - a.posts)
    .slice(0, limit);
}

export type XActivity = {
  /** 0 to 100: how alive the conversation is, bots and shill farms discounted. */
  score: number;
  posts: number;
  accounts: number;
  followersMax: number;
  followersSum: number;
  engagement: number;
  /** Share of the posts from the last six hours: rising or fading. */
  recentShare: number;
  /** Share from accounts under 100 followers or newer than this year, or automated. */
  weakShare: number;
  verified: number;
  /** Distinct conversations: replies to different posts. */
  threads: number;
  /** The accounts carrying the conversation, largest first. */
  topAccounts: { handle: string; followers: number; posts: number }[];
};

const HOUR = 36e5;

/** How alive a ticker's conversation on X is, from one search's posts. */
export function xActivity(posts: WriterPost[], now = Date.now()): XActivity {
  const byAccount = new Map<string, { followers: number; posts: number }>();
  let engagement = 0;
  let recent = 0;
  let weak = 0;
  let verified = 0;
  const threads = new Set<string>();
  const realAccounts = new Set<string>();
  let realPosts = 0;
  const thisYear = new Date(now).getFullYear();
  for (const p of posts) {
    const a = byAccount.get(p.by) ?? { followers: p.followers ?? 0, posts: 0 };
    a.posts += 1;
    a.followers = Math.max(a.followers, p.followers ?? 0);
    byAccount.set(p.by, a);
    engagement += (p.likes ?? 0) + 2 * (p.reposts ?? 0) + 2 * (p.replies ?? 0);
    const t = p.at ? Date.parse(p.at) : NaN;
    if (Number.isFinite(t) && now - t <= 6 * HOUR) recent += 1;
    const isWeak = (p.followers ?? 0) < 100 || (p.accountSince ?? 0) >= thisYear || Boolean(p.automated);
    if (isWeak) weak += 1;
    else {
      realPosts += 1;
      realAccounts.add(p.by);
    }
    if (p.verified) verified += 1;
    if (p.replyTo) threads.add(p.replyTo);
  }
  const n = posts.length;
  const accounts = byAccount.size;
  const followersSum = [...byAccount.values()].reduce((s, a) => s + a.followers, 0);
  const followersMax = [...byAccount.values()].reduce((m, a) => Math.max(m, a.followers), 0);
  const recentShare = n ? recent / n : 0;
  const weakShare = n ? weak / n : 0;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  // Volume and breadth count only established accounts; a farm of fresh
  // bots adds nothing there and then discounts what reach it borrowed.
  const raw =
    clamp(realPosts / 15) * 20 +
    clamp(realAccounts.size / 12) * 25 +
    clamp(Math.log10(followersSum + 1) / 6) * 20 +
    clamp(engagement / 600) * 15 +
    recentShare * 20;
  const score = Math.round(clamp((raw * (1 - 0.6 * weakShare)) / 100) * 100);
  const topAccounts = [...byAccount.entries()]
    .map(([handle, a]) => ({ handle, followers: a.followers, posts: a.posts }))
    .sort((x, y) => y.followers - x.followers)
    .slice(0, 5);
  return { score, posts: n, accounts, followersMax, followersSum, engagement, recentShare: round2(recentShare), weakShare: round2(weakShare), verified, threads: threads.size, topAccounts };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The post id in an x.com status URL. */
export function postIdOf(url: string | undefined): string | undefined {
  return url?.match(/\/status\/(\d+)/)?.[1];
}

/** The post most worth reading the replies under: the most engaged one. */
export function leadPost(posts: WriterPost[]): WriterPost | undefined {
  return [...posts].sort((a, b) => (b.likes ?? 0) + 2 * (b.replies ?? 0) - ((a.likes ?? 0) + 2 * (a.replies ?? 0)))[0];
}
