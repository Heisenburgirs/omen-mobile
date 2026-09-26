import { open, seal } from "./identity";
import type { StoredMessage } from "./store";
export type { StoredMessage } from "./store";

// The browser stand-in for the agent's SQLite file: one JSON document in
// localStorage, every value and message sealed under the user's key just as
// on the phone (see identity.ts). A private window or blocked site data
// makes every call degrade to "nothing stored", like the rest of the web
// app's storage.
type Document = {
  kv: Record<string, string>;
  messages: { id: number; owner: string; role: StoredMessage["role"]; text: string; costMicro: number | null; createdAt: number }[];
  nextId: number;
};
const KEY = "omen-agent.v1";
const MAX_MESSAGES = 400;

function read(): Document {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Document;
  } catch {
    // Fall through to an empty document.
  }
  return { kv: {}, messages: [], nextId: 1 };
}
function write(doc: Document): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Not persisted; the conversation lasts for this visit.
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const stored = read().kv[key];
  return stored === undefined ? null : open(stored);
}
export async function kvSet(key: string, value: string): Promise<void> {
  const sealed = await seal(value);
  const doc = read();
  doc.kv[key] = sealed;
  write(doc);
}
export async function kvDelete(key: string): Promise<void> {
  const doc = read();
  delete doc.kv[key];
  write(doc);
}
async function opened(owner: string, limit: number): Promise<StoredMessage[]> {
  const rows = read()
    .messages.filter((m) => m.owner === owner)
    .slice(-limit);
  const out: StoredMessage[] = [];
  for (const { owner: _owner, ...m } of rows) {
    try {
      out.push({ ...m, text: await open(m.text) });
    } catch {
      // Sealed under another key; left unread.
    }
  }
  return out;
}
export const listMessages = (owner: string, limit = 60) => opened(owner, limit);
export async function addMessage(
  owner: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
): Promise<StoredMessage> {
  const sealed = await seal(text);
  const doc = read();
  const message = { id: doc.nextId++, role, text, costMicro, createdAt: Date.now() };
  doc.messages.push({ ...message, owner, text: sealed });
  if (doc.messages.length > MAX_MESSAGES) doc.messages.splice(0, doc.messages.length - MAX_MESSAGES);
  write(doc);
  return message;
}
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  const all = await opened(owner, MAX_MESSAGES);
  return all
    .filter((m) => words.every((w) => m.text.toLowerCase().includes(w)))
    .slice(-limit)
    .reverse();
}
export async function clearMessages(owner: string): Promise<void> {
  const doc = read();
  doc.messages = doc.messages.filter((m) => m.owner !== owner);
  write(doc);
}
