import Constants from "expo-constants";
import { Platform } from "react-native";
import { isBalanceApiAllowed } from "./lib/balance-api-policy";

// In a browser the app is served by the site that hosts its API
// (www.getomen.xyz/app beside /api/mobile), so the API is simply this origin:
// no CORS, and a preview deployment talks to its own backend.
const sameOrigin =
  Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
export const config = {
  appId: process.env.EXPO_PUBLIC_PRIVY_APP_ID?.trim() || "",
  clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID?.trim() || "",
  apiUrl: (sameOrigin || process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3100").replace(
    /\/$/,
    "",
  ),
  network: process.env.EXPO_PUBLIC_SOLANA_NETWORK || "mainnet-beta",
  /** The website; shared token links point at its token pages. */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || "https://www.getomen.xyz").replace(
    /\/$/,
    "",
  ),
  localPreview: Constants.expoConfig?.extra?.localPreview === true,
};
export const isConfigured = Boolean(config.appId && config.clientId);
export function configurationError(): string | null {
  if (!isConfigured)
    return "Add your Privy App ID and App Client ID to .env, then restart the app to enable sign-in.";
  if (!["devnet", "mainnet-beta"].includes(config.network))
    return "Use devnet or mainnet-beta for EXPO_PUBLIC_SOLANA_NETWORK.";
  if (!sameOrigin && !isBalanceApiAllowed(config.apiUrl, {
    development: __DEV__,
    localPreview: config.localPreview,
    network: config.network,
  }))
    return "This build needs an HTTPS balance API.";
  return null;
}
