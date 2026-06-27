import React, { useEffect, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert,
  ActivityIndicator, TextInput, Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { useData } from "@/lib/data-context";

type InspectionResult = { item: string; passed: boolean | null; notes: string };
type Inspection = {
  id: string; siteId: string; name: string; date: string;
  results: InspectionResult[]; status: "pending" | "complete";
};
type Template = { id: string; name: string; items: string[] };

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem("sitesnap.token");
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

const DEFAULT_ITEMS = [
  "PPE worn by all workers",
  "Site boundary secured",
  "Fire extinguisher accessible",
  "First aid kit stocked",
  "Hazardous materials stored safely",
  "Electrical equipment checked",
  "Emergency exits clear",
];

export default function InspectionsScreen() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { getSite } = useData();
  const site = getSite(siteId);
  const insets = useSafeAreaInsets();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showActive, setShowActive] = useState<Inspection | null>(null);

  // New inspection form state
  const [inspName, setInspName] = useState("Safety Inspection");
  const [inspDate, setInspDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [inspData, tplData] = await Promise.all([
        apiJson<{ inspections: Inspection[] }>(`/api/inspections?siteId=${siteId}`),
        apiJson<{ templates: Template[] }>(`/api/inspection-templates`),
      ]);
      setInspections(inspData.inspections);
      setTemplates(tplData.templates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [siteId]);

  const getItems = () => {
    if (selectedTemplate) {
      const tpl = templates.find((t) => t.id === selectedTemplate);
      if (tpl) return tpl.items;
    }
    return DEFAULT_ITEMS;
  };

  const handleCreate = async () => {
    if (!inspName.trim()) { Alert.alert("Error", "Inspection name is required."); return; }
    setSaving(true);
    try {
      const items = getItems();
      await apiJson(`/api/inspections`, {
        method: "POST",
        body: JSON.stringify({
          siteId,
          templateId: selectedTemplate || null,
          name: inspName.trim(),
          date: inspDate,
          results: items.map((item) => ({ item, passed: null, notes: "" })),
        }),
      });
      setShowForm(false);
      setInspName("Safety Inspection");
      await load();
    } catch {
      Alert.alert("Error", "Failed to create inspection.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateResult = async (inspection: Inspection, idx: number, passed: boolean | null) => {
    const updated = inspection.results.map((r, i) => i === idx ? { ...r, passed } : r);
    const allAnswered = updated.every((r) => r.passed !== null);
    const newStatus = allAnswered ? "complete" as const : "pending" as const;
    try {
      await apiJson(`/api/inspections/${inspection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ results: updated, status: newStatus }),
      });
      const newInsp = { ...inspection, results: updated, status: newStatus };
      setInspections((prev) => prev.map((i) => i.id === inspection.id ? newInsp : i));
      if (showActive?.id === inspection.id) setShowActive(newInsp);
    } catch {
      Alert.alert("Error", "Failed to save result.");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Inspection", "Remove this inspection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await apiJson(`/api/inspections/${id}`, { method: "DELETE" }).catch(() => {});
          setInspections((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  const passRate = (insp: Inspection) => {
    const answered = insp.results.filter((r) => r.passed !== null);
    if (answered.length === 0) return null;
    const passed = answered.filter((r) => r.passed).length;
    return Math.round((passed / answered.length) * 100);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Inspections</Text>
          {site && <Text style={styles.headerSub}>{site.name}</Text>}
        </View>
        <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} />
        : inspections.length === 0
          ? <EmptyState icon="shield-checkmark-outline" title="No inspections yet" subtitle="Create a safety inspection checklist for this site." ctaLabel="New Inspection" onCta={() => setShowForm(true)} />
          : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {inspections.map((insp) => {
                const rate = passRate(insp);
                const answered = insp.results.filter((r) => r.passed !== null).length;
                return (
                  <Pressable key={insp.id} style={styles.card} onPress={() => setShowActive(insp)}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.cardName}>{insp.name}</Text>
                        <View style={[styles.statusBadge, insp.status === "complete" ? styles.badgeComplete : styles.badgePending]}>
                          <Text style={[styles.badgeText, insp.status === "complete" ? styles.badgeCompleteText : styles.badgePendingText]}>
                            {insp.status === "complete" ? "Complete" : "Pending"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>{insp.date} · {answered}/{insp.results.length} answered</Text>
                      {rate !== null && (
                        <Text style={[styles.passRate, { color: rate >= 80 ? Colors.success : rate >= 50 ? Colors.warning : Colors.error }]}>
                          {rate}% pass rate
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={(e) => { e.stopPropagation(); handleDelete(insp.id); }} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </Pressable>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )
      }

      {/* New Inspection Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Inspection</Text>
            <Pressable onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <TextInput style={styles.input} placeholder="Inspection name" value={inspName} onChangeText={setInspName} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={inspDate} onChangeText={setInspDate} placeholderTextColor={Colors.textTertiary} />
            {templates.length > 0 && (
              <View>
                <Text style={styles.inputLabel}>Template (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      style={[styles.chip, !selectedTemplate && styles.chipActive]}
                      onPress={() => setSelectedTemplate("")}
                    >
                      <Text style={[styles.chipText, !selectedTemplate && styles.chipTextActive]}>Default ({DEFAULT_ITEMS.length})</Text>
                    </Pressable>
                    {templates.map((tpl) => (
                      <Pressable
                        key={tpl.id}
                        style={[styles.chip, selectedTemplate === tpl.id && styles.chipActive]}
                        onPress={() => setSelectedTemplate(tpl.id)}
                      >
                        <Text style={[styles.chipText, selectedTemplate === tpl.id && styles.chipTextActive]}>{tpl.name} ({tpl.items.length})</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <Text style={styles.previewLabel}>{getItems().length} checklist items will be created</Text>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Inspection</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Active Inspection Modal */}
      <Modal visible={!!showActive} animationType="slide" presentationStyle="pageSheet">
        {showActive && (
          <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{showActive.name}</Text>
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{showActive.date}</Text>
              </View>
              <Pressable onPress={() => setShowActive(null)}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {showActive.results.map((result, idx) => (
                <View key={idx} style={styles.resultRow}>
                  <Text style={styles.resultItem}>{result.item}</Text>
                  <View style={styles.resultBtns}>
                    <Pressable
                      style={[styles.resultBtn, result.passed === true && styles.resultBtnPass]}
                      onPress={() => handleUpdateResult(showActive, idx, result.passed === true ? null : true)}
                    >
                      <Ionicons name="checkmark" size={16} color={result.passed === true ? "#fff" : Colors.success} />
                    </Pressable>
                    <Pressable
                      style={[styles.resultBtn, result.passed === false && styles.resultBtnFail]}
                      onPress={() => handleUpdateResult(showActive, idx, result.passed === false ? null : false)}
                    >
                      <Ionicons name="close" size={16} color={result.passed === false ? "#fff" : Colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EDF5" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardName: { fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  passRate: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeComplete: { backgroundColor: Colors.success + "20" },
  badgePending: { backgroundColor: Colors.warning + "20" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeCompleteText: { color: Colors.success },
  badgePendingText: { color: Colors.warning },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E8EDF5" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  input: { borderWidth: 1, borderColor: "#DDE5EF", borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, backgroundColor: "#fff" },
  inputLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#fff" },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  previewLabel: { fontSize: 13, color: Colors.textTertiary, textAlign: "center" },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FAFB", borderRadius: 12, padding: 14 },
  resultItem: { flex: 1, fontSize: 14, color: Colors.text },
  resultBtns: { flexDirection: "row", gap: 8 },
  resultBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  resultBtnPass: { backgroundColor: Colors.success, borderColor: Colors.success },
  resultBtnFail: { backgroundColor: Colors.error, borderColor: Colors.error },
});
