// The Expo SDK's wallet import under the shape the web adapter presents
// (privy.web.tsx has its own): a base58 Solana key in, the new wallet's
// address out, with OMEN's signers attached in the same step.
import { useCallback } from "react";
import { useImportWallet as useExpoImportWallet } from "@privy-io/expo";

export function useImportWallet() {
  const { importWallet } = useExpoImportWallet();
  const run = useCallback(
    async (input: { privateKey: string; additionalSigners?: { signerId: string; policyIds?: string[] }[] }) => {
      const { wallet } = await importWallet({
        privateKey: input.privateKey,
        chainType: "solana",
        additionalSigners: input.additionalSigners,
      });
      return { address: wallet.address };
    },
    [importWallet],
  );
  return { importWallet: run };
}
