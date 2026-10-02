import { solanaRefs, webQuery, xHandles, xSearchQuery } from "./extract";

// The live line under a message while the agent works: what it is doing
// right now, in a few words, the way a person would say it. The harness
// emits one line per step; the screen shows the latest.

const handleOf = (text: string) => {
  const h = xHandles(text)[0];
  return h ? `@${h}` : "that account";
};
/** " for $PUMPE" when the query is short enough to read at a glance; nothing otherwise. */
const about = (q: string) => (q.trim().length > 0 && q.trim().length <= 18 ? ` for ${q.trim()}` : "");

/** What a tool is doing, for the user to read while it runs. */
export function toolStatus(id: string, text: string): string {
  switch (id) {
    case "balance":
      return "Reading your portfolio";
    case "agent_balance":
      return "Checking my balance";
    case "pnl":
      return "Working out your P&L";
    case "dividends":
    case "payouts":
      return "Reading your payouts";
    case "activity":
      return "Reading your activity";
    case "asset":
      return "Looking up the token";
    case "quote":
      return "Getting a quote";
    case "drip":
      return "Checking your drip rules";
    case "market":
      return "Scanning the market";
    case "tokens":
      return "Looking through tokens";
    case "recall":
      return "Checking earlier chats";
    case "x_posts":
      return `Reading ${handleOf(text)}'s posts`;
    case "x_profile":
      return `Looking up ${handleOf(text)}`;
    case "x_mentions":
      return `Reading mentions of ${handleOf(text)}`;
    case "x_search":
      return `Searching X${about(xSearchQuery(text))}`;
    case "x_replies":
      return "Reading the replies";
    case "web_search":
      return `Searching the web${about(webQuery(text))}`;
    case "web_research":
      return "Reading up on it";
    case "chain_lookup": {
      const { signatures, addresses } = solanaRefs(text);
      return signatures[0] ? "Reading the transaction" : addresses[0] ? "Looking at the wallet on chain" : "Looking on chain";
    }
    default:
      return `Looking up ${id.replace(/_/g, " ")}`;
  }
}

/** The line for the steps still running: up to two named, the rest counted. */
export function statusLine(running: string[]): string {
  const unique = [...new Set(running)];
  if (unique.length === 0) return "";
  if (unique.length <= 2) return unique.join(" · ");
  return `${unique.slice(0, 2).join(" · ")} +${unique.length - 2}`;
}

/** What the writing step says, by the kind of answer. */
export function writingStatus(tier: string): string {
  return tier === "judge" ? "Thinking it through" : tier === "explain" ? "Putting it together" : "Writing";
}
