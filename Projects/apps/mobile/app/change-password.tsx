import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters."); return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password."); return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to change password.");
      setSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => router.back(), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {success ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successSub}>Your password has been changed successfully.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Enter your current password, then choose a new one with at least 12 characters.
              </Text>

              {!!error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="close-circle" size={18} color={Colors.white} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <PasswordField
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                show={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
              />
              <PasswordField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                hint="At least 12 characters"
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                show={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
              />

              <Pressable
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitText}>Update Password</Text>
                }
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PasswordField({ label, value, onChangeText, show, onToggle, hint }: {
  label: string; value: string; onChangeText: (v: string) => void;
  show: boolean; onToggle: () => void; hint?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••••••••"
          placeholderTextColor={Colors.textTertiary}
        />
        <Pressable onPress={onToggle} style={styles.eyeBtn}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 20, gap: 0 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 20 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.error, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: Colors.white, fontSize: 13, flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: Colors.textTertiary, marginBottom: 6 },
  passwordRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, overflow: "hidden",
  },
  passwordInput: {
    flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: { paddingHorizontal: 14 },
  submitBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  successCard: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surface, borderRadius: 20, padding: 40, gap: 12, marginTop: 40,
  },
  successTitle: { fontSize: 20, fontWeight: "700", color: Colors.text },
  successSub: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
});
