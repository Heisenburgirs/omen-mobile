export type Coverage = "complete" | "partial" | "unavailable" | "building";
export type Envelope<T> = {
  data: T;
  observedAt: string;
  coverage: Coverage;
  message?: string;
  nextCursor?: string | null;
};
export type Stonk = {
  deployment: string;
  kind: "reward" | "standard";
  payoutMint: string | null;
  payoutSymbol: string | null;
  taxBps: number | null;
  stage: string | null;
  eligibility: string | null;
  evidence: string;
};
/**
 * Dividends actually paid to holders, measured by OMEN's payout index over
 * the 3-day rate window, and the rates derived from them (one methodology
 * for the website and the app; see the site's /dashboard/methodology).
 */
export type AssetDividends = {
  /** USD paid to holders over the covered window. */
  usd: number;
  /** Hours the window covers: up to 72, less for a younger token. */
  hours: number;
  /** Trailing APR: the flow per day annualised on eligible holdings (or FDV). */
  apr: number | null;
  /** Reinvesting every dividend daily at that rate, after the buy tax and costs. */
  apy: number | null;
  /** Which denominator the rate used. */
  basis: "eligible" | "fdv";
  /** The token is younger than the window; the rate covers its whole life. */
  young: boolean;
  /** Forward rate from a day of volume × the holder tax, same denominator. */
  runRateApr: number | null;
};
export type Asset = {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  /** On a payout token's page: the Stonk tokens that pay dividends in it. */
  payers?: {
    mint: string;
    symbol: string;
    image: string | null;
    taxBps: number | null;
  }[];
  price: number | null;
  priceAt: string | null;
  change24h: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidity: number | null;
  volume24h: number | null;
  circulatingSupply: number | null;
  createdAt: string | null;
  description: string;
  website: string | null;
  socials: { label: string; url: string }[];
  stonk: Stonk | null;
  dividends?: AssetDividends | null;
  /** Token-page detail: 24 h activity, holders and supply. Null when unknown. */
  stats?: AssetStats | null;
};
export type AssetStats = {
  trades24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  buyVolume24h: number | null;
  sellVolume24h: number | null;
  traders24h: number | null;
  buyers24h: number | null;
  sellers24h: number | null;
  holders: number | null;
  top10Percent: number | null;
  totalSupply: number | null;
};
export type Holding = {
  asset: Asset;
  raw: string;
  decimals: number;
  quantity: string;
  valueUsd: string | null;
  averageEntry: string | null;
  unrealizedUsd: string | null;
  dividendsUsd: string | null;
  /** Where the token sits when the portfolio spans several wallets (a sale or a send comes from one of these). */
  wallets?: { address: string; raw: string }[];
};
export type Portfolio = {
  address: string;
  holdings: Holding[];
  totalUsd: string | null;
  unpriced: number;
  pnl24h: string | null;
  pnl24hPct: number | null;
  /** Unrealized P&L over the open positions. */
  unrealizedUsd?: string | null;
  dividends24h: string | null;
  historySince: string | null;
  /** Native SOL in lamports: fees and rent, not a tradable holding (that is wrapped SOL). */
  nativeLamports?: string;
  /** The wallets this portfolio spans: the sign-up wallet and any the user imported. */
  wallets?: { address: string; primary: boolean; imported: boolean; name: string | null; totalUsd: string | null; nativeLamports: string }[];
};
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};
export type Period = "1H" | "4H" | "24H" | "7D" | "30D" | "All";
export type Activity = {
  id: string;
  wallet: string;
  kind: "deposit" | "withdrawal" | "buy" | "sell" | "dividend" | "drip" | "unknown";
  mint: string;
  symbol: string;
  /** The token's image, when known. */
  image?: string | null;
  amount: string;
  usd: string | null;
  timestamp: string;
  signature: string;
  status: "pending" | "confirmed" | "finalized" | "failed";
  sourceMint: string | null;
  /** The source token's symbol, when the source is known. */
  sourceSymbol?: string | null;
  sourceEvidence: string | null;
  profile?: Profile;
  /** A DRIP swap: what the dividends became, and what they were. */
  drip?: DripRecord;
};
export type Profile = {
  id: string;
  wallet: string;
  username: string;
  displayName: string;
  bio: string;
  xUrl: string | null;
  avatar: string;
  /** A picture, when X supplies one; otherwise the avatar tone is shown. */
  avatarUrl: string | null;
  /** The X handle the identity is taken from, when X is linked. */
  xHandle: string | null;
  /** True while X is linked: handle, name and picture are X's and locked. */
  xVerified: boolean;
  /** When the profile finished the first-run onboarding; null until then. */
  onboardedAt?: string | null;
  /** The referral code redeemed, if any. */
  referralCode?: string | null;
  /** Spot trades carry no OMEN fee until this instant (a referral's month). */
  feeFreeUntil?: string | null;
  followers: number;
  following: number;
  isFollowing: boolean;
  pnlUsd: string | null;
  dividendsUsd: string | null;
  performanceCoverage: Coverage;
};
export type RankedPosition = {
  profile: Profile;
  asset: Asset;
  valueUsd: string;
  weeklyGainUsd: string;
  weeklyReturn: number;
  dividendsUsd: string | null;
  priceAt: string;
};
export type Filters = {
  capMin?: number;
  capMax?: number;
  liquidityMin?: number;
  liquidityMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  changeMin?: number;
  changeMax?: number;
  ageMin?: number;
  ageMax?: number;
  watchlisted?: boolean;
  kind?: "reward" | "standard";
  payout?: string;
  taxBps?: number;
  stage?: string;
};
export type SortDirection = "asc" | "desc";
export type Sort =
  "volume" | "apr" | "newest" | "cap" | "liquidity" | "gainers" | "losers";
/** A DRIP swap's story: what the dividends became, and what they were. */
export type DripRecord = {
  kind: "buyback" | "cashout" | "swap";
  payoutMint: string;
  payoutSymbol: string;
  payoutAmount: string;
  sourceMint: string | null;
  sourceSymbol: string | null;
  /** The target's market cap and price when the swap landed, when known. */
  marketCap?: number | null;
  price?: number | null;
};
/** The app's clock offset, as the API's "tz" (minutes, JS getTimezoneOffset). */
export const TZ = String(new Date().getTimezoneOffset());
export const SOL = "So11111111111111111111111111111111111111112";
/** The single cash balance the trade dock buys with. */
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** The portfolio's "Cash" row (2026-09-19; USDC alone since 2026-09-25). */
// Cash is USDC alone: the only balance a buy spends and the only one a
// rent charge comes from. Other dollar tokens (USDT, PYUSD, USDG) are
// ordinary holdings, sold into USDC like anything else.
export const CASH_MINTS: Record<string, string> = {
  [USDC]: "USDC",
};
export const isCash = (mint: string) => mint in CASH_MINTS;
export const ZCAT = "HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR";
export const ZEC = "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS";
export const emptyAsset = (mint: string): Asset => ({
  mint,
  name: mint === SOL ? "Solana" : "Unknown asset",
  symbol: mint === SOL ? "SOL" : mint.slice(0, 5),
  image: null,
  price: null,
  priceAt: null,
  change24h: null,
  marketCap: null,
  fdv: null,
  liquidity: null,
  volume24h: null,
  circulatingSupply: null,
  createdAt: null,
  description: "",
  website: null,
  socials: [],
  stonk: null,
  dividends: null,
});
