import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/lib/api-base-url";
import Colors from "@/constants/colors";

type Employee = { id: string; name: string; email: string; role: "worker" | "supervisor" };
type InviteResult = { email: string; ok: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}

export default function InviteTeamScreen() {
  const idRef = useRef(0);
  const nextId = () => String(++idRef.current);

  const [employees, setEmployees] = useState<Employee[]>([
    { id: nextId(), name: "", email: "", role: "worker" },
  ]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const addRow = useCallback(() => {
    setEmployees((prev) => [...prev, { id: nextId(), name: "", email: "", role: "worker" }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateRow = useCallback((id: string, field: keyof Employee, value: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }, []);

  const parseBulk = useCallback(() => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: Employee[] = lines.map((line) => {
      const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      const email = emailMatch ? emailMatch[0].toLowerCase() : "";
      const name = email
        ? line.replace(emailMatch![0], "").replace(/[,;|]+/g, "").trim()
        : line.replace(/[,;|]+/g, "").trim();
      return { id: nextId(), name, email, role: "worker" };
    });
    if (parsed.length > 0) {
      setEmployees(parsed);
      setShowBulk(false);
      setBulkText("");
    }
  }, [bulkText]);

  const handleSend = useCallback(async () => {
    const valid = employees.filter((e) => isValidEmail(e.email));
    if (valid.length === 0) {
      Alert.alert("No valid emails", "Please add at least one valid email address.");
      return;
    }

    setSending(true);
    setResults(null);
    try {
      const token = await AsyncStorage.getItem("sitesnap.token");
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/auth/invite/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employees: valid.map((e) => ({ email: e.email, fullName: e.name || e.email, role: e.role })),
        }),
      });

      const data = (await res.json()) as { ok?: boolean; results?: InviteResult[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send invites.");
      setResults(data.results ?? []);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Unable to send invites.");
    } finally {
      setSending(false);
    }
  }, [employees]);

  if (results) {
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Invites Sent</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {succeeded.length > 0 && (
            <View style={[styles.resultGroup, { borderColor: Colors.success }]}>
              <Text style={[styles.resultGroupTitle, { color: Colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} /> {succeeded.length} invite{succeeded.length > 1 ? "s" : ""} sent
              </Text>
              {succeeded.map((r) => (
                <Text key={r.email} style={styles.resultEmail}>{r.email}</Text>
              ))}
            </View>
          )}
          {failed.length > 0 && (
            <View style={[styles.resultGroup, { borderColor: Colors.error }]}>
              <Text style={[styles.resultGroupTitle, { color: Colors.error }]}>
                <Ionicons name="close-circle" size={16} color={Colors.error} /> {failed.length} failed
              </Text>
              {failed.map((r) => (
                <View key={r.email}>
                  <Text style={styles.resultEmail}>{r.email}</Text>
                  {r.error && <Text style={styles.resultError}>{r.error}</Text>}
                </View>
              ))}
            </View>
          )}
          <Pressable
            style={styles.doneBtn}
            onPress={() => { setResults(null); setEmployees([{ id: nextId(), name: "", email: "", role: "worker" }]); }}
          >
            <Text style={styles.doneBtnText}>Invite More</Text>
          </Pressable>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Team</Text>
        <Pressable style={styles.bulkToggleBtn} onPress={() => setShowBulk((v) => !v)}>
          <Text style={styles.bulkToggleText}>{showBulk ? "Manual" : "Bulk Paste"}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Each person will receive an email invitation to create their SiteSnap account.
        </Text>

        {showBulk ? (
          <View style={styles.bulkBox}>
            <Text style={styles.label}>Paste emails (one per line, optional name before email)</Text>
            <TextInput
              style={styles.bulkInput}
              placeholder={"John Smith john@example.com\njane@example.com\nBob bob@company.com"}
              placeholderTextColor={Colors.textTertiary}
              value={bulkText}
              onChangeText={setBulkText}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable style={styles.parseBtn} onPress={parseBulk}>
              <Text style={styles.parseBtnText}>Parse & Review</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {employees.map((emp, idx) => (
              <View key={emp.id} style={styles.row}>
                <Text style={styles.rowNum}>{idx + 1}</Text>
                <View style={styles.rowFields}>
                  <TextInput
                    style={[styles.input, styles.inputName]}
                    placeholder="Name (optional)"
                    placeholderTextColor={Colors.textTertiary}
                    value={emp.name}
                    onChangeText={(v) => updateRow(emp.id, "name", v)}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={[styles.input, styles.inputEmail]}
                    placeholder="email@company.com"
                    placeholderTextColor={Colors.textTertiary}
                    value={emp.email}
                    onChangeText={(v) => updateRow(emp.id, "email", v.toLowerCase().trim())}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <View style={styles.roleRow}>
                    {(["worker", "supervisor"] as const).map((r) => (
                      <Pressable
                        key={r}
                        style={[styles.roleChip, emp.role === r && styles.roleChipActive]}
                        onPress={() => updateRow(emp.id, "role", r)}
                      >
                        <Text style={[styles.roleChipText, emp.role === r && styles.roleChipTextActive]}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {employees.length > 1 && (
                  <Pressable style={styles.removeBtn} onPress={() => removeRow(emp.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable style={styles.addRowBtn} onPress={addRow}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
              <Text style={styles.addRowText}>Add another</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={[styles.sendBtn, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={Colors.white} />
          )}
          <Text style={styles.sendBtnText}>
            {sending ? "Sending…" : `Send ${employees.filter((e) => isValidEmail(e.email)).length || ""} Invite${employees.filter((e) => isValidEmail(e.email)).length !== 1 ? "s" : ""}`}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  bulkToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent + "18" },
  bulkToggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowNum: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textTertiary, marginTop: 14, minWidth: 20 },
  rowFields: { flex: 1, gap: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  inputName: {},
  inputEmail: {},
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  roleChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  roleChipTextActive: { color: Colors.white },
  removeBtn: { marginTop: 12, padding: 6 },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  addRowText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.accent },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    height: 54,
    borderRadius: 14,
    marginTop: 8,
  },
  sendBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  bulkBox: { gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  bulkInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    height: 180,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  parseBtn: {
    alignItems: "center",
    backgroundColor: Colors.accent + "18",
    borderRadius: 10,
    paddingVertical: 10,
  },
  parseBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  resultGroup: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  resultGroupTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultEmail: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  resultError: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.error },
  doneBtn: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  backBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  backBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
});
