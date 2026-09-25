/** RFC 1918 IPv4 address: a development PC on the same Wi-Fi as the phone. */
export function isPrivateLanHost(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}
export function isBalanceApiAllowed(
  apiUrl: string,
  options: { development: boolean; localPreview: boolean; network: string },
): boolean {
  try {
    const url = new URL(apiUrl);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    if (options.development) return true;
    // A bundled local preview can use adb reverse (loopback) or, on a phone,
    // the development PC's private LAN address, on either supported cluster.
    // The balance service still calls Helius over HTTPS; public builds require TLS.
    return (
      options.localPreview &&
      ["mainnet-beta", "devnet"].includes(options.network) &&
      (["127.0.0.1", "10.0.2.2", "localhost"].includes(url.hostname) ||
        isPrivateLanHost(url.hostname))
    );
  } catch {
    return false;
  }
}
