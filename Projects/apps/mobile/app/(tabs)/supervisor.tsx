import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import { buildDiariesReportHtml, exportReportDocument } from "@/lib/export-utils";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",   color: "#22C55E", bg: "#F0FDF4" },
  inactive:  { label: "Inactive", color: "#9EAFC2", bg: "#F1F5F9" },
  completed: { label: "Complete", color: "#E8731A", bg: "#FFF7ED" },
  on_hold:   { label: "On Hold",  color: "#F59E0B", bg: "#FFFBEB" },
};

function getStatusConfig(s: string) {
  return STATUS_CONFIG[s] ?? STATUS_CONFIG.inactive;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function MetricCard({ label, value, icon, accent, iconBg, sub }: {
  label: string; value: string | number; icon: IoniconName;
  accent: string; iconBg: string; sub?: string;
}) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: accent }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` as `${number}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function SupervisorTabScreen() {
  const insets = useSafeAreaInsets();
  const { sites, entries, diaries } = useData();
  const { user } = useAuth();
  const canSeeSupervisor = user?.role === "supervisor" || user?.role === "admin";
  const firstName = user?.name?.split(" ")[0] ?? "Supervisor";

  if (!canSeeSupervisor) {
    return (
      <View style={[styles.container, styles.restrictedWrap, { paddingTop: insets.top + 40 }]}>
        <View style={styles.restrictedIcon}>
          <Ionicons name="lock-closed" size={28} color={Colors.textTertiary} />
        </View>
        <Text style={styles.restrictedTitle}>Access Restricted</Text>
        <Text style={styles.restrictedSub}>
          This dashboard is available only to supervisor and admin accounts.
        </Text>
      </View>
    );
  }

  const metrics = useMemo(() => {
    const approvedDiaries = diaries.filter((d) => d.status === "approved").length;
    const draftDiaries = diaries.length - approvedDiaries;
    const activeSites = sites.filter((s) => s.status === "active").length;
    const completedSites = sites.filter((s) => s.status === "completed").length;
    const approvalRate = diaries.length > 0 ? Math.round((approvedDiaries / diaries.length) * 100) : 0;
    return { approvedDiaries, draftDiaries, activeSites, completedSites, approvalRate };
  }, [diaries, sites]);

  const onExportReport = async () => {
    const html = buildDiariesReportHtml(
      diaries, sites,
      "Supervisor Portfolio Report",
      "Operational snapshot across all tracked diaries and active projects."
    );
    Alert.alert("Export Report", "Choose an export format.", [
      { text: "Cancel", style: "cancel" },
      { text: "Word", onPress: () => void exportReportDocument({ filenameBase: `supervisor-report-${new Date().toISOString().slice(0, 10)}`, html, format: "doc" }) },
      { text: "PDF",  onPress: () => void exportReportDocument({ filenameBase: `supervisor-report-${new Date().toISOString().slice(0, 10)}`, html, format: "pdf" }) },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>
          <View style={styles.headerAvatar}>
            <Ionicons name="briefcase" size={20} color={Colors.accent} />
          </View>
        </View>
        <View style={styles.headerPill}>
          <Ionicons name="layers-outline" size={13} color="rgba(255,255,255,0.75)" />
          <Text style={styles.headerPillText}>
            {metrics.activeSites} active · {sites.length} total projects
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* KPI Metrics */}
        <Text style={styles.sectionTitle}>Portfolio Overview</Text>
        <View style={styles.metricsRow}>
          <MetricCard label="Active Sites" value={metrics.activeSites} icon="construct" accent="#22C55E" iconBg="#F0FDF4" sub={`${metrics.completedSites} completed`} />
          <MetricCard label="Total Entries" value={entries.length} icon="document-text" accent={Colors.primary} iconBg="#EFF6FF" />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard label="Approved Diaries" value={metrics.approvedDiaries} icon="checkmark-circle" accent={Colors.accent} iconBg="#FFF7ED" sub={`${metrics.approvalRate}% approval rate`} />
          <MetricCard label="Pending Review" value={metrics.draftDiaries} icon="time" accent={Colors.warning} iconBg="#FFFBEB" />
        </View>

        {/* Approval Health */}
        {diaries.length > 0 && (
          <View style={styles.healthCard}>
            <View style={styles.healthRow}>
              <Ionicons name="analytics-outline" size={15} color={Colors.primary} />
              <Text style={styles.healthTitle}>Diary Approval Health</Text>
              <Text style={styles.healthPct}>{metrics.approvalRate}%</Text>
            </View>
            <ProgressBar
              value={metrics.approvalRate}
              color={metrics.approvalRate >= 80 ? Colors.success : metrics.approvalRate >= 50 ? Colors.warning : Colors.error}
            />
            <Text style={styles.healthSub}>{metrics.approvedDiaries} of {diaries.length} diaries approved</Text>
          </View>
        )}

        {/* Site Portfolio */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Site Portfolio</Text>
          <View style={styles.countBadge}><Text style={styles.countBadgeText}>{sites.length}</Text></View>
        </View>

        {sites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No sites yet</Text>
            <Text style={styles.emptyText}>Sites will appear here once they are created.</Text>
          </View>
        ) : (
          sites.map((site) => {
            const siteEntries = entries.filter((e) => e.siteId === site.id);
            const siteDiaries = diaries.filter((d) => d.siteId === site.id);
            const approvedCount = siteDiaries.filter((d) => d.status === "approved").length;
            const diaryRate = siteDiaries.length > 0 ? Math.round((approvedCount / siteDiaries.length) * 100) : 0;
            const statusCfg = getStatusConfig(site.status);
            return (
              <Pressable
                key={site.id}
                style={styles.siteCard}
                onPress={() => router.push({ pathname: "/site/[id]", params: { id: site.id } })}
              >
                <View style={styles.siteCardHeader}>
                  <Text style={styles.siteName} numberOfLines={1}>{site.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                </View>
                {!!site.client && (
                  <View style={styles.siteMetaRow}>
                    <Ionicons name="business-outline" size={12} color={Colors.textTertiary} />
                    <Text style={styles.siteMetaText} numberOfLines={1}>{site.client}</Text>
                  </View>
                )}
                {!!site.address && (
                  <View style={styles.siteMetaRow}>
                    <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                    <Text style={styles.siteMetaText} numberOfLines={1}>{site.address}</Text>
                  </View>
                )}
                <View style={styles.siteStatsRow}>
                  <View style={styles.statChip}>
                    <Ionicons name="document-text-outline" size={12} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{siteEntries.length} entries</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Ionicons name="book-outline" size={12} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{siteDiaries.length} diaries</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Ionicons name="checkmark-done-outline" size={12} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{approvedCount} approved</Text>
                  </View>
                </View>
                {siteDiaries.length > 0 && (
                  <View style={styles.diaryProgressWrap}>
                    <View style={styles.diaryProgressRow}>
                      <Text style={styles.diaryProgressLabel}>Diary approvals</Text>
                      <Text style={styles.diaryProgressPct}>{diaryRate}%</Text>
                    </View>
                    <ProgressBar value={diaryRate} color={Colors.accent} />
                  </View>
                )}
                <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} style={styles.chevron} />
              </Pressable>
            );
          })
        )}

        {/* Actions */}
        <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Actions</Text>
        <Pressable style={styles.exportBtn} onPress={onExportReport}>
          <Ionicons name="download-outline" size={18} color={Colors.white} />
          <Text style={styles.exportBtnText}>Export Supervisor Report</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  greeting: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  dateText: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 },
  headerAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  headerPillText: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  body: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.white },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderLeftWidth: 3, gap: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  metricIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  metricValue: { fontSize: 26, fontWeight: "700", color: Colors.text },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "500" },
  metricSub: { fontSize: 11, color: Colors.textTertiary },
  progressTrack: { height: 5, backgroundColor: "#EDF0F4", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  healthCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  healthTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.text },
  healthPct: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  healthSub: { fontSize: 12, color: Colors.textTertiary },
  siteCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, gap: 5 },
  siteCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 24 },
  siteName: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  siteMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  siteMetaText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  siteStatsRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: Colors.textSecondary },
  diaryProgressWrap: { marginTop: 6, gap: 5 },
  diaryProgressRow: { flexDirection: "row", alignItems: "center" },
  diaryProgressLabel: { flex: 1, fontSize: 11, color: Colors.textTertiary },
  diaryProgressPct: { fontSize: 11, fontWeight: "700", color: Colors.accent },
  chevron: { position: "absolute", right: 14, top: 14 },
  exportBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: Colors.primary, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  exportBtnText: { color: Colors.white, fontSize: 15, fontWeight: "700" },
  restrictedWrap: { justifyContent: "center", alignItems: "center", gap: 12, padding: 40 },
  restrictedIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  restrictedTitle: { fontSize: 20, fontWeight: "700", color: Colors.text, textAlign: "center" },
  restrictedSub: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 36, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
});
