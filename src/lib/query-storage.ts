// Where the query cache sleeps between launches on a phone: SQLite's
// key-value store (one row, rewritten a couple of seconds after the last
// change). The web twin uses localStorage.
import Storage from "expo-sqlite/kv-store";

export const queryStorage = {
  getItem: (key: string) => Storage.getItemAsync(key),
  setItem: (key: string, value: string) => Storage.setItemAsync(key, value),
  removeItem: async (key: string) => {
    await Storage.removeItemAsync(key);
  },
};
