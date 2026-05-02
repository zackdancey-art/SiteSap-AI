import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useData } from "@/lib/data-context";
import Colors from "@/constants/colors";
import { shareOrDownloadText } from "@/lib/export-utils";

export default function BackupDataScreen() {
  const { sites, entries, diaries } = useData();

  const createBackupPayload = () =>
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        sites,
        entries,
        diaries,
      },
      null,
      2
    );

  const onBackup = async () => {
    try {
      const payload = createBackupPayload();
      await shareOrDownloadText(`sitesnap-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
    } catch (error) {
      console.error("Backup failed", error);
      Alert.alert("Backup failed", "Could not create a backup.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Backup Data</Text>
        <Text style={styles.subtitle}>Export complete app data for safe storage or supervisor handover.</Text>
        <Text style={styles.meta}>Sites: {sites.length}</Text>
        <Text style={styles.meta}>Entries: {entries.length}</Text>
        <Text style={styles.meta}>Diaries: {diaries.length}</Text>
        <Pressable style={styles.button} onPress={onBackup}>
          <Text style={styles.buttonText}>Create Backup</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 4 },
  meta: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  button: {
    marginTop: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: Colors.white, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
