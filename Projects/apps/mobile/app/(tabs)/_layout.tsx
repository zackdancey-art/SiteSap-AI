import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

function NativeTabLayout({ canSeeSupervisor }: { canSeeSupervisor: boolean }) {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "building.2", selected: "building.2.fill" }} />
        <Label>Sites</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
      {canSeeSupervisor && (
        <NativeTabs.Trigger name="supervisor">
          <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}

function ClassicTabLayout({ canSeeSupervisor }: { canSeeSupervisor: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? Colors.black : Colors.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? Colors.text : Colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? Colors.black : Colors.surface }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Sites",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      {canSeeSupervisor && (
        <Tabs.Screen
          name="supervisor"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
      )}
    </Tabs>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const canSeeSupervisor = user?.companyRole === "owner" || user?.companyRole === "manager";
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout canSeeSupervisor={canSeeSupervisor} />;
  }
  return <ClassicTabLayout canSeeSupervisor={canSeeSupervisor} />;
}
