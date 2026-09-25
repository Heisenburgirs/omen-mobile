import React, { Component, useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { PrivyProvider } from "./lib/privy";
import { PrivyElements } from "./lib/privy";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { preloadSounds } from "./lib/sound";
import { config, isConfigured } from "./config";
import { Button, Mark, ui } from "./components/ui";
import { LaunchReady } from "./components/launch-screen";
import { webFonts } from "./lib/web-fonts";
const privyConfig = {
  embedded: {
    solana: { createOnLogin: "off" as const },
    ethereum: { createOnLogin: "off" as const },
  },
};
export class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <LaunchReady>
        <View
          style={[
            ui.screen,
            { justifyContent: "center", padding: 28, gap: 24 },
          ]}
        >
          <Mark />
          <Text style={ui.heading}>Let’s try that again.</Text>
          <Text style={ui.body}>
            OMEN couldn’t finish loading. Check your connection and reopen the
            app if this continues.
          </Text>
          <Button
            title="Try again"
            onPress={() => this.setState({ failed: false })}
          />
        </View>
      </LaunchReady>
    ) : (
      this.props.children
    );
  }
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    OmenUI_400Regular: require("../assets/fonts/OmenUI-Regular.ttf"),
    OmenUI_500Medium: require("../assets/fonts/OmenUI-Medium.ttf"),
    OmenUI_600SemiBold: require("../assets/fonts/OmenUI-SemiBold.ttf"),
    ...webFonts,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  // Loads the effects and lets the first touch unlock playback.
  useEffect(preloadSounds, []);
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {isConfigured ? (
            <PrivyProvider
              appId={config.appId}
              clientId={config.clientId}
              config={privyConfig}
            >
              {children}
              <PrivyElements />
            </PrivyProvider>
          ) : (
            children
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
