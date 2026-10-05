
// Free agent credits: inference OMEN gives a user (a trial, a Seeker's
// welcome, referrals), held on the server. While a user has any, the
// agent's replies and lookups run through the site, which pays Ryvo and
// takes the cost off the credit; the user's own channel is not touched.

export type AgentCredits = {
  balanceMicro: number;
  grants: { kind: string; amountMicro: number; at: string }[];
  seeker: boolean;
  referral: { code: string; uses: number } | null;
  rewards: { refereeMicro: number; referrerMicro: number; seekerMicro: number; feeDiscountBps: number };
};

/** What a friend reads when the code is shared. */
export function inviteMessage(code: string, rewards: AgentCredits["rewards"]): string {
  const dollars = (micro: number) => `$${(micro / 1e6).toFixed(0)}`;
  const off = Math.round(rewards.feeDiscountBps / 100);
  return `Join me on OMEN: trade Solana tokens that pay dividends, with an agent that researches for you. Use my code ${code} for ${dollars(rewards.refereeMicro)} of free agent credits and ${off}% off trading fees for a month. https://www.getomen.xyz/app`;
}
