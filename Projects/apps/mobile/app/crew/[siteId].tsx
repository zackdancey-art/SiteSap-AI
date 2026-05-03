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

type Timecard = {
  id: string; workerName: string; date: string;
  hoursRegular: number; hoursOvertime: number; trade: string; notes: string;
};

async function getToken() {
  return AsyncStorage.getItem("sitesnap.token");
}

import { getApiBaseUrl } from "@/lib/api-base-url";

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

export default function CrewTimecards() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { getSite } = useData();
  const site = getSite(siteId);
  const insets = useSafeAreaInsets();
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [hoursRegular, setHoursRegular] = useState("8");
  const [hoursOvertime, setHoursOvertime] = useState("0");
  const [trade, setTrade] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiJson<{ timecards: Timecard[] }>(`/api/crew/timecards?siteId=${siteId}`);
      setTimecards(data.timecards);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [siteId]);

  const handleAdd = async () => {
    if (!workerName.trim()) { Alert.alert("Error", "Worker name is required."); return; }
    setSaving(true);
    try {
      await apiJson(`/api/crew/timecards`, {
        method: "POST",
        body: JSON.stringify({
          siteId, workerName: workerName.trim(), date,
          hoursRegular: Number(hoursRegular) || 0,
          hoursOvertime: Number(hoursOvertime) || 0,
          trade, notes: "",
        }),
      });
      setShowForm(false);
      setWorkerName(""); setTrade("");
      await load();
    } catch {
      Alert.alert("Error", "Failed to add timecard.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Timecard", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await apiJson(`/api/crew/timecards/${id}`, { method: "DELETE" }).catch(() => {});
          setTimecards((prev) => prev.filter((t) => t.id !== id));
        },
      },
    ]);
  };

  const totalHours = timecards.reduce((sum, t) => sum + t.hoursRegular + t.hoursOvertime, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Crew Timecards</Text>
          {site && <Text style={styles.headerSub}>{site.name}</Text>}
        </View>
        <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {totalHours > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{timecards.length} workers · {totalHours.toFixed(1)} total hours</Text>
        </View>
      )}

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} />
        : timecards.length === 0
          ? <EmptyState icon="people-outline" title="No timecards yet" subtitle="Add crew timecards to track daily labour hours." ctaLabel="Add Timecard" onCta={() => setShowForm(true)} />
          : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {timecards.map((tc) => (
                <View key={tc.id} style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{tc.workerName}</Text>
                    <Text style={styles.cardMeta}>{tc.date}{tc.trade ? ` · ${tc.trade}` : ""}</Text>
                    <Text style={styles.cardHours}>{tc.hoursRegular}h reg{tc.hoursOvertime > 0 ? ` · ${tc.hoursOvertime}h OT` : ""}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(tc.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )
      }

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Timecard</Text>
            <Pressable onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <TextInput style={styles.input} placeholder="Worker name *" value={workerName} onChangeText={setWorkerName} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Trade (e.g. Carpenter)" value={trade} onChangeText={setTrade} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholderTextColor={Colors.textTertiary} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Regular hrs</Text>
                <TextInput style={styles.input} value={hoursRegular} onChangeText={setHoursRegular} keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Overtime hrs</Text>
                <TextInput style={styles.input} value={hoursOvertime} onChangeText={setHoursOvertime} keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Timecard</Text>}
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
  summaryBar: { backgroundColor: Colors.primary + "15", padding: 12, alignItems: "center" },
  summaryText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardHours: { fontSize: 13, color: Colors.primary, fontWeight: "600", marginTop: 4 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E8EDF5" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  input: { borderWidth: 1, borderColor: "#DDE5EF", borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, backgroundColor: "#fff" },
  inputLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
