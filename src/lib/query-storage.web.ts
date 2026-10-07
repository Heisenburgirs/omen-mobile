// The browser's copy of the query cache: localStorage, when it is allowed.
const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};
export const queryStorage = {
  getItem: async (key: string) => safe(() => window.localStorage.getItem(key), null),
  setItem: async (key: string, value: string) => {
    safe(() => window.localStorage.setItem(key, value), undefined);
  },
  removeItem: async (key: string) => {
    safe(() => window.localStorage.removeItem(key), undefined);
  },
};
