// Which model writes a reply. Jev decides what kind of answer a message
// needs; this maps that kind to a model on Ryvo. Small talk and lookups
// only turn fetched data into a sentence, so the cheapest model does them.
// Explaining what the data shows needs a better reader, and a judgement
// with money at stake (buy, sell, hold, risk) gets the strongest model the
// catalogue offers at a sane price. Each tier can be overridden per build.
export type Tier = "chat" | "lookup" | "explain" | "judge";

export type ModelChoice = { model: string; maxTokens: number; label: string };

const env = (name: string) => (process.env[name] || "").trim();

export const MODELS: Record<Tier, ModelChoice> = {
  chat: {
    model: env("EXPO_PUBLIC_AGENT_MODEL_CHAT") || "google/gemini-2.5-flash-lite",
    maxTokens: 200,
    label: "flash-lite",
  },
  lookup: {
    model: env("EXPO_PUBLIC_AGENT_MODEL_LOOKUP") || "google/gemini-2.5-flash-lite",
    maxTokens: 350,
    label: "flash-lite",
  },
  explain: {
    model: env("EXPO_PUBLIC_AGENT_MODEL_EXPLAIN") || "google/gemini-3-flash",
    maxTokens: 500,
    label: "gemini-3-flash",
  },
  judge: {
    model: env("EXPO_PUBLIC_AGENT_MODEL_JUDGE") || "anthropic/claude-sonnet-5.5",
    maxTokens: 900,
    label: "sonnet-5.5",
  },
};

export const TIER_CRITERIA: Record<Tier, string> = {
  chat: "Small talk, thanks, or a question about the agent itself; nothing to look up",
  lookup: "Show or look up facts: balances, prices, payouts, history, quotes",
  explain: "Explain or compare what the numbers show, without deciding for the user",
  judge: "A judgement with money at stake: whether to buy, sell or hold, how risky it is, what to do next",
};

/** What the writing model is told for each kind of answer. */
export const TIER_GUIDANCE: Record<Tier, string> = {
  chat: "Reply in one or two friendly sentences.",
  lookup: "State the facts from the data plainly, with the numbers. Two to four sentences or a short list.",
  explain: "Explain what the data shows and why, comparing where useful. Keep it under eight sentences.",
  judge:
    "Argue it like an analyst with a view: the case for, the case against, the real risks, then your call and what would change it. When asked for ideas or plays, give ranked names with a reason and a risk each, and say which you would take first. Be direct; probabilities and conditions, never disclaimers.",
};
