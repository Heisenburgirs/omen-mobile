// Ryvo's inference gateway on Solana mainnet. The agent's balance is USDC the
// user locks in a payment channel with Ryvo; every reply is prepaid from it
// with a voucher and Ryvo settles the vouchers on-chain in batches.
export const RYVO = {
  gatewayUrl: (process.env.EXPO_PUBLIC_RYVO_GATEWAY_URL || "https://inference.ryvo.network").replace(/\/$/, ""),
  facilitatorUrl: (process.env.EXPO_PUBLIC_RYVO_FACILITATOR_URL || "https://facilitator.ryvo.network").replace(/\/$/, ""),
  /** The model the agent writes with. Reasoning stays in code and Jev. */
  chatModel: process.env.EXPO_PUBLIC_AGENT_MODEL || "google/gemini-2.5-flash-lite",
  /** Ryvo quotes the full `max_tokens` up front, so this caps each reply's cost. */
  maxOutputTokens: 400,
  /** USDC has six decimals: the channel counts in millionths. */
  usdcDecimals: 6,
};

export const MICRO = 1_000_000n;

export function toMicro(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1_000_000));
}
export function fromMicro(micro: bigint | number | string): number {
  return Number(micro) / 1_000_000;
}
