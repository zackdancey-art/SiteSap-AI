import React, { useEffect, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, TextInput, Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/data-context";
import { getApiBaseUrl } from "@/lib/api-base-url";

type Severity = "near-miss" | "minor" | "major" | "critical";
type IncidentStatus = "open" | "closed";

type Incident = {
  id: string; siteId: string; date: string; severity: Severity;
  description: string; injuredParty: string; correctiveAction: string; status: IncidentStatus;
};

const SEVERITY_COLORS: Record<Severity, string> = {
  "near-miss": "#F6AD55",
  minor: "#68D391",
  major: "#FC8181",
  critical: "#9F1239",
};

async function getToken() {
  return AsyncStorage.getItem("sitesnap.token");
}

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

export default function IncidentsScreen() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { getSite } = useData();
  const site = getSite(siteId);
  const insets = useSafeAreaInsets();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [injuredParty, setInjuredParty] = useState("");
  const [severity, setSeverity] = useState<Severity>("near-miss");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiJson<{ incidents: Incident[] }>(`/api/incidents?siteId=${siteId}`);
      setIncidents(data.incidents);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [siteId]);

  const handleAdd = async () => {
    if (!description.trim()) { Alert.alert("Error", "Description is required."); return; }
    setSaving(true);
    try {
      await apiJson(`/api/incidents`, {
        method: "POST",
        body: JSON.stringify({ siteId, date, severity, description: description.trim(), injuredParty, status: "open" }),
      });
      setShowForm(false);
      setDescription(""); setInjuredParty("");
      await load();
    } catch { Alert.alert("Error", "Failed to log incident."); }
    finally { setSaving(false); }
  };

  const handleClose = async (id: string) => {
    await apiJson(`/api/incidents/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }).catch(() => {});
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, status: "closed" } : i));
  };

  const severities: Severity[] = ["near-miss", "minor", "major", "critical"];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Incidents</Text>
          {site && <Text style={styles.headerSub}>{site.name}</Text>}
        </View>
        <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} />
        : incidents.length === 0
          ? <EmptyState icon="warning-outline" title="No incidents recorded" subtitle="Log near-misses, incidents, and corrective actions to keep your site safe." ctaLabel="Log Incident" onCta={() => setShowForm(true)} />
          : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {incidents.map((inc) => (
                <View key={inc.id} style={styles.card}>
                  <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[inc.severity] + "20" }]}>
                    <Text style={[styles.severityText, { color: SEVERITY_COLORS[inc.severity] }]}>{inc.severity.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.cardDesc}>{inc.description}</Text>
                  <Text style={styles.cardMeta}>{inc.date}</Text>
                  {inc.status === "open" && (
                    <Pressable style={styles.closeBtn} onPress={() => handleClose(inc.id)}>
                      <Text style={styles.closeBtnText}>Mark Closed</Text>
                    </Pressable>
                  )}
                  {inc.status === "closed" && (
                    <View style={styles.closedBadge}><Text style={styles.closedText}>CLOSED</Text></View>
                  )}
                </View>
              ))}
            </ScrollView>
          )
      }

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Incident</Text>
            <Pressable onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={styles.inputLabel}>Severity</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {severities.map((s) => (
                <Pressable key={s} style={[styles.chip, severity === s && { backgroundColor: SEVERITY_COLORS[s] }]} onPress={() => setSeverity(s)}>
                  <Text style={[styles.chipText, severity === s && { color: "#fff" }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Description *" value={description} onChangeText={setDescription} multiline placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Injured party (if any)" value={injuredParty} onChangeText={setInjuredParty} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholderTextColor={Colors.textTertiary} />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Log Incident</Text>}
            </Pressable>
          </ScrollView>
        </View>
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
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  severityBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 11, fontWeight: "700" },
  cardDesc: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary },
  closeBtn: { alignSelf: "flex-start", backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  closedBadge: { alignSelf: "flex-start", backgroundColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  closedText: { fontSize: 11, fontWeight: "700", color: "#718096" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E8EDF5" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  input: { borderWidth: 1, borderColor: "#DDE5EF", borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text },
  inputLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F0F4FA", borderWidth: 1, borderColor: "#DDE5EF" },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
