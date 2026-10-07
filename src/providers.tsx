import React, { Component, useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { PrivyProvider } from "./lib/privy";
import { PrivyElements } from "./lib/privy";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { queryStorage } from "./lib/query-storage";
import { policyFor } from "./lib/queries";
import Constants from "expo-constants";
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
  // What was loaded stays for an hour in memory and, for the resources
  // `queries.ts` marks, on the device: the next launch opens with the last
  // session's figures on screen and refreshes them behind.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, gcTime: 60 * 60_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({ storage: queryStorage, key: "omen.queries", throttleTime: 2000 }),
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
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60_000,
            // A new app version starts clean, in case a shape changed.
            buster: String(Constants.expoConfig?.version ?? "0"),
            dehydrateOptions: {
              shouldDehydrateQuery: (q) =>
                q.state.status === "success" &&
                q.queryKey[0] === "mobile" &&
                Boolean(policyFor(String(q.queryKey[2])).persist),
            },
          }}
        >
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
        </PersistQueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
