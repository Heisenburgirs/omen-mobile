import type { KitMobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-kit";
import { base58, base64 } from "@scure/base";
import { assertWalletRequestActive } from "./wallet-request";

type GenerateMessage = (args: {
  wallet: { address: string };
  from: { domain: string; uri: string };
}) => Promise<{ message: string }>;
export type SignInProof = {
  address: string;
  message: string;
  signature: string;
};

export async function createWalletProof(
  wallet: Pick<KitMobileWallet, "authorize" | "signMessages" | "deauthorize">,
  generateMessage: GenerateMessage,
  network: string,
  signal?: AbortSignal,
): Promise<SignInProof> {
  assertWalletRequestActive(signal);
  const authorization = await wallet.authorize({
    chain: network === "mainnet-beta" ? "solana:mainnet" : "solana:devnet",
    identity: { name: "OMEN", uri: "https://getomen.xyz", icon: "favicon.ico" },
  });
  try {
    assertWalletRequestActive(signal);
    const account = authorization.accounts[0];
    if (!account) throw new Error("Wallet returned no account");
    // Native MWA addresses use base64; Wallet Standard accounts include raw publicKey bytes.
    const publicKey =
      "publicKey" in account
        ? new Uint8Array(account.publicKey)
        : base64.decode(account.address);
    if (publicKey.length !== 32) throw new Error("Invalid wallet address");
    const address = base58.encode(publicKey);
    // Privy issues the nonce and verifies this exact message after wallet approval.
    const { message } = await generateMessage({
      wallet: { address },
      from: { domain: "getomen.xyz", uri: "https://getomen.xyz" },
    });
    assertWalletRequestActive(signal);
    const signedMessages = await wallet.signMessages({
      addresses: [base64.encode(publicKey)],
      payloads: [new TextEncoder().encode(message)],
    });
    assertWalletRequestActive(signal);
    const signed = signedMessages[0];
    if (!signed?.length) throw new Error("Wallet returned no signature");
    // Privy's Expo SIWS flow accepts the complete MWA signed payload, base64 encoded.
    return { address, message, signature: base64.encode(signed) };
  } finally {
    // This milestone uses MWA only for login; don't retain a transaction-signing authorization.
    await wallet
      .deauthorize({ auth_token: authorization.auth_token })
      .catch(() => {});
  }
}
