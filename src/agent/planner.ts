import type { Answer, Question } from "./jev-types";
import { guessIntent, type Intent } from "./intent";
import { TIER_CRITERIA, type Tier } from "./models";
import { TOOLS, type Tool } from "./registry";
import { xHandles, xPostId } from "./extract";

// The agent's plan for one message: which tools to run and which kind of
// answer to write. Jev is the core of it. One call asks, for every tool,
// whether the message needs it, and which of four kinds of answer it wants;
// Jev returns calibrated probabilities and code decides. No model emits a
// tool call, so there is nothing to parse and nothing to hallucinate.
export type Plan = {
  tools: string[];
  tier: Tier;
  /** Where the plan came from: a saved preset, Jev, or the keyword fallback. */
  source: "preset" | "jev" | "keywords" | "chat";
};

/** A tool runs above this probability. */
export const USE = 0.6;
/** Nothing clears USE: the single most likely tool still runs if it is at least this likely. */
export const MAYBE = 0.35;
/** A paid lookup outside the source Jev picked runs only if Jev is this sure it is needed. */
export const OUTSIDE_SOURCE = 0.9;
/** Paid lookups per turn, at most: each one is bought from the agent's balance. */
export const MAX_PAID = 2;

/**
 * Where the answer should come from. Jev picks one; the paid lookups of that
 * source run on the usual threshold, any other paid lookup needs near
 * certainty. Asking "is X needed" per tool alone let related lookups pile up
 * (an account's posts, a search of X and a web search for one request).
 */
export const SOURCE_CRITERIA = {
  app: "The user's own data in OMEN: holdings, performance, dividends, drip rules, activity, token prices and market data",
  x_account: "A specific X (Twitter) account the user names: its posts, profile or mentions",
  x_topic: "What people on X (Twitter) are saying about a token, ticker, project or topic",
  x_post: "A specific X post the user linked, and the replies under it",
  web: "News, recent events or facts that need a web search",
  chain: "Solana on-chain data for an address, token mint or transaction the user gives",
  none: "No lookup: conversation, or something answerable without data",
} as const;
export type Source = keyof typeof SOURCE_CRITERIA;
/** The paid tools each source uses; tools not listed here are the app's own and free. */
export const SOURCE_TOOLS: Record<Source, readonly string[]> = {
  app: [],
  x_account: ["x_posts", "x_profile", "x_mentions"],
  x_topic: ["x_search"],
  x_post: ["x_replies"],
  web: ["web_search", "web_research"],
  chain: ["chain_lookup"],
  none: [],
};
const PAID = new Set(Object.values(SOURCE_TOOLS).flat());

export function planQuestions(tools: readonly Tool[] = TOOLS): Record<string, Question> {
  const questions: Record<string, Question> = {
    tier: { type: "choice", instructions: "What kind of answer does the user's message want?", criteria: TIER_CRITERIA },
    source: {
      type: "choice",
      instructions: "Where should the answer to the user's message mainly come from?",
      criteria: SOURCE_CRITERIA,
    },
  };
  for (const tool of tools) {
    questions[`use_${tool.id}`] = {
      type: "boolean",
      instructions: `To answer the user's message well, does the agent need ${tool.describe}?`,
    };
  }
  return questions;
}

export function planFromAnswers(answers: Record<string, Answer>, tools: readonly Tool[] = TOOLS): Plan {
  const tierAnswer = answers.tier;
  const tier: Tier =
    tierAnswer?.type === "choice" && tierAnswer.choice in TIER_CRITERIA ? (tierAnswer.choice as Tier) : "lookup";
  const scored = tools
    .map((t) => {
      const a = answers[`use_${t.id}`];
      return { id: t.id, p: a?.type === "boolean" ? a.probability : 0 };
    })
    .sort((a, b) => b.p - a.p);
  const sourceAnswer = answers.source;
  const source: Source | undefined =
    sourceAnswer?.type === "choice" && sourceAnswer.choice in SOURCE_CRITERIA ? (sourceAnswer.choice as Source) : undefined;
  const inSource = (id: string) => !PAID.has(id) || !source || SOURCE_TOOLS[source].includes(id);
  // Free tools on the usual threshold; paid ones on it only within the chosen source.
  let chosen = scored.filter((s) => (inSource(s.id) ? s.p >= USE : s.p >= OUTSIDE_SOURCE)).map((s) => s.id);
  if (!chosen.length && tier !== "chat") {
    // The chosen source's likeliest lookup, else the likeliest tool at all.
    const fallback = (source ? scored.find((s) => SOURCE_TOOLS[source].includes(s.id)) : undefined) ?? scored[0];
    if (fallback && fallback.p >= MAYBE && inSource(fallback.id)) chosen = [fallback.id];
  }
  let paidCount = 0;
  chosen = chosen.filter((id) => !PAID.has(id) || ++paidCount <= MAX_PAID);
  return { tools: tier === "chat" ? [] : chosen.slice(0, 4), tier, source: "jev" };
}

const INTENT_TOOLS: Record<Intent, string[]> = {
  agent: ["agent_balance"],
  x: ["x_search"],
  chain: ["chain_lookup"],
  web: ["web_search"],
  portfolio: ["balance"],
  dividends: ["dividends", "payouts"],
  token: ["asset"],
  trade: ["balance", "asset"],
  drip: ["drip", "dividends"],
  market: ["market"],
  chat: [],
};

/** The plan when Jev is slow or down: the keyword reading, conservatively. */
export function keywordPlan(text: string): Plan {
  const intent = guessIntent(text);
  const t = text.toLowerCase();
  const tools = [...INTENT_TOOLS[intent]];
  if (intent === "portfolio" && /\b(pnl|profits?|loss(es)?|perform\w*|gain\w*|up|down)\b/.test(t)) tools.push("pnl");
  if (intent === "trade" && /\b(quote|how much|price for)\b/.test(t)) tools.push("quote");
  if (intent === "x") {
    // A linked post, a named account, or a topic.
    tools.length = 0;
    if (xPostId(text)) tools.push("x_replies");
    else if (xHandles(text).length) {
      if (/\b(who is|profile|bio|followers|account age)\b/.test(t)) tools.push("x_profile");
      else if (/\b(mention|mentions|mentioning|replies to|talking (?:to|about))\b/.test(t)) tools.push("x_mentions");
      else tools.push("x_posts");
    } else tools.push("x_search");
  }
  const tier: Tier =
    intent === "chat"
      ? "chat"
      : /\b(should i|worth|good (buy|investment)|risk|hold|recommend)\b/.test(t)
        ? "judge"
        : /\b(why|explain|compare|versus|vs)\b/.test(t)
          ? "explain"
          : "lookup";
  return { tools, tier, source: intent === "chat" ? "chat" : "keywords" };
}

/** Small talk the agent answers without planning anything. */
export function isSmallTalk(text: string): boolean {
  return guessIntent(text) === "chat" && text.trim().split(/\s+/).length <= 6 && keywordPlan(text).tier === "chat";
}
