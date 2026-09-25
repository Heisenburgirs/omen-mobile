// (.tsx like its web twin: Metro picks by extension before platform, so a
// plain .ts here would shadow privy.web.tsx in the browser build.)
// Every Privy hook the app uses comes through here. On a phone this is the
// Expo SDK as it is; in a browser `privy.web.tsx` presents the web SDK
// (@privy-io/react-auth) under the same names and shapes, because the Expo
// SDK has no web build. Import Privy from this file only.
export {
  PrivyProvider,
  usePrivy,
  useSigners,
  useEmbeddedSolanaWallet,
  useLoginWithOAuth,
  useLoginWithSiws,
  useLinkWithOAuth,
  useUnlinkOAuth,
} from "@privy-io/expo";
export { useImportWallet } from "./privy-import";
export { useWalletLogin } from "./wallet-login-native";
export { PrivyElements } from "@privy-io/expo/ui";
