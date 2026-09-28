import { Platform } from "react-native";
import { install as installEd25519 } from "@solana/webcrypto-ed25519-polyfill";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2";
import { sha1 } from "@noble/hashes/sha1";

// What Ryvo's channel client expects from the platform and Hermes does not
// have. A browser has all of it, so on the web this does nothing.
//
// - `crypto.subtle` Ed25519: the delegated voucher key is a WebCrypto key in
//   Solana's kit, so Solana's own polyfill provides the curve in userspace.
// - `crypto.subtle.digest`: request fingerprints and voucher hashes use
//   SHA-256, and the Ed25519 polyfill derives keys with SHA-512; a few
//   lines over noble's hashes cover the SHA family.
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
    const hashes: Record<string, (data: Uint8Array) => Uint8Array> = {
      "SHA-1": sha1,
      "SHA-256": sha256,
      "SHA-384": sha384,
      "SHA-512": sha512,
    };
    subtle.digest = async (algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView) => {
      const name = (typeof algorithm === "string" ? algorithm : algorithm.name).toUpperCase();
      const hash = hashes[name];
      if (!hash) throw new Error(`Unsupported digest: ${name}`);
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const digest = hash(bytes);
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
