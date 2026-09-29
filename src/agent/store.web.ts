import { open, seal } from "./identity";
import { titleFrom } from "./titles";
import type { Attachment, Conversation, StoredMessage } from "./store";
export type { Attachment, Conversation, StoredMessage } from "./store";

// The browser stand-in for the agent's SQLite file: one JSON document in
// localStorage, every value, title and message sealed under the user's key
// just as on the phone (see identity.ts). A private window or blocked site
// data makes every call degrade to "nothing stored", like the rest of the
// web app's storage.
type StoredRow = {
  id: number;
  owner: string;
  conversation?: string;
  role: StoredMessage["role"];
  text: string;
  costMicro: number | null;
  createdAt: number;
  meta?: string;
};
type StoredConversation = { id: string; owner: string; title: string; createdAt: number; updatedAt: number; pinned?: boolean };
type Document = { kv: Record<string, string>; messages: StoredRow[]; conversations?: StoredConversation[]; nextId: number };
const KEY = "omen-agent.v1";
const MAX_MESSAGES = 600;
const LEGACY = "legacy";
const PLACEHOLDER = "Earlier chat";

function read(): Document {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const doc = JSON.parse(raw) as Document;
      doc.conversations ??= [];
      return doc;
    }
  } catch {
    // Fall through to an empty document.
  }
  return { kv: {}, messages: [], conversations: [], nextId: 1 };
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

export function newConversationId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return `c_${Date.now().toString(36)}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function titleOf(rows: StoredRow[]): Promise<string> {
  const first = rows.find((m) => m.role === "user");
  if (!first) return PLACEHOLDER;
  try {
    const attachment = first.meta ? (JSON.parse(await open(first.meta)) as { attachments?: Attachment[] }).attachments?.[0]?.name : undefined;
    return titleFrom(await open(first.text), attachment ?? PLACEHOLDER);
  } catch {
    return PLACEHOLDER;
  }
}

async function adoptLegacy(owner: string): Promise<void> {
  const doc = read();
  const orphans = doc.messages.filter((m) => m.owner === owner && !m.conversation);
  if (!orphans.length) return;
  if (!doc.conversations!.some((c) => c.id === LEGACY && c.owner === owner)) {
    doc.conversations!.push({
      id: LEGACY,
      owner,
      title: await seal(await titleOf(orphans)),
      createdAt: orphans[0].createdAt,
      updatedAt: orphans[orphans.length - 1].createdAt,
    });
  }
  for (const m of orphans) m.conversation = LEGACY;
  write(doc);
}

export async function createConversation(owner: string, title: string, id = newConversationId()): Promise<Conversation> {
  const now = Date.now();
  const clean = titleFrom(title);
  const sealed = await seal(clean);
  const doc = read();
  doc.conversations!.push({ id, owner, title: sealed, createdAt: now, updatedAt: now });
  write(doc);
  return { id, title: clean, createdAt: now, updatedAt: now };
}
export async function listConversations(owner: string, limit = 60): Promise<Conversation[]> {
  await adoptLegacy(owner);
  const rows = read()
    .conversations!.filter((c) => c.owner === owner)
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.updatedAt - a.updatedAt)
    .slice(0, limit);
  const out: Conversation[] = [];
  for (const r of rows) {
    try {
      let title = await open(r.title);
      if (title === PLACEHOLDER) {
        const doc = read();
        title = await titleOf(doc.messages.filter((m) => m.owner === owner && m.conversation === r.id));
        const row = doc.conversations!.find((c) => c.id === r.id);
        if (title !== PLACEHOLDER && row) {
          row.title = await seal(title);
          write(doc);
        }
      }
      out.push({ id: r.id, title, createdAt: r.createdAt, updatedAt: r.updatedAt, pinned: r.pinned === true });
    } catch {
      // Sealed under another key.
    }
  }
  return out;
}
export async function touchConversation(id: string): Promise<void> {
  const doc = read();
  const c = doc.conversations!.find((x) => x.id === id);
  if (c) c.updatedAt = Date.now();
  write(doc);
}
export async function pinConversation(owner: string, id: string, pinned: boolean): Promise<void> {
  const doc = read();
  const c = doc.conversations!.find((x) => x.owner === owner && x.id === id);
  if (c) c.pinned = pinned;
  write(doc);
}
export async function deleteConversation(owner: string, id: string): Promise<void> {
  const doc = read();
  doc.messages = doc.messages.filter((m) => !(m.owner === owner && m.conversation === id));
  doc.conversations = doc.conversations!.filter((c) => !(c.owner === owner && c.id === id));
  write(doc);
}

async function opened(rows: StoredRow[]): Promise<StoredMessage[]> {
  const out: StoredMessage[] = [];
  for (const m of rows) {
    try {
      let attachments: Attachment[] | undefined;
      if (m.meta) attachments = (JSON.parse(await open(m.meta)) as { attachments?: Attachment[] }).attachments;
      out.push({
        id: m.id,
        conversation: m.conversation ?? LEGACY,
        role: m.role,
        text: await open(m.text),
        costMicro: m.costMicro,
        createdAt: m.createdAt,
        ...(attachments?.length ? { attachments } : {}),
      });
    } catch {
      // Sealed under another key; left unread.
    }
  }
  return out;
}
export async function listMessages(owner: string, conversation: string, limit = 80): Promise<StoredMessage[]> {
  return opened(read().messages.filter((m) => m.owner === owner && m.conversation === conversation).slice(-limit));
}
export async function addMessage(
  owner: string,
  conversation: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
  attachments?: Attachment[],
): Promise<StoredMessage> {
  const sealed = await seal(text);
  const meta = attachments?.length ? await seal(JSON.stringify({ attachments })) : undefined;
  const doc = read();
  const createdAt = Date.now();
  const id = doc.nextId++;
  doc.messages.push({ id, owner, conversation, role, text: sealed, costMicro, createdAt, ...(meta ? { meta } : {}) });
  if (doc.messages.length > MAX_MESSAGES) doc.messages.splice(0, doc.messages.length - MAX_MESSAGES);
  write(doc);
  return { id, conversation, role, text, costMicro, createdAt, ...(attachments?.length ? { attachments } : {}) };
}
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  const all = await opened(read().messages.filter((m) => m.owner === owner).slice(-400));
  return all
    .filter((m) => words.every((w) => m.text.toLowerCase().includes(w)))
    .reverse()
    .slice(0, limit);
}
