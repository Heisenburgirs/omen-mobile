import type { Answer, Question } from "./jev-types";
import { guessIntent, type Intent } from "./intent";
import { TIER_CRITERIA, type Tier } from "./models";
import { TOOLS, type Tool } from "./registry";

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

export function planQuestions(tools: readonly Tool[] = TOOLS): Record<string, Question> {
  const questions: Record<string, Question> = {
    tier: { type: "choice", instructions: "What kind of answer does the user's message want?", criteria: TIER_CRITERIA },
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
  let chosen = scored.filter((s) => s.p >= USE).map((s) => s.id);
  if (!chosen.length && tier !== "chat" && scored[0] && scored[0].p >= MAYBE) chosen = [scored[0].id];
  return { tools: tier === "chat" ? [] : chosen.slice(0, 4), tier, source: "jev" };
}

const INTENT_TOOLS: Record<Intent, string[]> = {
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
