export type Balance = {
  address: string;
  network: "devnet" | "mainnet-beta";
  lamports: string;
  slot: number;
  observedAt: string;
};
export class BalanceError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function fetchBalance(
  apiUrl: string,
  address: string,
  token: string,
  network: string,
  signal?: AbortSignal,
): Promise<Balance> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(
      apiUrl + "/api/balance?address=" + encodeURIComponent(address),
      {
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal,
      },
    );
    const body = await response.json();
    if (!response.ok)
      throw new BalanceError(
        response.status === 401
          ? "Your session expired. Sign in again."
          : body.error || "Balance unavailable. Please retry.",
        response.status,
      );
    if (
      body.address !== address ||
      body.network !== network ||
      typeof body.lamports !== "string" ||
      !/^\d+$/.test(body.lamports) ||
      !Number.isInteger(body.slot) ||
      !Number.isFinite(Date.parse(body.observedAt))
    )
      throw new BalanceError(
        "The balance service returned unexpected data. Check that both networks match.",
      );
    return body;
  } catch (error) {
    if (error instanceof BalanceError) throw error;
    throw new BalanceError(
      "Could not reach the balance service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export function formatSol(lamports: string): string {
  const value = BigInt(lamports);
  const whole = value / 1000000000n;
  const decimals = (value % 1000000000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return whole.toLocaleString("en-US") + (decimals ? "." + decimals : "");
}
export function shortAddress(address: string): string {
  return address.slice(0, 6) + "…" + address.slice(-6);
}
