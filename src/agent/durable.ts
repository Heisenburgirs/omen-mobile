/**
 * What USER.md may hold: how the user wants the agent to behave or to show
 * things. Never money, budgets, holdings or tokens they are after: the agent
 * reads the portfolio live each turn and judges from that, and a wish from
 * one chat must not frame the next.
 */
export function durableLine(category: string, text: string): string | null {
  if (category !== "style" && category !== "preference") return null;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return null;
  if (
    /\$\s?\d|\b\d+(?:[.,]\d+)?\s?(?:k|m|usd|usdc|sol|dollars?|bucks)\b|\b(?:budget|bankroll|balance|holdings?|hold|bought|buy|sell|next|moon|10x|100x)\b/i.test(
      clean,
    )
  )
    return null;
  return `${category}: ${clean}`;
}
