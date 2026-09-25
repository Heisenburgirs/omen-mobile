// Which of the user's wallets an action comes from, when the portfolio
// spans the sign-up wallet and an imported one.
import type { Holding } from "../domain/models";

const byHeld = (a: { raw: string }, b: { raw: string }) => (BigInt(b.raw) > BigInt(a.raw) ? 1 : BigInt(b.raw) < BigInt(a.raw) ? -1 : 0);
/**
 * The wallet a sale or a send of `holding` comes from: the one holding the
 * most of it. Undefined (the primary) when the portfolio spans one wallet.
 */
export function walletHolding(holding: Holding | undefined): string | undefined {
  const where = holding?.wallets;
  if (!where || where.length < 2) return where?.[0]?.address;
  return [...where].sort(byHeld)[0].address;
}
/**
 * Splits an amount of `holding` over the wallets that hold it, largest
 * first: a sale of more than one wallet holds is several sales.
 */
export function splitAcrossWallets(holding: Holding | undefined, amount: bigint): { wallet: string | undefined; amount: bigint }[] {
  const where = holding?.wallets;
  if (!where || where.length < 2) return [{ wallet: where?.[0]?.address, amount }];
  const legs: { wallet: string | undefined; amount: bigint }[] = [];
  let left = amount;
  for (const w of [...where].sort(byHeld)) {
    if (left <= 0n) break;
    const held = BigInt(w.raw);
    if (held <= 0n) continue;
    const take = left < held ? left : held;
    legs.push({ wallet: w.address, amount: take });
    left -= take;
  }
  return legs.length ? legs : [{ wallet: where[0].address, amount }];
}
