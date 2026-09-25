import { Platform } from "react-native";
import { createWalletProof } from "./seeker-proof";
import { runWalletRequest } from "./wallet-request";

export async function requestWalletProof(
  generateMessage: Parameters<typeof createWalletProof>[1],
  network: string,
  androidWalletPackage: string,
  signal?: AbortSignal,
) {
  if (Platform.OS !== "android")
    throw Object.assign(new Error("Wallet sign-in requires Android"), {
      code: "wallet_requires_android",
    });
  // Keep the selection explicit: never fall back to another wallet.
  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol-kit"
  );
  const association = { baseUri: undefined, androidWalletPackage };
  return runWalletRequest(activeSignal => transact(wallet =>
    createWalletProof(wallet, generateMessage, network, activeSignal), association,
  ), signal);
}
