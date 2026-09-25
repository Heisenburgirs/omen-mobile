// All accounting amounts are bigint fixed point, never floating point balances.
export const SCALE = 1_000_000_000_000_000_000n;
export function decimal(s: string | number): bigint {
  const v = expandDecimal(String(s));
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw Error("Invalid decimal");
  const neg = v.startsWith("-"),
    [w, f = ""] = v.replace("-", "").split(".");
  return (
    (BigInt(w) * SCALE + BigInt(f.slice(0, 18).padEnd(18, "0"))) *
    (neg ? -1n : 1n)
  );
}
export function decimalString(n: bigint): string {
  const a = n < 0n ? -n : n;
  return (
    (n < 0n ? "-" : "") +
    a / SCALE +
    "." +
    (a % SCALE).toString().padStart(18, "0")
  );
}
export function quantity(raw: string, decimals: number): string {
  if (
    !/^\d+$/.test(raw) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 30
  )
    throw Error("Invalid token amount");
  const r = raw.padStart(decimals + 1, "0");
  return decimals ? r.slice(0, -decimals) + "." + r.slice(-decimals) : r;
}
export function valuation(
  raw: string,
  decimals: number,
  price: string,
): string {
  return decimalString(
    (BigInt(raw) * decimal(price)) / 10n ** BigInt(decimals),
  );
}
export type Lot = {
  raw: bigint;
  cost: bigint | null;
  weekBasis: bigint | null;
  dividend: boolean;
};
export function reduceLots(lots: Lot[], raw: bigint): Lot[] {
  const total = lots.reduce((s, l) => s + l.raw, 0n);
  if (raw < 0n || raw > total) throw Error("Unreconciled quantity");
  if (!total) return [];
  const remaining = total - raw;
  let assigned = 0n;
  return lots
    .map((l, i) => {
      const q =
        i === lots.length - 1
          ? remaining - assigned
          : (l.raw * remaining) / total;
      assigned += q;
      return {
        ...l,
        raw: q,
        cost: l.cost === null ? null : l.raw ? (l.cost * q) / l.raw : 0n,
        weekBasis:
          l.weekBasis === null ? null : l.raw ? (l.weekBasis * q) / l.raw : 0n,
      };
    })
    .filter((l) => l.raw > 0n);
}
export function positionMetrics(lots: Lot[], decimals: number, price: string) {
  const p = decimal(price),
    units = 10n ** BigInt(decimals);
  const raw = lots.reduce((s, l) => s + l.raw, 0n);
  const unknown = lots.some((l) => l.cost === null);
  const cost = lots.reduce((s, l) => s + (l.cost ?? 0n), 0n);
  const ranked = lots.filter((l) => !l.dividend);
  const weekUnknown = ranked.some(
    (l) => l.weekBasis === null || l.cost === null,
  );
  const weekBasis = ranked.reduce((s, l) => s + (l.weekBasis ?? 0n), 0n);
  const rankedValue = (ranked.reduce((s, l) => s + l.raw, 0n) * p) / units;
  return {
    value: (raw * p) / units,
    unrealized: unknown ? null : (raw * p) / units - cost,
    averageEntry: unknown || !raw ? null : (cost * units) / raw,
    weekly: weekUnknown ? null : rankedValue - weekBasis,
    weeklyBasis: weekBasis,
  };
}
export function periodPnl(
  start: bigint | null,
  end: bigint | null,
  netExternalIn: bigint,
  dividends: bigint,
  complete: boolean,
): bigint | null {
  return !complete || start === null || end === null
    ? null
    : end - start - netExternalIn - dividends;
}
export function eligibleRank(
  value: bigint,
  weekly: bigint | null,
  liquidity: number | null,
  priceAt: string | null,
  complete: boolean,
  now = Date.now(),
) {
  return (
    complete &&
    weekly !== null &&
    weekly > 0n &&
    value >= 100n * SCALE &&
    liquidity !== null &&
    liquidity >= 10000 &&
    priceAt !== null &&
    now - Date.parse(priceAt) <= 120000 &&
    Date.parse(priceAt) <= now + 5000
  );
}

export function expandDecimal(s: string): string {
  if (!/[eE]/.test(s)) return s;
  const match = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) throw Error("Invalid decimal");
  const [, sign, whole, fraction = "", exp] = match,
    shift = Number(exp);
  if (Math.abs(shift) > 100) throw Error("Decimal exponent out of range");
  const digits = whole + fraction,
    point = whole.length + shift;
  return (
    sign +
    (point <= 0
      ? "0." + "0".repeat(-point) + digits
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : digits.slice(0, point) + "." + digits.slice(point))
  );
}

// Approximate period return using capital weighted by time in the account.
// Dividend receipts count as added capital here because periodPnl excludes their value.
export function periodReturnPercent(
  pnl: bigint | null,
  opening: bigint | null,
  startMs: number,
  endMs: number,
  flows: { amount: bigint; time: number }[],
): number | null {
  if (
    pnl === null ||
    opening === null ||
    opening < 0n ||
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    endMs <= startMs
  )
    return null;
  const duration = BigInt(endMs - startMs);
  let weightedCapital = opening * duration;
  for (const flow of flows) {
    if (
      !Number.isSafeInteger(flow.time) ||
      flow.time < startMs ||
      flow.time > endMs
    )
      return null;
    weightedCapital += flow.amount * BigInt(endMs - flow.time);
  }
  if (weightedCapital <= 0n) return null;
  const percent =
    Number((pnl * duration * 100_000_000n) / weightedCapital) / 1_000_000;
  return Number.isFinite(percent) ? percent : null;
}
