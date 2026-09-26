import * as SQLite from "expo-sqlite";
import { open, seal } from "./identity";

// The agent's memory on the device: a small SQLite file with a key-value
// table (memory blocks, the channel session) and the conversation. Every
// value and every message is sealed under the user's key (see identity.ts)
// before it is written, so the file is the agent's and the wallet's, not
// the phone's. Nothing here leaves the device; `store.web.ts` keeps the same
// in localStorage.
export type StoredMessage = {
  id: number;
  role: "user" | "agent";
  text: string;
  /** What the reply cost, in millionths of a USDC; null for the user's own messages. */
  costMicro: number | null;
  createdAt: number;
};

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
    `);
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

type Row = { id: number; role: "user" | "agent"; text: string; cost_micro: number | null; created_at: number };
async function message(r: Row): Promise<StoredMessage> {
  return { id: r.id, role: r.role, text: await open(r.text), costMicro: r.cost_micro, createdAt: r.created_at };
}
/** The most recent `limit` messages, opened, oldest first. */
async function recent(owner: string, limit: number): Promise<StoredMessage[]> {
  const rows = await (await db()).getAllAsync<Row>(
    "SELECT id, role, text, cost_micro, created_at FROM messages WHERE owner = ? ORDER BY id DESC LIMIT ?",
    [owner, limit],
  );
  const out: StoredMessage[] = [];
  for (const row of rows.reverse()) {
    try {
      out.push(await message(row));
    } catch {
      // A row sealed under another key stays unread rather than breaking the thread.
    }
  }
  return out;
}

/** The last `limit` messages, oldest first. */
export const listMessages = (owner: string, limit = 60) => recent(owner, limit);
export async function addMessage(
  owner: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
): Promise<StoredMessage> {
  const createdAt = Date.now();
  const sealed = await seal(text);
  const result = await (await db()).runAsync(
    "INSERT INTO messages (owner, role, text, cost_micro, created_at) VALUES (?, ?, ?, ?, ?)",
    [owner, role, sealed, costMicro, createdAt],
  );
  return { id: result.lastInsertRowId, role, text, costMicro, createdAt };
}
/**
 * Past messages containing every word of the query, newest first. Sealed
 * text cannot be searched in SQL, so the recent thread is opened and
 * searched here; it is bounded, and it is what session search needs.
 */
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  const all = await recent(owner, 400);
  return all
    .filter((m) => words.every((w) => m.text.toLowerCase().includes(w)))
    .slice(-limit)
    .reverse();
}
export async function clearMessages(owner: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM messages WHERE owner = ?", [owner]);
}
