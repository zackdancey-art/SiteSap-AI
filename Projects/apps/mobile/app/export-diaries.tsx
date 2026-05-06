import React, { useMemo, useState } from "react";
import {
  Alert, Clipboard, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "@/lib/data-context";
import Colors from "@/constants/colors";
import {
  buildDiariesReportHtml,
  buildDiariesText,
  exportReportDocument,
  shareOrDownloadText,
} from "@/lib/export-utils";

type ExportOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  bg: string;
};

const OPTIONS: ExportOption[] = [
  { id: "pdf",   icon: "document-text",  title: "Export PDF",    subtitle: "Professional formatted report",  accent: Colors.accent, bg: Colors.accent + "14" },
  { id: "word",  icon: "document",       title: "Export Word",   subtitle: "Editable .doc document",         accent: Colors.primary, bg: Colors.primary + "14" },
  { id: "email", icon: "mail",           title: "Share via Email", subtitle: "Open share sheet with text report", accent: "#0ea5e9", bg: "#0ea5e914" },
  { id: "text",  icon: "copy",           title: "Copy as Text",  subtitle: "Plain text to clipboard",        accent: "#8B5CF6", bg: "#8B5CF614" },
];

export default function ExportDiariesScreen() {
  const { diaries, sites } = useData();
  const [loading, setLoading] = useState<string | null>(null);

  const exportHtml = useMemo(
    () => buildDiariesReportHtml(diaries, sites, "All Site Diaries", "Portfolio export across all generated site diaries."),
    [diaries, sites]
  );

  const plainText = useMemo(() => buildDiariesText(diaries, sites), [diaries, sites]);

  const handleExport = async (id: string) => {
    if (diaries.length === 0) {
      Alert.alert("No diaries", "Generate at least one diary before exporting.");
      return;
    }
    const filenameBase = `sitesnap-diaries-${new Date().toISOString().slice(0, 10)}`;
    setLoading(id);
    try {
      if (id === "pdf") {
        await exportReportDocument({ filenameBase, html: exportHtml, format: "pdf" });
      } else if (id === "word") {
        await exportReportDocument({ filenameBase, html: exportHtml, format: "doc" });
      } else if (id === "email") {
        await shareOrDownloadText(`${filenameBase}.txt`, plainText);
      } else if (id === "text") {
        Clipboard.setString(plainText);
        Alert.alert("Copied", "Report text copied to clipboard.");
      }
    } catch (err) {
      console.error("Export failed", err);
      Alert.alert("Export failed", "Could not complete export. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const totalHours = useMemo(() => {
    return diaries.reduce((sum, d) => sum + (d.sections?.length ?? 0), 0);
  }, [diaries]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons name="share-social" size={28} color={Colors.accent} />
        </View>
        <Text style={styles.headerTitle}>Export Diaries</Text>
        <Text style={styles.headerSub}>
          Export all generated site diaries as a PDF, Word document, or share directly.
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{diaries.length}</Text>
            <Text style={styles.statLabel}>Diaries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{sites.length}</Text>
            <Text style={styles.statLabel}>Sites</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalHours}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
        </View>
      </View>

      {/* Export options */}
      <Text style={styles.sectionTitle}>Choose export format</Text>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}
          onPress={() => void handleExport(opt.id)}
          disabled={loading !== null}
        >
          <View style={[styles.optionIcon, { backgroundColor: opt.bg }]}>
            {loading === opt.id
              ? <ActivityIndicator size="small" color={opt.accent} />
              : <Ionicons name={opt.icon} size={22} color={opt.accent} />
            }
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{opt.title}</Text>
            <Text style={styles.optionSub}>{opt.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>
      ))}

      <Text style={styles.footer}>
        Reports are generated from all diaries currently stored on this device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  headerIcon: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: Colors.accent + "18",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.primary },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 4 },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  footer: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary, textAlign: "center", lineHeight: 18, marginTop: 8 },
});
