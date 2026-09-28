import { config } from "../config";

// The agent's decisions. Jev (TypeSafe AI's decision model) answers typed
// questions about a state with calibrated probabilities and never writes
// text, so the agent's routing, memory and safety judgements come from it
// and code branches on the numbers. The site proxies the call (OMEN pays for
// these; they cost a few thousandths of a cent) and the app never holds a
// gateway key.
import type { Answer, Question } from "./jev-types";
export type { Answer, Question } from "./jev-types";

export class DecisionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function decide<Q extends Record<string, Question>>(
  token: string | null,
  state: unknown,
  questions: Q,
  timeoutMs = 6000,
): Promise<Record<keyof Q, Answer>> {
  if (!token) throw new DecisionError("Please sign in again.", 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.apiUrl}/api/agent`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ state, questions }),
      signal: controller.signal,
    });
    let body: { answers?: Record<string, Answer>; error?: string } = {};
    try {
      body = await response.json();
    } catch {
      throw new DecisionError("The agent is briefly unavailable.", 503);
    }
    if (!response.ok || !body.answers) throw new DecisionError(body.error || "The agent is briefly unavailable.", response.status);
    return body.answers as Record<keyof Q, Answer>;
  } finally {
    clearTimeout(timer);
  }
}

/** The probability behind a choice, or 0 when the answer is not a choice. */
export function confidence(answer: Answer | undefined): number {
  if (!answer || answer.type !== "choice") return 0;
  return answer.probabilities?.[answer.choice] ?? 1;
}
export const yes = (answer: Answer | undefined, threshold = 0.6) =>
  Boolean(answer && answer.type === "boolean" && answer.probability >= threshold);
