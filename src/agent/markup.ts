import type { MessageRefs, TokenRef } from "./refs";

// A reply as the chat draws it: paragraphs of segments (plain text, a
// ticker that opens its page, an X handle or post that opens X, a signed
// figure in green or red) with a token's card after the paragraph that
// first names it. Pure, so it is tested without a screen.

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "ticker"; text: string; token: TokenRef | null }
  | { kind: "handle"; text: string; url: string }
  | { kind: "url"; text: string; url: string; label: string }
  | { kind: "number"; text: string; direction: "up" | "down" };
export type Block = { kind: "paragraph"; segments: Segment[] } | { kind: "card"; token: TokenRef };

const MAX_CARDS = 4;

/** Whether a token has figures worth a card. */
export const hasFigures = (t: TokenRef) => t.price != null || t.marketCap != null || t.liquidity != null;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A link's label: the host and path, short. */
export function urlLabel(url: string): string {
  const bare = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const m = bare.match(/^(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/\d+/);
  if (m) return `@${m[1]} on X`;
  return bare.length > 34 ? `${bare.slice(0, 33)}…` : bare;
}

/** The segments of one paragraph. */
export function segments(text: string, refs: MessageRefs): Segment[] {
  const bySymbol = new Map(refs.tokens.map((t) => [t.symbol.toUpperCase(), t]));
  const byHandle = new Map(refs.posts.map((p) => [p.handle.toLowerCase(), p]));
  const known = [...bySymbol.keys()].filter((s) => s.length >= 2);
  const bare = known.length ? `|(^|[^A-Za-z0-9$@])(${known.map(escape).join("|")})(?![A-Za-z0-9])` : "";
  // In order: a URL, an @handle, a $ticker, a signed figure, "up/down N%", a bare known symbol.
  const re = new RegExp(
    String.raw`(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])` +
      String.raw`|(^|[^A-Za-z0-9_])(@[A-Za-z0-9_]{2,15})` +
      String.raw`|(\$[A-Za-z][A-Za-z0-9]{1,9})(?![A-Za-z0-9])` +
      String.raw`|(^|[\s(])([+\-−]\$?\d[\d,]*(?:\.\d+)?(?:%|[KMB])?)(?![A-Za-z0-9])` +
      String.raw`|\b(up|down|gained|lost|rose|fell)(\s+)(\$?\d[\d,]*(?:\.\d+)?(?:%|[KMB])?)(?![A-Za-z0-9])` +
      bare,
    "gi",
  );
  const out: Segment[] = [];
  let last = 0;
  const push = (s: Segment) => {
    const prev = out[out.length - 1];
    if (s.kind === "text" && prev?.kind === "text") prev.text += s.text;
    else if (s.kind !== "text" || s.text) out.push(s);
  };
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) push({ kind: "text", text: text.slice(last, start) });
    const [url, hPre, handle, cashtag, nPre, signed, word, gap, figure, bPre, symbol] = m.slice(1);
    if (url) push({ kind: "url", text: url, url, label: urlLabel(url) });
    else if (handle) {
      push({ kind: "text", text: hPre ?? "" });
      const ref = byHandle.get(handle.slice(1).toLowerCase());
      push({ kind: "handle", text: handle, url: ref?.url && /\/status\//.test(ref.url) ? ref.url : `https://x.com/${handle.slice(1)}` });
    } else if (cashtag) {
      push({ kind: "ticker", text: cashtag, token: bySymbol.get(cashtag.slice(1).toUpperCase()) ?? null });
    } else if (signed) {
      push({ kind: "text", text: nPre ?? "" });
      push({ kind: "number", text: signed, direction: signed.startsWith("+") ? "up" : "down" });
    } else if (word) {
      push({ kind: "text", text: `${word}${gap}` });
      push({ kind: "number", text: figure, direction: /^(up|gained|rose)$/i.test(word) ? "up" : "down" });
    } else if (symbol) {
      push({ kind: "text", text: bPre ?? "" });
      push({ kind: "ticker", text: symbol, token: bySymbol.get(symbol.toUpperCase()) ?? null });
    }
    last = start + m[0].length;
  }
  if (last < text.length) push({ kind: "text", text: text.slice(last) });
  return out;
}

/** The reply as blocks: each paragraph led by the cards of the tokens it names first. */
export function blocks(text: string, refs: MessageRefs): Block[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Block[] = [];
  const carded = new Set<string>();
  for (const p of paragraphs) {
    const segs = segments(p, refs);
    // The card leads: the figures first, then the paragraph that argues from them.
    for (const s of segs) {
      if (s.kind !== "ticker" || !s.token || !hasFigures(s.token)) continue;
      const key = s.token.symbol.toUpperCase();
      if (carded.has(key) || carded.size >= MAX_CARDS) continue;
      carded.add(key);
      out.push({ kind: "card", token: s.token });
    }
    out.push({ kind: "paragraph", segments: segs });
  }
  return out;
}
