import React, { useEffect } from "react";
import { router } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
