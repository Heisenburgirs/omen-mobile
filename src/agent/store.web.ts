import type { StoredMessage } from "./store";
export type { StoredMessage } from "./store";

// The browser stand-in for the agent's SQLite file: one JSON document in
// localStorage. A private window or blocked site data makes every call
// degrade to "nothing stored", like the rest of the web app's storage.
type Document = { kv: Record<string, string>; messages: (StoredMessage & { owner: string })[]; nextId: number };
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
  return read().kv[key] ?? null;
}
export async function kvSet(key: string, value: string): Promise<void> {
  const doc = read();
  doc.kv[key] = value;
  write(doc);
}
export async function kvDelete(key: string): Promise<void> {
  const doc = read();
  delete doc.kv[key];
  write(doc);
}
export async function listMessages(owner: string, limit = 60): Promise<StoredMessage[]> {
  return read()
    .messages.filter((m) => m.owner === owner)
    .slice(-limit)
    .map(({ owner: _owner, ...m }) => m);
}
export async function addMessage(
  owner: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
): Promise<StoredMessage> {
  const doc = read();
  const message = { id: doc.nextId++, role, text, costMicro, createdAt: Date.now() };
  doc.messages.push({ ...message, owner });
  if (doc.messages.length > MAX_MESSAGES) doc.messages.splice(0, doc.messages.length - MAX_MESSAGES);
  write(doc);
  return message;
}
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  return read()
    .messages.filter((m) => m.owner === owner && words.every((w) => m.text.toLowerCase().includes(w)))
    .slice(-limit)
    .reverse()
    .map(({ owner: _owner, ...m }) => m);
}
export async function clearMessages(owner: string): Promise<void> {
  const doc = read();
  doc.messages = doc.messages.filter((m) => m.owner !== owner);
  write(doc);
}
