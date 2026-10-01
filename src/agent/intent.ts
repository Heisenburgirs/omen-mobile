import { solanaRefs } from "./extract";
import { isResearch, mentionedSymbols } from "./tools";

// What a message is about. Kept free of React Native imports so it can be
// tested in Node; the harness asks Jev with these labels and falls back to
// the keyword reading below.
export type Intent = "agent" | "x" | "chain" | "web" | "portfolio" | "dividends" | "token" | "trade" | "drip" | "market" | "chat";
export const INTENTS: Record<Intent, string> = {
  agent: "The agent's own balance: what the user funded it with, spent, or has left",
  x: "Posts, accounts or discussion on X (Twitter)",
  chain: "A Solana address, token mint or transaction the user gives",
  web: "News, recent events or facts to look up on the web",
  portfolio: "Their holdings, balance, performance or what they own",
  dividends: "Dividends or payouts they received or could receive",
  token: "A specific token, stock or coin: its price, dividend, or whether to hold it",
  trade: "Buying, selling, swapping or reinvesting: an action with money",
  drip: "Their automatic reinvesting (drip) rules",
  market: "The market in general, what is moving, ideas to look at",
  chat: "Small talk, thanks, or a question about the agent itself",
};

/** "what is my agent balance", "how much do you have left", "what have you spent". */
export function isAgentBalance(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bagent('s)?\b.{0,30}\b(balance|funds?|money|credits?|spent|left|usdc|budget)\b/.test(t) ||
    /\b(balance|funds?|money|credits?|budget)\b.{0,20}\b(of|for|on) (the |my )?agent\b/.test(t) ||
    /\bhow much (do|have) you (have|got|spent|left)\b/.test(t) ||
    /\b(your|you've|you have) (balance|funds|money|credits|budget|spent|left)\b/.test(t)
  );
}

/**
 * A keyword reading of the message: what the agent falls back to when Jev
 * is slow or down, and what lets a short greeting skip Jev entirely.
 */
export function guessIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (isAgentBalance(t)) return "agent";
  if (/(?:x|twitter)\.com\/|\btweets?\b|\btwitter\b|\bon x\b|\bx (?:posts?|account|handle)\b|(?:^|\s)@[a-z0-9_]{2,15}\b/.test(t)) return "x";
  const refs = solanaRefs(text);
  if (refs.signatures.length || refs.addresses.length) return "chain";
  if (/\b(news|search (?:the )?web|google|look up|what happened|headlines?)\b/.test(t)) return "web";
  if (/\b(drip|reinvest)/.test(t)) return "drip";
  if (/\b(dividend|payout|paid me|yield|pays)/.test(t)) return "dividends";
  if (isResearch(text)) return "market";
  if (/\b(buy|sell|swap|trade)\b/.test(t)) return "trade";
  if (/\b(portfolio|holdings?|balance|worth|own|pnl|performance)\b/.test(t)) return "portfolio";
  if (/\b(market|trending|moving|movers|top)\b/.test(t)) return "market";
  if (mentionedSymbols(text).length) return "token";
  return "chat";
}
