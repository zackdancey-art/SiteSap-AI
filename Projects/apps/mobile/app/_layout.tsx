import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-context";
import { logResolvedApiBaseUrlOnce } from "@/lib/api-base-url";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ONBOARDING_COMPLETE_KEY } from "./onboarding";

const sentryDsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn
  || process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    attachScreenshot: true,
    enableNativeFramesTracking: true,
  });
}

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="create-site"
        options={{
          title: "New Site",
          presentation: "modal",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="site/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="entry/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="new-entry"
        options={{
          title: "New Entry",
          presentation: "modal",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="diary/[siteId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="diary-gallery/[siteId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile",
          presentation: "modal",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="export-diaries"
        options={{
          title: "Export Diaries",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="backup-data"
        options={{
          title: "Backup Data",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          title: "Privacy Policy",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="help-support"
        options={{
          title: "Help & Support",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="supervisor-dashboard"
        options={{
          title: "Supervisor Dashboard",
          headerShown: true,
          headerTintColor: "#0F2B46",
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="crew/[siteId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="incidents/[siteId]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

function RootLayout() {
  useEffect(() => {
    logResolvedApiBaseUrlOnce();
    SplashScreen.hideAsync();
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then((val) => {
      if (!val) router.replace("/onboarding");
    }).catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DataProvider>
            <GestureHandlerRootView>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </DataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
