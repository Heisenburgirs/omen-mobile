import type { ExpoConfig } from "expo/config";
const development = process.env.APP_VARIANT !== "production";
// Play Console needs a strictly increasing versionCode; scripts/release.ps1 sets it.
const buildNumber = Number(process.env.OMEN_BUILD_NUMBER) || 1;
const config: ExpoConfig = {
  name: development ? "OMEN Dev" : "OMEN",
  slug: "omen-mobile",
  platforms: ["android", "web"],
  version: "0.1.0",
  orientation: "portrait",
  scheme: development ? "omen-dev" : "omen",
  userInterfaceStyle: "dark",
  extra: { localPreview: process.env.APP_VARIANT === "local-preview" },
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: development ? "xyz.getomen.app.dev" : "xyz.getomen.app",
    supportsTablet: false,
  },
  android: {
    // Play Console listing was created as com.omen.myapp (2026-09-20); the
    // development build keeps its own id so both install side by side.
    package: development ? "xyz.getomen.app.dev" : "com.omen.myapp",
    versionCode: buildNumber,
    adaptiveIcon: {
      foregroundImage: "./assets/omen-adaptive-icon.png",
      backgroundColor: "#070707",
    },
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
    ],
  },
  // The web app: a single-page export served at www.getomen.xyz/app, the
  // same origin as its API. Privy and the wallet only exist in a browser, so
  // nothing is rendered ahead of time ("single", not "static").
  web: {
    bundler: "metro",
    output: "single",
    name: "OMEN",
    shortName: "OMEN",
    backgroundColor: "#070707",
    themeColor: "#070707",
  },
  experiments: { baseUrl: "/app" },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#070707",
        image: "./assets/omen-mark.png",
        imageWidth: 240,
        resizeMode: "contain",
      },
    ],
    "expo-secure-store",
    [
      "expo-font",
      {
        fonts: [
          "./node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
          "./node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf",
          "./node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf",
          "./node_modules/@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf",
          "./node_modules/@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf",
        ],
      },
    ],
    ["expo-build-properties", { android: { usesCleartextTraffic: development } }],
    "./plugins/with-release-signing.js",
  ],
};
export default config;
