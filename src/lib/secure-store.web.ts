// expo-secure-store has no web build. What the app keeps here is
// preferences (onboarding seen, balances hidden, chart settings), nothing
// secret, so the browser's localStorage is enough. Private windows and
// blocked site data make it throw: every call degrades to "nothing stored".
export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not persisted; the preference lasts for this visit.
  }
}
export async function deleteItemAsync(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
