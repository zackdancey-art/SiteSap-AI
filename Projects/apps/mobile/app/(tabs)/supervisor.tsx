import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function SupervisorTabScreen() {
  const { sites, entries, diaries } = useData();
  const { user } = useAuth();
  const canSeeSupervisor = user?.companyRole === "owner" || user?.companyRole === "manager";

  if (!canSeeSupervisor) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>Supervisor dashboard is only visible for assigned supervisor accounts.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supervisor Dashboard</Text>
      <Text style={styles.subtitle}>Monitor project activity and report readiness.</Text>
      <View style={styles.card}>
        <Text style={styles.metric}>Sites: {sites.length}</Text>
        <Text style={styles.metric}>Entries: {entries.length}</Text>
        <Text style={styles.metric}>Diaries: {diaries.length}</Text>
      </View>
      <Pressable style={styles.button} onPress={() => router.push("/supervisor-dashboard")}>
        <Text style={styles.buttonText}>Open Full Dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16, gap: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  metric: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: Colors.white, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
