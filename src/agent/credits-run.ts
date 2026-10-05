import { config } from "../config";
import type { ChatMessage, Writer } from "./harness";
import type { ToolContext } from "./registry";

// The sponsored path: the agent's replies and lookups run through the
// site, which pays Ryvo from the user's free credits.

type RunResult = { data: unknown; chargedMicro: number; balanceMicro: number };

/** One sponsored call. A reply can take half a minute, so this waits longer than a page's data. */
async function run(token: string | null, payload: unknown): Promise<RunResult> {
  if (!token) throw new Error("Please sign in again.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);
  try {
    const r = await fetch(`${config.apiUrl}/api/mobile?resource=agent-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const d = (await r.json().catch(() => null)) as { data?: RunResult; error?: string } | null;
    if (!r.ok || !d?.data) throw new Error(d?.error || "The agent could not be reached. Try again.");
    return d.data;
  } finally {
    clearTimeout(timer);
  }
}

/** The agent's replies, paid from credits. */
export function sponsoredWriter(getToken: () => Promise<string | null>, onBalance: (micro: number) => void): Writer {
  return async (messages: ChatMessage[], options) => {
    const started = Date.now();
    const out = await run(await getToken(), {
      kind: "chat",
      body: {
        model: options.model,
        messages,
        max_tokens: options.maxTokens,
        ...(options.reasoning ? { reasoning_effort: options.reasoning } : {}),
        temperature: 0.4,
      },
    });
    onBalance(out.balanceMicro);
    const raw = (out.data as { choices?: { message?: { content?: string | { text?: string }[] } }[] } | null)?.choices?.[0]?.message?.content;
    const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : "";
    return { content, costMicro: out.chargedMicro, timings: [{ label: "credits", ms: Date.now() - started }] };
  };
}

/** The agent's lookups (X, web, chain), paid from credits. */
export function sponsoredTool(getToken: () => Promise<string | null>, onBalance: (micro: number) => void): NonNullable<ToolContext["paid"]> {
  return async (id, input) => {
    const out = await run(await getToken(), { kind: "tool", id, input });
    onBalance(out.balanceMicro);
    return { data: out.data, costMicro: out.chargedMicro };
  };
}
