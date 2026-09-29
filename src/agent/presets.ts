import type { Tier } from "./models";
import type { Plan } from "./planner";
import type { Habits, Period } from "./registry";
import { mentionedSymbols } from "./tools";

// What the agent has learned about how this user asks for things, kept on
// the phone and sealed with the rest of its identity. A preset is a plan
// Jev made for a kind of request ("how is my portfolio doing", "should I buy
// <token>"): once Jev has planned the same kind of request the same way
// twice, the agent reuses the plan and skips the decision round trip.
// Habits fill in what a message leaves out, like the P&L period the user
// usually means.
export type Preset = { tools: string[]; tier: Tier; hits: number; last: number };
export type PresetDoc = {
  v: 2;
  entries: Record<string, Preset>;
  habits: Habits;
  /** How often each tool and each period has been used, for the habits. */
  counts: { tools: Record<string, number>; periods: Partial<Record<Period, number>> };
};
export const MAX_PRESETS = 120;
/** Jev has to agree with itself this many times before a plan is reused. */
export const TRUST_AFTER = 2;

// v2: the X, web and chain tools arrived; plans learned without them are dropped.
export const emptyPresets = (): PresetDoc => ({ v: 2, entries: {}, habits: {}, counts: { tools: {}, periods: {} } });

const STOP = new Set(
  "a an the my me i im i'm is are am was be do does did please can could would will you your yours to of for on in at it its this that these those and or so just now any some what whats what's how hows how's tell show give let me us".split(
    " ",
  ),
);

/**
 * The kind of request a message is, independent of its particulars: tokens
 * become <t> and numbers <n>, filler words go, and the rest is sorted, so
 * "should I buy ZEC" and "should i buy $SOL?" are one request.
 */
export function signature(text: string): string {
  let t = text;
  for (const symbol of mentionedSymbols(text)) t = t.replace(new RegExp(`\\$?\\b${symbol}\\b`, "g"), " <t> ");
  const words = t
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?/g, " <n> ")
    .replace(/[^a-z<>\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  return [...new Set(words)].sort().slice(0, 10).join(" ");
}

const samePlan = (a: { tools: string[]; tier: Tier }, b: { tools: string[]; tier: Tier }) =>
  a.tier === b.tier && a.tools.length === b.tools.length && [...a.tools].sort().join() === [...b.tools].sort().join();

/** The saved plan for this kind of request, once it is trusted. */
export function recall(doc: PresetDoc, sig: string): Plan | null {
  const entry = sig ? doc.entries[sig] : undefined;
  if (!entry || entry.hits < TRUST_AFTER) return null;
  return { tools: entry.tools, tier: entry.tier, source: "preset" };
}

/** Records a plan Jev made: agreement strengthens the preset, disagreement restarts it. */
export function learn(doc: PresetDoc, sig: string, plan: Plan, args: Record<string, string> = {}, now = Date.now()): PresetDoc {
  const next: PresetDoc = {
    ...doc,
    entries: { ...doc.entries },
    counts: { tools: { ...doc.counts.tools }, periods: { ...doc.counts.periods } },
    habits: { ...doc.habits },
  };
  if (sig && plan.source === "jev") {
    const entry = next.entries[sig];
    next.entries[sig] =
      entry && samePlan(entry, plan)
        ? { ...entry, hits: entry.hits + 1, last: now }
        : { tools: plan.tools, tier: plan.tier, hits: 1, last: now };
  } else if (sig && plan.source === "preset" && next.entries[sig]) {
    next.entries[sig] = { ...next.entries[sig], last: now };
  }
  for (const tool of plan.tools) next.counts.tools[tool] = (next.counts.tools[tool] ?? 0) + 1;
  const period = args.period as Period | undefined;
  if (period) {
    next.counts.periods[period] = (next.counts.periods[period] ?? 0) + 1;
    next.habits.pnlPeriod = (Object.entries(next.counts.periods) as [Period, number][]).sort((a, b) => b[1] - a[1])[0][0];
  }
  const keys = Object.keys(next.entries);
  if (keys.length > MAX_PRESETS) {
    for (const key of keys.sort((a, b) => next.entries[a].last - next.entries[b].last).slice(0, keys.length - MAX_PRESETS))
      delete next.entries[key];
  }
  return next;
}
