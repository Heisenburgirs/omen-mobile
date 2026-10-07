// A second look before writing. After the first round of lookups, a cheap
// model reads what came back next to the question and names what is still
// missing, as lookups it can ask for by name (the catalogue is the tool list
// with one line each). The harness runs them and asks again, up to a few
// rounds and a spend cap, so a judgement is written from a full picture
// rather than from whatever the first guess at tools happened to fetch.
import type { Tool } from "./registry";

export type FollowUpCall = { tool: string; text: string };

/** How many extra rounds a judgement may take, and what it may spend on them. */
export const FOLLOW_UP_ROUNDS = 2;
export const FOLLOW_UP_CAP_MICRO = 150_000;
/** The lookups that only make sense once something is named: a follow-up may ask for these. */
const FOLLOW_UP_TOOLS = new Set(["asset", "tokens", "market", "x_search", "x_posts", "x_profile", "x_mentions", "x_replies", "web_search", "web_research", "chain_lookup"]);

export function catalogue(tools: Tool[]): string {
  return tools
    .filter((t) => FOLLOW_UP_TOOLS.has(t.id))
    .map((t) => `${t.id}: ${t.describe}`)
    .join("\n");
}

/** The question the cheap model answers, with the data cut to what fits. */
export function followUpPrompt(question: string, data: string[], tools: Tool[], already: FollowUpCall[]): string {
  const seen = data.join("\n").slice(0, 7000);
  const done = already.length ? already.map((c) => `${c.tool}: ${c.text}`).join("\n") : "(none)";
  return [
    "You decide whether more lookups would make the answer to the user's question materially better.",
    "Ask only for what is missing and specific: a token named in the data that has no figures yet, an X account that was mentioned but not read, a contract that was quoted but not checked, a claim worth verifying on the web.",
    "Do not ask again for what the data already has, and do not repeat a lookup below.",
    "",
    `User's question: ${question}`,
    "",
    "Data so far:",
    seen || "(nothing came back)",
    "",
    "Lookups already made:",
    done,
    "",
    "Lookups you may ask for (name: what it fetches):",
    catalogue(tools),
    "",
    'Answer with JSON only, no prose: {"calls":[{"tool":"<name>","text":"<one line naming the $SYMBOL, @handle, contract or search words>"}]} with at most 3 calls, or {"calls":[]} when the data is enough.',
  ].join("\n");
}

/** The calls the model asked for, kept to the catalogue and to new work. */
export function parseFollowUp(reply: string, tools: Tool[], already: FollowUpCall[]): FollowUpCall[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  const calls = (parsed as { calls?: unknown })?.calls;
  if (!Array.isArray(calls)) return [];
  const known = new Set(tools.map((t) => t.id).filter((id) => FOLLOW_UP_TOOLS.has(id)));
  const key = (c: FollowUpCall) => c.tool + "|" + c.text.trim().toLowerCase();
  const seen = new Set(already.map(key));
  const out: FollowUpCall[] = [];
  for (const c of calls) {
    if (!c || typeof c !== "object") continue;
    const tool = String((c as { tool?: unknown }).tool ?? "");
    const text = String((c as { text?: unknown }).text ?? "").trim().slice(0, 200);
    if (!known.has(tool) || !text) continue;
    const call = { tool, text };
    if (seen.has(key(call))) continue;
    seen.add(key(call));
    out.push(call);
    if (out.length === 3) break;
  }
  return out;
}
