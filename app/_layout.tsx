// First, before anything that might touch WebCrypto: the agent's channel
// client needs Ed25519 and SHA-256 that Hermes does not provide.
import { installAgentPolyfills } from "../src/agent/polyfills";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Providers } from "../src/providers";
import { colors } from "../src/theme";

installAgentPolyfills();

// Keep the native logo visible until the session's destination can be drawn.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 0 });

export default function Layout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: "fade",
        }}
      />
    </Providers>
  );
}
