import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator,
  TextInput, Modal, FlatList,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { exportReportDocument, buildHtmlDocument } from "@/lib/export-utils";
import { getApiBaseUrl } from "@/lib/api-base-url";

type Timecard = {
  id: string; workerName: string; date: string;
  startTime?: string; endTime?: string; breakMinutes?: number;
  hoursRegular: number; hoursOvertime: number; trade: string; notes: string;
};

function calcHours(start: string, end: string, breakMin: number) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - (breakMin || 0);
  const total = Math.max(0, totalMin / 60);
  const regular = Math.min(total, 8);
  const overtime = Math.max(0, total - 8);
  return { regular: parseFloat(regular.toFixed(2)), overtime: parseFloat(overtime.toFixed(2)) };
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function groupByWeek(timecards: Timecard[]) {
  const weeks: Record<string, Timecard[]> = {};
  timecards.forEach((tc) => {
    const d = new Date(tc.date + "T00:00:00");
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(tc);
  });
  return Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
}

function weekLabel(weekStart: string) {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

async function getToken() { return AsyncStorage.getItem("sitesnap.token"); }

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

function buildTimecardHtml(timecards: Timecard[], siteName: string) {
  const totalReg = timecards.reduce((s, t) => s + t.hoursRegular, 0);
  const totalOT  = timecards.reduce((s, t) => s + t.hoursOvertime, 0);
  const rows = timecards.map((tc) => `
    <tr>
      <td>${formatDate(tc.date)}</td>
      <td>${tc.workerName}</td>
      <td>${tc.trade || "—"}</td>
      <td>${formatTime(tc.startTime || "")}</td>
      <td>${formatTime(tc.endTime || "")}</td>
      <td>${tc.breakMinutes ?? 0} min</td>
      <td>${tc.hoursRegular.toFixed(2)}h</td>
      <td style="color:#E8731A;font-weight:700">${tc.hoursOvertime > 0 ? tc.hoursOvertime.toFixed(2) + "h" : "—"}</td>
      <td>${tc.notes || "—"}</td>
    </tr>
  `).join("");

  return buildHtmlDocument({
    eyebrow: "Timesheet Export",
    title: siteName,
    subtitle: `Generated ${new Date().toLocaleString("en-AU")} · ${timecards.length} records`,
    meta: [
      { label: "Records", value: String(timecards.length) },
      { label: "Regular Hours", value: `${totalReg.toFixed(1)}h` },
      { label: "Overtime Hours", value: `${totalOT.toFixed(1)}h` },
      { label: "Total Hours", value: `${(totalReg + totalOT).toFixed(1)}h` },
    ],
    body: `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Worker</th><th>Trade</th><th>Start</th><th>End</th><th>Break</th><th>Regular</th><th>OT</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `,
  });
}

export default function CrewTimecards() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { getSite, sites } = useData();
  const { user } = useAuth();
  const site = getSite(siteId);
  const insets = useSafeAreaInsets();

  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab]             = useState<"list" | "summary">("list");

  // Form state — worker name pre-filled from the logged-in user
  const [workerName, setWorkerName]     = useState(user?.name ?? "");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [date, setDate]                 = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime]       = useState("07:00");
  const [endTime, setEndTime]           = useState("15:30");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [notes, setNotes]               = useState("");
  const [showSitePicker, setShowSitePicker] = useState(false);

  const computed = useMemo(() => {
    if (startTime && endTime) return calcHours(startTime, endTime, Number(breakMinutes) || 0);
    return { regular: 0, overtime: 0 };
  }, [startTime, endTime, breakMinutes]);

  const weeks = useMemo(() => groupByWeek(timecards), [timecards]);

  const totals = useMemo(() => ({
    workers: new Set(timecards.map((t) => t.workerName)).size,
    regular: timecards.reduce((s, t) => s + t.hoursRegular, 0),
    overtime: timecards.reduce((s, t) => s + t.hoursOvertime, 0),
  }), [timecards]);

  const load = async () => {
    try {
      const data = await apiJson<{ timecards: Timecard[] }>(`/api/crew/timecards?siteId=${siteId}`);
      setTimecards(data.timecards);
    } catch (err) { console.warn(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [siteId]);

  const resetForm = () => {
    setWorkerName(user?.name ?? "");
    setSelectedSiteName("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setStartTime("07:00"); setEndTime("15:30"); setBreakMinutes("30");
  };

  const handleAdd = async () => {
    if (!workerName.trim()) { Alert.alert("Required", "Worker name is required."); return; }
    setSaving(true);
    try {
      await apiJson(`/api/crew/timecards`, {
        method: "POST",
        body: JSON.stringify({
          siteId, workerName: workerName.trim(), trade: selectedSiteName, date,
          startTime, endTime, breakMinutes: Number(breakMinutes) || 0,
          hoursRegular: computed.regular,
          hoursOvertime: computed.overtime,
          notes,
        }),
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch { Alert.alert("Error", "Failed to save timecard."); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Record", "Remove this timecard entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await apiJson(`/api/crew/timecards/${id}`, { method: "DELETE" }).catch(() => {});
          setTimecards((prev) => prev.filter((t) => t.id !== id));
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (timecards.length === 0) { Alert.alert("No Data", "Add timecards before exporting."); return; }
    setExporting(true);
    try {
      const html = buildTimecardHtml(timecards, site?.name ?? "Site");
      await exportReportDocument({
        filenameBase: `timecards-${site?.name?.toLowerCase().replace(/\s+/g, "-") ?? siteId}-${new Date().toISOString().slice(0, 10)}`,
        html,
        format: "pdf",
      });
    } catch { Alert.alert("Export failed", "Could not generate timesheet PDF."); }
    finally { setExporting(false); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Timesheets</Text>
          {site && <Text style={styles.headerSub}>{site.name}</Text>}
        </View>
        <Pressable onPress={handleExport} style={styles.exportBtn} disabled={exporting}>
          {exporting
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="share-outline" size={20} color={Colors.accent} />
          }
        </Pressable>
        <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {/* Summary banner */}
      {timecards.length > 0 && (
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{totals.workers}</Text>
            <Text style={styles.summaryLab}>Workers</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{totals.regular.toFixed(1)}h</Text>
            <Text style={styles.summaryLab}>Regular</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, totals.overtime > 0 && { color: Colors.accent }]}>{totals.overtime.toFixed(1)}h</Text>
            <Text style={styles.summaryLab}>Overtime</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{(totals.regular + totals.overtime).toFixed(1)}h</Text>
            <Text style={styles.summaryLab}>Total</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      {timecards.length > 0 && (
        <View style={styles.tabs}>
          {(["list", "summary"] as const).map((t) => (
            <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "list" ? "By Week" : "By Worker"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={Colors.primary} />
        : timecards.length === 0
          ? <EmptyState icon="time-outline" title="No timecards yet" subtitle="Log crew hours with start & end times, breaks, and overtime." ctaLabel="Add Timecard" onCta={() => setShowForm(true)} />
          : tab === "list"
            ? (
              <ScrollView contentContainerStyle={styles.listContent}>
                {weeks.map(([weekStart, cards]) => {
                  const wReg = cards.reduce((s, c) => s + c.hoursRegular, 0);
                  const wOT  = cards.reduce((s, c) => s + c.hoursOvertime, 0);
                  return (
                    <View key={weekStart}>
                      <View style={styles.weekHeader}>
                        <Text style={styles.weekLabel}>Week of {weekLabel(weekStart)}</Text>
                        <Text style={styles.weekTotals}>{wReg.toFixed(1)}h reg · <Text style={{ color: Colors.accent }}>{wOT.toFixed(1)}h OT</Text></Text>
                      </View>
                      {cards.map((tc) => (
                        <View key={tc.id} style={styles.card}>
                          <View style={styles.cardDateCol}>
                            <Text style={styles.cardDayName}>{new Date(tc.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })}</Text>
                            <Text style={styles.cardDayNum}>{new Date(tc.date + "T00:00:00").getDate()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.cardTopRow}>
                              <Text style={styles.cardName}>{tc.workerName}</Text>
                              {tc.trade ? <View style={styles.tradeBadge}><Text style={styles.tradeBadgeText}>{tc.trade}</Text></View> : null}
                            </View>
                            <View style={styles.cardTimeRow}>
                              <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
                              <Text style={styles.cardTimeTxt}>
                                {tc.startTime ? formatTime(tc.startTime) : "—"} – {tc.endTime ? formatTime(tc.endTime) : "—"}
                                {tc.breakMinutes ? `  ·  ${tc.breakMinutes}min break` : ""}
                              </Text>
                            </View>
                            <View style={styles.cardHoursRow}>
                              <View style={styles.hoursChip}>
                                <Text style={styles.hoursChipText}>{tc.hoursRegular.toFixed(1)}h reg</Text>
                              </View>
                              {tc.hoursOvertime > 0 && (
                                <View style={[styles.hoursChip, styles.hoursChipOT]}>
                                  <Text style={[styles.hoursChipText, { color: Colors.accent }]}>{tc.hoursOvertime.toFixed(1)}h OT</Text>
                                </View>
                              )}
                            </View>
                            {!!tc.notes && <Text style={styles.cardNotes} numberOfLines={1}>{tc.notes}</Text>}
                          </View>
                          <Pressable onPress={() => handleDelete(tc.id)} hitSlop={10} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={17} color={Colors.error} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            )
            : (
              // By Worker summary
              <ScrollView contentContainerStyle={styles.listContent}>
                {Array.from(new Set(timecards.map((t) => t.workerName))).sort().map((worker) => {
                  const wCards = timecards.filter((t) => t.workerName === worker);
                  const wReg  = wCards.reduce((s, c) => s + c.hoursRegular, 0);
                  const wOT   = wCards.reduce((s, c) => s + c.hoursOvertime, 0);
                  const trades = [...new Set(wCards.map((c) => c.trade).filter(Boolean))];
                  return (
                    <View key={worker} style={styles.workerCard}>
                      <View style={styles.workerAvatar}>
                        <Text style={styles.workerAvatarText}>{worker.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerName}>{worker}</Text>
                        {trades.length > 0 && <Text style={styles.workerTrade}>{trades.join(", ")}</Text>}
                        <View style={styles.workerStats}>
                          <Text style={styles.workerStatItem}>{wCards.length} days</Text>
                          <Text style={styles.workerStatDot}>·</Text>
                          <Text style={styles.workerStatItem}>{wReg.toFixed(1)}h regular</Text>
                          {wOT > 0 && <>
                            <Text style={styles.workerStatDot}>·</Text>
                            <Text style={[styles.workerStatItem, { color: Colors.accent }]}>{wOT.toFixed(1)}h OT</Text>
                          </>}
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.workerTotal}>{(wReg + wOT).toFixed(1)}h</Text>
                        <Text style={styles.workerTotalLab}>total</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )
      }

      {/* Add Timecard Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => { setShowForm(false); resetForm(); }} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Add Timecard</Text>
            <Pressable onPress={handleAdd} disabled={saving} style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSaveTxt}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Worker + Site */}
            <Text style={styles.formSectionLabel}>Worker Details</Text>
            <View style={styles.formCard}>
              <View style={styles.formRow}>
                <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={{ marginTop: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Worker Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Full name"
                    value={workerName}
                    onChangeText={setWorkerName}
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
              <View style={[styles.formRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight }]}>
                <Ionicons name="business-outline" size={18} color={Colors.textTertiary} style={{ marginTop: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Select Site</Text>
                  <Pressable onPress={() => setShowSitePicker(true)} style={[styles.input, { justifyContent: "center", flexDirection: "row", alignItems: "center" }]}>
                    <Text style={{ flex: 1, color: selectedSiteName ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
                      {selectedSiteName || "Choose a site…"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Date */}
            <Text style={styles.formSectionLabel}>Date</Text>
            <View style={styles.formCard}>
              <View style={styles.formRow}>
                <Ionicons name="calendar-outline" size={18} color={Colors.textTertiary} style={{ marginTop: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput style={styles.input} value={date} onChangeText={setDate} placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
            </View>

            {/* Times */}
            <Text style={styles.formSectionLabel}>Hours</Text>
            <View style={styles.formCard}>
              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="07:00" keyboardType="numbers-and-punctuation" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.timeSep}>
                  <Text style={{ color: Colors.textTertiary, fontSize: 20 }}>→</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="15:30" keyboardType="numbers-and-punctuation" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
              <View style={[styles.formRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight }]}>
                <Ionicons name="cafe-outline" size={18} color={Colors.textTertiary} style={{ marginTop: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Break (minutes)</Text>
                  <TextInput style={styles.input} value={breakMinutes} onChangeText={setBreakMinutes} keyboardType="number-pad" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>

              {/* Computed result */}
              {(computed.regular > 0 || computed.overtime > 0) && (
                <View style={styles.computedRow}>
                  <View style={styles.computedChip}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.computedTxt}>{computed.regular.toFixed(2)}h regular</Text>
                  </View>
                  {computed.overtime > 0 && (
                    <View style={[styles.computedChip, { backgroundColor: Colors.accent + "18" }]}>
                      <Ionicons name="alert-circle" size={14} color={Colors.accent} />
                      <Text style={[styles.computedTxt, { color: Colors.accent }]}>{computed.overtime.toFixed(2)}h overtime</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Notes */}
            <Text style={styles.formSectionLabel}>Notes</Text>
            <View style={styles.formCard}>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                placeholder="Optional notes (work area, cost code, etc.)"
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Site picker modal */}
      <Modal visible={showSitePicker} animationType="slide" presentationStyle="pageSheet" transparent>
        <Pressable style={styles.tradeOverlay} onPress={() => setShowSitePicker(false)} />
        <View style={[styles.tradeSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.tradeHandle} />
          <Text style={styles.tradeTitle}>Select Site</Text>
          {sites.length === 0 ? (
            <Text style={{ textAlign: "center", color: Colors.textTertiary, marginTop: 24, fontSize: 14 }}>
              No sites found. Create a site first.
            </Text>
          ) : (
            <FlatList
              data={sites}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.tradeRow, selectedSiteName === item.name && styles.tradeRowSelected]}
                  onPress={() => { setSelectedSiteName(item.name); setShowSitePicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tradeRowText, selectedSiteName === item.name && { color: Colors.accent }]}>{item.name}</Text>
                    {item.client ? <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 2 }}>{item.client}</Text> : null}
                  </View>
                  {selectedSiteName === item.name && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  exportBtn: { padding: 8, borderWidth: 1, borderColor: Colors.accent + "44", borderRadius: 10, marginLeft: "auto" },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 8 },

  // Summary banner
  summaryBanner: { flexDirection: "row", backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  summaryLab: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textTertiary, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Tabs
  tabs: { flexDirection: "row", backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, gap: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },

  listContent: { padding: 16, gap: 8, paddingBottom: 40 },

  // Week header
  weekHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, marginTop: 8, marginBottom: 4 },
  weekLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  weekTotals: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },

  // Timecard card
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: Colors.border },
  cardDateCol: { width: 42, alignItems: "center", paddingTop: 2 },
  cardDayName: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textTertiary, textTransform: "uppercase" },
  cardDayNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, flex: 1 },
  tradeBadge: { backgroundColor: Colors.primary + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tradeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  cardTimeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  cardTimeTxt: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cardHoursRow: { flexDirection: "row", gap: 6 },
  hoursChip: { backgroundColor: Colors.success + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  hoursChipOT: { backgroundColor: Colors.accent + "18" },
  hoursChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.success },
  cardNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary, marginTop: 6 },
  deleteBtn: { padding: 6, marginTop: 2 },

  // Worker summary
  workerCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: Colors.border },
  workerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  workerAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.white },
  workerName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  workerTrade: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  workerStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  workerStatItem: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  workerStatDot: { fontSize: 12, color: Colors.textTertiary },
  workerTotal: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },
  workerTotalLab: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textTertiary, textAlign: "right" },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  modalClose: { padding: 4 },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalSaveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveTxt: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modalContent: { padding: 16, gap: 8, paddingBottom: 40 },

  formSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginLeft: 4 },
  formCard: { backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  formRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface },
  timeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 14 },
  timeSep: { alignItems: "center", paddingTop: 24 },
  computedRow: { flexDirection: "row", gap: 8, paddingBottom: 12, paddingTop: 4 },
  computedChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.success + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  computedTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.success },

  // Trade picker
  tradeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  tradeSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "60%" },
  tradeHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  tradeTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center", marginBottom: 12 },
  tradeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12 },
  tradeRowSelected: { backgroundColor: Colors.accent + "10" },
  tradeRowText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text },
});
