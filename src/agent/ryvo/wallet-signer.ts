import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { getBase58Encoder, getBase64EncodedWireTransaction } from "@solana/kit";
import type { RyvoChannelClientOptions } from "@ryvo/channel-client";

// The user's Privy embedded wallet, presented to Ryvo's channel client as a
// Solana kit signer. The wallet signs three kinds of things: the channel's
// open, top-up and close transactions, and the short text authorizations
// that let it read its own channel and payments. Vouchers are signed by a
// separate key the client keeps, never by the wallet.
//
// Privy's provider works in web3.js terms (a VersionedTransaction in, a
// signed one out; a message string in, a signature string out), so this
// converts each way and checks every signature against the wallet's public
// key before handing it back.

/** The subset of Privy's Solana provider the signer uses, the same on native and web. */
export type WalletProvider = {
  request(args: {
    method: "signTransaction";
    params: { transaction: VersionedTransaction };
  }): Promise<{ signedTransaction: VersionedTransaction }>;
  request(args: { method: "signMessage"; params: { message: string } }): Promise<{ signature: string }>;
};

type KitTransaction = { messageBytes: Uint8Array; signatures: Record<string, Uint8Array | null> };
type KitSignableMessage = { content: Uint8Array };

export type WalletSigner = RyvoChannelClientOptions["wallet"];

function decodeSignature(value: string): Uint8Array | null {
  for (const encoding of ["base64", "base58"] as const) {
    try {
      const bytes =
        encoding === "base64"
          ? new Uint8Array(Buffer.from(value, "base64"))
          : new Uint8Array(getBase58Encoder().encode(value));
      if (bytes.length === 64) return bytes;
    } catch {
      // Try the other encoding.
    }
  }
  return null;
}

/**
 * Signs bytes with a Privy wallet and verifies the result. How this Privy
 * SDK reads the `message` string (as base64 of the bytes to sign, or as the
 * text itself) is learned from the first signature that verifies, then kept.
 */
export function messageSigner(
  address: string,
  getProvider: () => Promise<WalletProvider>,
): (content: Uint8Array) => Promise<Uint8Array> {
  const publicKey = new Uint8Array(getBase58Encoder().encode(address));
  let messageMode: "base64" | "text" | undefined;
  return async (content: Uint8Array) => {
    const provider = await getProvider();
    const modes = messageMode ? [messageMode] : (["base64", "text"] as const);
    for (const mode of modes) {
      let message: string;
      if (mode === "base64") message = Buffer.from(content).toString("base64");
      else {
        message = Buffer.from(content).toString("utf8");
        if (Buffer.from(message, "utf8").length !== content.length) continue;
      }
      const { signature } = await provider.request({ method: "signMessage", params: { message } });
      const bytes = decodeSignature(signature);
      if (bytes && ed25519.verify(bytes, content, publicKey)) {
        messageMode = mode;
        return bytes;
      }
    }
    throw new Error("Your wallet could not sign the request.");
  };
}

export function walletSigner(
  address: string,
  getProvider: () => Promise<WalletProvider>,
): WalletSigner {
  const publicKey = new Uint8Array(getBase58Encoder().encode(address));
  const signMessage = messageSigner(address, getProvider);

  const signer = {
    address,
    async signTransactions(transactions: readonly KitTransaction[]) {
      const provider = await getProvider();
      const out: Record<string, Uint8Array>[] = [];
      for (const transaction of transactions) {
        const wire = getBase64EncodedWireTransaction(transaction as never);
        const parsed = VersionedTransaction.deserialize(new Uint8Array(Buffer.from(wire, "base64")));
        const { signedTransaction } = await provider.request({
          method: "signTransaction",
          params: { transaction: parsed },
        });
        const keys = signedTransaction.message.staticAccountKeys;
        const index = keys.findIndex((key) => key.toBase58() === address);
        const signature = index >= 0 ? signedTransaction.signatures[index] : undefined;
        if (!signature || signature.every((byte) => byte === 0)) throw new Error("Your wallet did not sign the transaction.");
        if (!ed25519.verify(signature, signedTransaction.message.serialize(), publicKey))
          throw new Error("Your wallet's signature did not verify.");
        out.push({ [address]: new Uint8Array(signature) });
      }
      return out;
    },
    async signMessages(messages: readonly KitSignableMessage[]) {
      const out: Record<string, Uint8Array>[] = [];
      for (const message of messages) out.push({ [address]: await signMessage(message.content) });
      return out;
    },
  };
  return signer as unknown as WalletSigner;
}
