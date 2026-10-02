import { mentionedSymbols } from "./tools";

// What a message says a paid lookup should be about: the X account or post,
// the time window, the search words, the Solana address or transaction.
// Jev decides which lookups a message needs; these read their arguments out
// of the words, so no model ever writes a tool call.

const NOT_HANDLES = new Set(
  "the a an my me this that his her their them him x twitter posts tweets post tweet account user handle latest last recent top today yesterday".split(" "),
);

/** X handles the user named: @handle, x.com/handle or twitter.com/handle, or "posts from handle on X". */
export function xHandles(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[^\w.])(?:x|twitter)\.com\/(?!i\/|home\b|search\b|hashtag\/|explore\b)([A-Za-z0-9_]{1,15})/gi)) out.add(m[1]);
  for (const m of text.matchAll(/(?:^|[^\w@/])@([A-Za-z0-9_]{1,15})\b/g)) out.add(m[1]);
  if (!out.size && /\b(x|twitter|tweets?|posts?)\b/i.test(text)) {
    const m = text.match(/\b(?:from|by|of|account|user|handle)\s+@?([A-Za-z0-9_]{2,15})\b/i);
    if (m && !NOT_HANDLES.has(m[1].toLowerCase())) out.add(m[1]);
  }
  return [...out].filter((h) => !NOT_HANDLES.has(h.toLowerCase())).slice(0, 2);
}

/** The id of an X post the user linked (x.com/…/status/123…). */
export function xPostId(text: string): string | undefined {
  return text.match(/(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/(\d{5,25})/i)?.[1];
}

/** "last hour", "past 30 minutes", "today", "this week": the window a message asks about, in minutes. */
export function sinceMinutes(text: string): number | undefined {
  const t = text.toLowerCase();
  const minutes = t.match(/\b(?:last|past)\s+(\d{1,4})\s*(?:m|min|mins|minutes?)\b/);
  if (minutes) return Math.min(10_080, Math.max(1, Number(minutes[1])));
  const hours = t.match(/\b(?:last|past)\s+(\d{1,3})\s*(?:h|hr|hrs|hours?)\b/);
  if (hours) return Math.min(10_080, Number(hours[1]) * 60);
  if (/\b(?:last|past|this)\s+hour\b/.test(t)) return 60;
  if (/\b(?:today|last 24|past 24|past day|last day|24 ?h)\b/.test(t)) return 1_440;
  if (/\b(?:this|last|past)\s+week\b|\b7 ?days?\b/.test(t)) return 10_080;
  return undefined;
}

/** How many posts a message asks for ("latest 20 posts"), if it says. */
export function postCount(text: string): number | undefined {
  const n = text.match(/\b(\d{1,3})\s+(?:latest|recent|last|top|new)?\s*(?:posts|tweets)\b/i)
    ?? text.match(/\b(?:latest|last|recent|top)\s+(\d{1,3})\b/i);
  return n ? Math.min(60, Math.max(1, Number(n[1]))) : undefined;
}

/** Top (most engaged) or latest first. */
export const wantsTop = (text: string) => /\b(top|best|most\s+(?:liked|popular|viral|engaged)|popular|viral|trending|biggest)\b/i.test(text);

const SEARCH_FILLER = new Set(
  "what whats what's are is people saying say says posting post posts tweets tweet on x twitter about the a an in of for from right now latest recent top last hour hours today this week show me find get search look up any news any".split(
    " ",
  ),
);

/** An X search query: the tokens as cashtags, else the message's subject words. */
export function xSearchQuery(text: string): string {
  const symbols = mentionedSymbols(text).filter((s) => !/^X$/i.test(s));
  if (symbols.length) return symbols.map((s) => `$${s.replace(/^\$/, "").toUpperCase()}`).join(" OR ");
  const words = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@\w+/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s#-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SEARCH_FILLER.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 6).join(" ") || text.trim().slice(0, 80);
}

/** A web search query: the message without the instruction to search. */
export function webQuery(text: string): string {
  return text
    .replace(/^\s*(?:please\s+)?(?:search(?:\s+the\s+web|\s+online|\s+google)?(?:\s+for)?|google|look\s+up|find(?:\s+out)?)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Perplexity's recency filter for a window, when the message names one. */
export function recencyOf(minutes: number | undefined): "hour" | "day" | "week" | undefined {
  if (!minutes) return undefined;
  if (minutes <= 60) return "hour";
  if (minutes <= 1_440) return "day";
  return "week";
}

const BASE58 = "[1-9A-HJ-NP-Za-km-z]";

/** Solana transaction signatures (86-88 chars) and addresses (32-44 chars) in a message. */
export function solanaRefs(text: string): { signatures: string[]; addresses: string[] } {
  const signatures = [...text.matchAll(new RegExp(`\\b${BASE58}{86,88}\\b`, "g"))].map((m) => m[0]);
  const addresses = [...text.matchAll(new RegExp(`\\b${BASE58}{32,44}\\b`, "g"))]
    .map((m) => m[0])
    .filter((a) => !signatures.some((s) => s.includes(a)));
  return { signatures: [...new Set(signatures)].slice(0, 2), addresses: [...new Set(addresses)].slice(0, 2) };
}
