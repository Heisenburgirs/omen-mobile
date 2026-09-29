import * as SQLite from "expo-sqlite";
import { open, seal } from "./identity";
import { titleFrom } from "./titles";

// The agent's memory on the device: a small SQLite file with a key-value
// table (memory blocks, presets, the channel session), the conversations and
// their messages. Every value, title and message is sealed under the user's
// key (see identity.ts) before it is written, so the file is the agent's and
// the wallet's, not the phone's. Nothing here leaves the device;
// `store.web.ts` keeps the same in localStorage.
export type Attachment = {
  kind: "image" | "text" | "file";
  name: string;
  uri?: string;
  mimeType?: string;
  size?: number;
};
export type StoredMessage = {
  id: number;
  conversation: string;
  role: "user" | "agent";
  text: string;
  /** What the reply cost, in millionths of a USDC; null for the user's own messages. */
  costMicro: number | null;
  createdAt: number;
  attachments?: Attachment[];
};
export type Conversation = { id: string; title: string; createdAt: number; updatedAt: number; pinned?: boolean };

/** Messages written before conversations existed land in this one. */
const LEGACY = "legacy";
/** What the legacy conversation was called before titles came from its first message. */
const PLACEHOLDER = "Earlier chat";

let opening: Promise<SQLite.SQLiteDatabase> | undefined;
function db(): Promise<SQLite.SQLiteDatabase> {
  opening ??= (async () => {
    const database = await SQLite.openDatabaseAsync("omen-agent.db");
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        cost_micro INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_owner ON messages(owner, id);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner, updated_at);
    `);
    // Columns added after the first release of the store.
    for (const column of ["conversation TEXT", "meta TEXT"]) {
      await database.execAsync(`ALTER TABLE messages ADD COLUMN ${column}`).catch(() => undefined);
    }
    await database.execAsync("ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0").catch(() => undefined);
    await database.execAsync("CREATE INDEX IF NOT EXISTS messages_conversation ON messages(owner, conversation, id)");
    return database;
  })();
  return opening;
}

export async function kvGet(key: string): Promise<string | null> {
  const row = await (await db()).getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row ? open(row.value) : null;
}
export async function kvSet(key: string, value: string): Promise<void> {
  const sealed = await seal(value);
  await (await db()).runAsync(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, sealed],
  );
}
export async function kvDelete(key: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM kv WHERE key = ?", [key]);
}

export function newConversationId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return `c_${Date.now().toString(36)}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** The name a conversation takes from the first thing the user said in it. */
async function titleOf(owner: string, conversation: string | null): Promise<string> {
  const row = await (await db()).getFirstAsync<{ text: string; meta: string | null }>(
    conversation === null
      ? "SELECT text, meta FROM messages WHERE owner = ? AND conversation IS NULL AND role = 'user' ORDER BY id LIMIT 1"
      : "SELECT text, meta FROM messages WHERE owner = ? AND conversation = ? AND role = 'user' ORDER BY id LIMIT 1",
    conversation === null ? [owner] : [owner, conversation],
  );
  if (!row) return PLACEHOLDER;
  try {
    const text = await open(row.text);
    const attachment = row.meta ? (JSON.parse(await open(row.meta)) as { attachments?: Attachment[] }).attachments?.[0]?.name : undefined;
    return titleFrom(text, attachment ?? PLACEHOLDER);
  } catch {
    return PLACEHOLDER;
  }
}

/** Gives messages from before conversations a home, once. */
async function adoptLegacy(owner: string): Promise<void> {
  const database = await db();
  const orphan = await database.getFirstAsync<{ n: number; first: number; last: number }>(
    "SELECT count(*) AS n, min(created_at) AS first, max(created_at) AS last FROM messages WHERE owner = ? AND conversation IS NULL",
    [owner],
  );
  if (!orphan?.n) return;
  await database.runAsync(
    "INSERT OR IGNORE INTO conversations (id, owner, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [LEGACY, owner, await seal(await titleOf(owner, null)), orphan.first, orphan.last],
  );
  await database.runAsync("UPDATE messages SET conversation = ? WHERE owner = ? AND conversation IS NULL", [LEGACY, owner]);
}

export async function createConversation(owner: string, title: string, id = newConversationId()): Promise<Conversation> {
  const now = Date.now();
  const clean = titleFrom(title);
  await (await db()).runAsync(
    "INSERT INTO conversations (id, owner, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, owner, await seal(clean), now, now],
  );
  return { id, title: clean, createdAt: now, updatedAt: now };
}

/** The user's conversations: pinned ones first, then the most recent. */
export async function listConversations(owner: string, limit = 60): Promise<Conversation[]> {
  await adoptLegacy(owner);
  const rows = await (await db()).getAllAsync<{ id: string; title: string; created_at: number; updated_at: number; pinned: number }>(
    "SELECT id, title, created_at, updated_at, pinned FROM conversations WHERE owner = ? ORDER BY pinned DESC, updated_at DESC LIMIT ?",
    [owner, limit],
  );
  const out: Conversation[] = [];
  for (const r of rows) {
    try {
      let title = await open(r.title);
      if (title === PLACEHOLDER) {
        title = await titleOf(owner, r.id);
        if (title !== PLACEHOLDER) {
          await (await db()).runAsync("UPDATE conversations SET title = ? WHERE id = ?", [await seal(title), r.id]);
        }
      }
      out.push({ id: r.id, title, createdAt: r.created_at, updatedAt: r.updated_at, pinned: r.pinned === 1 });
    } catch {
      // Sealed under another key; not this user's to read.
    }
  }
  return out;
}
export async function touchConversation(id: string): Promise<void> {
  await (await db()).runAsync("UPDATE conversations SET updated_at = ? WHERE id = ?", [Date.now(), id]);
}
export async function pinConversation(owner: string, id: string, pinned: boolean): Promise<void> {
  await (await db()).runAsync("UPDATE conversations SET pinned = ? WHERE owner = ? AND id = ?", [pinned ? 1 : 0, owner, id]);
}
export async function deleteConversation(owner: string, id: string): Promise<void> {
  const database = await db();
  await database.runAsync("DELETE FROM messages WHERE owner = ? AND conversation = ?", [owner, id]);
  await database.runAsync("DELETE FROM conversations WHERE owner = ? AND id = ?", [owner, id]);
}

type Row = {
  id: number;
  conversation: string | null;
  role: "user" | "agent";
  text: string;
  cost_micro: number | null;
  created_at: number;
  meta: string | null;
};
async function message(r: Row): Promise<StoredMessage> {
  let attachments: Attachment[] | undefined;
  if (r.meta) {
    try {
      attachments = (JSON.parse(await open(r.meta)) as { attachments?: Attachment[] }).attachments;
    } catch {
      attachments = undefined;
    }
  }
  return {
    id: r.id,
    conversation: r.conversation ?? LEGACY,
    role: r.role,
    text: await open(r.text),
    costMicro: r.cost_micro,
    createdAt: r.created_at,
    ...(attachments?.length ? { attachments } : {}),
  };
}
async function opened(rows: Row[]): Promise<StoredMessage[]> {
  const out: StoredMessage[] = [];
  for (const row of rows) {
    try {
      out.push(await message(row));
    } catch {
      // A row sealed under another key stays unread rather than breaking the thread.
    }
  }
  return out;
}
const COLUMNS = "id, conversation, role, text, cost_micro, created_at, meta";

/** The last `limit` messages of a conversation, oldest first. */
export async function listMessages(owner: string, conversation: string, limit = 80): Promise<StoredMessage[]> {
  const rows = await (await db()).getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM messages WHERE owner = ? AND conversation = ? ORDER BY id DESC LIMIT ?`,
    [owner, conversation, limit],
  );
  return opened(rows.reverse());
}
export async function addMessage(
  owner: string,
  conversation: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
  attachments?: Attachment[],
): Promise<StoredMessage> {
  const createdAt = Date.now();
  const sealed = await seal(text);
  const meta = attachments?.length ? await seal(JSON.stringify({ attachments })) : null;
  const result = await (await db()).runAsync(
    "INSERT INTO messages (owner, conversation, role, text, cost_micro, created_at, meta) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [owner, conversation, role, sealed, costMicro, createdAt, meta],
  );
  return {
    id: result.lastInsertRowId,
    conversation,
    role,
    text,
    costMicro,
    createdAt,
    ...(attachments?.length ? { attachments } : {}),
  };
}
/**
 * Past messages across every conversation containing every word of the
 * query, newest first. Sealed text cannot be searched in SQL, so the recent
 * history is opened and searched here; it is bounded, and it is what the
 * agent's recall needs.
 */
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  const rows = await (await db()).getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM messages WHERE owner = ? ORDER BY id DESC LIMIT 400`,
    [owner],
  );
  const all = await opened(rows);
  return all.filter((m) => words.every((w) => m.text.toLowerCase().includes(w))).slice(0, limit);
}
