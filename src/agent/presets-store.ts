import { emptyPresets, type PresetDoc } from "./presets";
import { kvGet, kvSet } from "./store";

// The presets document in the agent's sealed store, one per user.
const key = (owner: string) => `agent.presets.${owner}`;

export async function loadPresets(owner: string): Promise<PresetDoc> {
  const raw = await kvGet(key(owner)).catch(() => null);
  if (!raw) return emptyPresets();
  try {
    const doc = JSON.parse(raw) as PresetDoc;
    return doc?.v === 2 ? { ...emptyPresets(), ...doc } : emptyPresets();
  } catch {
    return emptyPresets();
  }
}
export async function savePresets(owner: string, doc: PresetDoc): Promise<void> {
  await kvSet(key(owner), JSON.stringify(doc));
}
