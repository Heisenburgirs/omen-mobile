import { mentionedSymbols } from "./tools";

// What a message is about. Kept free of React Native imports so it can be
// tested in Node; the harness asks Jev with these labels and falls back to
// the keyword reading below.
export type Intent = "portfolio" | "dividends" | "token" | "trade" | "drip" | "market" | "chat";
export const INTENTS: Record<Intent, string> = {
  portfolio: "Their holdings, balance, performance or what they own",
  dividends: "Dividends or payouts they received or could receive",
  token: "A specific token, stock or coin: its price, dividend, or whether to hold it",
  trade: "Buying, selling, swapping or reinvesting: an action with money",
  drip: "Their automatic reinvesting (drip) rules",
  market: "The market in general, what is moving, ideas to look at",
  chat: "Small talk, thanks, or a question about the agent itself",
};

/**
 * A keyword reading of the message: what the agent falls back to when Jev
 * is slow or down, and what lets a short greeting skip Jev entirely.
 */
export function guessIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(drip|reinvest)/.test(t)) return "drip";
  if (/\b(dividend|payout|paid me|yield|pays)/.test(t)) return "dividends";
  if (/\b(buy|sell|swap|trade)\b/.test(t)) return "trade";
  if (/\b(portfolio|holdings?|balance|worth|own|pnl|performance)\b/.test(t)) return "portfolio";
  if (/\b(market|trending|moving|movers|top)\b/.test(t)) return "market";
  if (mentionedSymbols(text).length) return "token";
  return "chat";
}
