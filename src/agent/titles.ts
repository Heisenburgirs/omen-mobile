// A conversation's name in the side menu: the opening line of the message
// that started it, short enough to read at a glance.
const MAX = 42;

export function titleFrom(text: string, fallback = "New chat"): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  // The first sentence carries the question; what follows is detail.
  const sentence = flat.match(/^.+?[.?!](?=\s|$)/)?.[0] ?? flat;
  let title = sentence;
  if (title.length > MAX) {
    const cut = title.slice(0, MAX);
    const space = cut.lastIndexOf(" ");
    title = `${(space > MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
  } else {
    title = title.replace(/\.$/, "");
  }
  return title.charAt(0).toUpperCase() + title.slice(1);
}
