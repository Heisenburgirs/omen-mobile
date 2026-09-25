import { Platform } from "react-native";
import { install as installEd25519 } from "@solana/webcrypto-ed25519-polyfill";
import { sha256 } from "@noble/hashes/sha2";

// What Ryvo's channel client expects from the platform and Hermes does not
// have. A browser has all of it, so on the web this does nothing.
//
// - `crypto.subtle` Ed25519: the delegated voucher key is a WebCrypto key in
//   Solana's kit, so Solana's own polyfill provides the curve in userspace.
// - `crypto.subtle.digest("SHA-256")`: request fingerprints and voucher
//   hashes; a few lines over noble's SHA-256.
// - `AbortSignal.timeout`: React Native's AbortSignal polyfill has no
//   `timeout` factory.
// - `structuredClone`: only the client's in-memory session store uses it,
//   but a JSON round trip keeps the module loadable everywhere.
//
// `crypto.getRandomValues` is already installed by react-native-get-random-values.
let installed = false;
export function installAgentPolyfills(): void {
  if (installed || Platform.OS === "web") return;
  installed = true;
  const g = globalThis as unknown as {
    crypto?: { subtle?: Record<string, unknown> };
    structuredClone?: (value: unknown) => unknown;
  };
  g.crypto ||= {};
  installEd25519();
  const subtle = (g.crypto.subtle ||= {});
  if (typeof subtle.digest !== "function") {
    subtle.digest = async (algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView) => {
      const name = (typeof algorithm === "string" ? algorithm : algorithm.name).toUpperCase();
      if (name !== "SHA-256") throw new Error(`Unsupported digest: ${name}`);
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const digest = sha256(bytes);
      return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
    };
  }
  const signal = globalThis.AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal } | undefined;
  if (signal && typeof signal.timeout !== "function") {
    signal.timeout = (ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error("The request timed out.")), ms);
      return controller.signal;
    };
  }
  if (typeof g.structuredClone !== "function") {
    g.structuredClone = (value: unknown) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  }
}
