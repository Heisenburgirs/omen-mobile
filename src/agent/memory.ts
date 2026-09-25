import { kvGet, kvSet } from "./store";

// The agent's two memory blocks, in Hermes Agent's shape so they stay
// portable: MEMORY.md (what the agent has learned about the environment and
// the user's holdings) and USER.md (who the user is and how they want the
// agent to behave). Both are bounded, both are injected into the system
// prompt as a frozen snapshot at the start of a session, and when one is
// full the agent has to consolidate before it can add. Entries are plain
// lines; the file itself is what the user could take to another agent.
export type MemoryKind = "memory" | "user";
export const LIMITS: Record<MemoryKind, number> = { memory: 2200, user: 1375 };
const TITLES: Record<MemoryKind, string> = { memory: "MEMORY.md", user: "USER.md" };

const key = (owner: string, kind: MemoryKind) => `agent.${kind}.${owner}`;

export async function loadEntries(owner: string, kind: MemoryKind): Promise<string[]> {
  const raw = await kvGet(key(owner, kind));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}
export async function saveEntries(owner: string, kind: MemoryKind, entries: string[]): Promise<void> {
  await kvSet(key(owner, kind), JSON.stringify(entries));
}
export const renderEntries = (entries: string[]) => entries.map((e) => `- ${e}`).join("\n");
export const used = (entries: string[]) => renderEntries(entries).length;

/** The block as the system prompt shows it, with its usage. */
export function renderBlock(kind: MemoryKind, entries: string[]): string {
  const limit = LIMITS[kind];
  const chars = used(entries);
  const percent = Math.round((chars / limit) * 100);
  const body = entries.length ? renderEntries(entries) : "(empty)";
  return `§ ${TITLES[kind]} (${percent}% — ${chars.toLocaleString()}/${limit.toLocaleString()} chars)\n${body}`;
}

export type RememberResult = "added" | "duplicate" | "full";
/** Adds one line, unless it is already there or the block has no room. */
export async function remember(owner: string, kind: MemoryKind, line: string): Promise<RememberResult> {
  const clean = line.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!clean) return "duplicate";
  const entries = await loadEntries(owner, kind);
  if (entries.some((e) => e.toLowerCase() === clean.toLowerCase())) return "duplicate";
  const next = [...entries, clean];
  if (used(next) > LIMITS[kind]) return "full";
  await saveEntries(owner, kind, next);
  return "added";
}
export async function forget(owner: string, kind: MemoryKind, index: number): Promise<void> {
  const entries = await loadEntries(owner, kind);
  if (index < 0 || index >= entries.length) return;
  entries.splice(index, 1);
  await saveEntries(owner, kind, entries);
}
