// Node's "crypto" module, as much of it as Ryvo's payment-channel package
// imports, for the phone. Metro maps "crypto" and "node:crypto" here on
// native only (see metro.config.js); a browser bundle resolves its own.
const { getRandomValues, randomUUID: expoRandomUUID } = require("expo-crypto");

function randomUUID() {
  if (typeof expoRandomUUID === "function") return expoRandomUUID();
  const bytes = getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

module.exports = {
  randomUUID,
  getRandomValues: (array) => getRandomValues(array),
  get webcrypto() {
    return globalThis.crypto;
  },
  get subtle() {
    return globalThis.crypto && globalThis.crypto.subtle;
  },
};
