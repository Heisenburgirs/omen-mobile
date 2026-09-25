import { useCallback } from "react";
import { useEmbeddedSolanaWallet } from "./privy";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";

/**
 * Signs a base64 transaction with the user's Privy embedded Solana wallet
 * and returns the signed bytes, base64 again. The app never holds a key and
 * never talks to an RPC: the backend builds, the wallet signs, the backend
 * sends.
 */
export function useSigner() {
  const wallet = useEmbeddedSolanaWallet();
  const accounts = wallet.wallets ?? [];
  return useCallback(
    async (transactionBase64: string, address?: string): Promise<string> => {
      // The named wallet, else the primary (first).
      const account = address ? accounts.find((a) => a.address === address) : accounts[0];
      if (!account) throw new Error("Your wallet is still being prepared. Try again in a moment.");
      const provider = await account.getProvider();
      const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
      const { signedTransaction } = await provider.request({
        method: "signTransaction",
        params: { transaction },
      });
      return Buffer.from(signedTransaction.serialize()).toString("base64");
    },
    [accounts],
  );
}
