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

type Delivery = {
  id: string; siteId: string; date: string; supplier: string;
  items: string[]; quantity: string; notes: string;
};

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

export default function DeliveriesScreen() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { getSite } = useData();
  const site = getSite(siteId);
  const insets = useSafeAreaInsets();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplier, setSupplier] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const load = async () => {
    try {
      const data = await apiJson<{ deliveries: Delivery[] }>(`/api/deliveries?siteId=${siteId}`);
      setDeliveries(data.deliveries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [siteId]);

  const resetForm = () => {
    setSupplier(""); setItemsText(""); setQuantity(""); setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const handleAdd = async () => {
    if (!itemsText.trim()) { Alert.alert("Error", "At least one item is required."); return; }
    setSaving(true);
    try {
      await apiJson(`/api/deliveries`, {
        method: "POST",
        body: JSON.stringify({
          siteId,
          date,
          supplier: supplier.trim(),
          items: itemsText.split(",").map((s) => s.trim()).filter(Boolean),
          quantity: quantity.trim(),
          notes: notes.trim(),
        }),
      });
      setShowForm(false);
      resetForm();
      await load();
    } catch {
      Alert.alert("Error", "Failed to log delivery.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Delivery", "Remove this delivery record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await apiJson(`/api/deliveries/${id}`, { method: "DELETE" }).catch(() => {});
          setDeliveries((prev) => prev.filter((d) => d.id !== id));
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Material Deliveries</Text>
          {site && <Text style={styles.headerSub}>{site.name}</Text>}
        </View>
        <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {deliveries.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{deliveries.length} deliveries logged</Text>
        </View>
      )}

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} />
        : deliveries.length === 0
          ? <EmptyState icon="cube-outline" title="No deliveries yet" subtitle="Log material deliveries to keep a full site record." ctaLabel="Log Delivery" onCta={() => setShowForm(true)} />
          : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {deliveries.map((d) => (
                <View key={d.id} style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardSupplier}>{d.supplier || "Unknown supplier"}</Text>
                    <Text style={styles.cardDate}>{d.date}{d.quantity ? ` · ${d.quantity}` : ""}</Text>
                    {d.items.length > 0 && (
                      <Text style={styles.cardItems}>{d.items.join(", ")}</Text>
                    )}
                    {d.notes ? <Text style={styles.cardNotes}>{d.notes}</Text> : null}
                  </View>
                  <Pressable onPress={() => handleDelete(d.id)} hitSlop={8}>
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
            <Text style={styles.modalTitle}>Log Delivery</Text>
            <Pressable onPress={() => { setShowForm(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <TextInput style={styles.input} placeholder="Supplier name" value={supplier} onChangeText={setSupplier} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholderTextColor={Colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Items delivered (comma-separated) *"
              value={itemsText}
              onChangeText={setItemsText}
              placeholderTextColor={Colors.textTertiary}
            />
            <TextInput style={styles.input} placeholder="Quantity / units (e.g. 20 bags)" value={quantity} onChangeText={setQuantity} placeholderTextColor={Colors.textTertiary} />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={Colors.textTertiary}
            />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Log Delivery</Text>}
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
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardSupplier: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cardDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardItems: { fontSize: 13, color: Colors.primary, marginTop: 4, fontWeight: "600" },
  cardNotes: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E8EDF5" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  input: { borderWidth: 1, borderColor: "#DDE5EF", borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, backgroundColor: "#fff" },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
