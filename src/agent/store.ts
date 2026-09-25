import * as SQLite from "expo-sqlite";

// The agent's memory on the device: a small SQLite file with a key-value
// table (memory blocks, the channel session) and the conversation. Nothing
// here leaves the phone; `store.web.ts` keeps the same in localStorage.
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
  return row?.value ?? null;
}
export async function kvSet(key: string, value: string): Promise<void> {
  await (await db()).runAsync(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
export async function kvDelete(key: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM kv WHERE key = ?", [key]);
}

type Row = { id: number; role: "user" | "agent"; text: string; cost_micro: number | null; created_at: number };
const message = (r: Row): StoredMessage => ({
  id: r.id,
  role: r.role,
  text: r.text,
  costMicro: r.cost_micro,
  createdAt: r.created_at,
});

/** The last `limit` messages, oldest first. */
export async function listMessages(owner: string, limit = 60): Promise<StoredMessage[]> {
  const rows = await (await db()).getAllAsync<Row>(
    "SELECT id, role, text, cost_micro, created_at FROM messages WHERE owner = ? ORDER BY id DESC LIMIT ?",
    [owner, limit],
  );
  return rows.reverse().map(message);
}
export async function addMessage(
  owner: string,
  role: StoredMessage["role"],
  text: string,
  costMicro: number | null = null,
): Promise<StoredMessage> {
  const createdAt = Date.now();
  const result = await (await db()).runAsync(
    "INSERT INTO messages (owner, role, text, cost_micro, created_at) VALUES (?, ?, ?, ?, ?)",
    [owner, role, text, costMicro, createdAt],
  );
  return { id: result.lastInsertRowId, role, text, costMicro, createdAt };
}
/** Past messages containing every word of the query, newest first. */
export async function searchMessages(owner: string, query: string, limit = 8): Promise<StoredMessage[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  if (!words.length) return [];
  const where = words.map(() => "lower(text) LIKE ?").join(" AND ");
  const rows = await (await db()).getAllAsync<Row>(
    `SELECT id, role, text, cost_micro, created_at FROM messages WHERE owner = ? AND ${where} ORDER BY id DESC LIMIT ?`,
    [owner, ...words.map((w) => `%${w}%`), limit],
  );
  return rows.map(message);
}
export async function clearMessages(owner: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM messages WHERE owner = ?", [owner]);
}
