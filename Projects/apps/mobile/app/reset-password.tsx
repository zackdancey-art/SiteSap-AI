import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { isInputDebugEnabled, logInputEvent } from "@/lib/input-debug";
import { BackButton, goBackSafe } from "@/components/BackButton";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = useMemo(
    () => (typeof params.token === "string" ? decodeURIComponent(params.token) : ""),
    [params.token]
  );
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    if (submitting) return;
    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token: token.trim(),
        newPassword,
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to reset password.");
      }
      setMessage(data.message || "Password has been reset. Redirecting to sign in…");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const showDebugHint = isInputDebugEnabled();

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <BackButton tone="onLight" homeFallback="/login" style={{ position: "absolute", top: insets.top + 8, left: 12, zIndex: 10 }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="key-outline" size={34} color={Colors.white} />
            </View>
            <Text style={styles.appName}>Set New Password</Text>
            <Text style={styles.tagline}>Choose a new password for your account</Text>
          </View>

          <View style={styles.formSection}>
            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!!message && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.successText}>{message}</Text>
              </View>
            )}
            {showDebugHint && (
              <Text style={styles.debugHint}>Input diagnostics enabled</Text>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reset Token</Text>
              <TextInput
                style={styles.input}
                placeholder="Filled automatically from reset link"
                value={token}
                onChangeText={(value) => {
                  setToken(value);
                  logInputEvent("reset.token", "change", value);
                }}
                onFocus={() => logInputEvent("reset.token", "focus")}
                onBlur={() => logInputEvent("reset.token", "blur")}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    logInputEvent("reset.newPassword", "change", value);
                  }}
                  onFocus={() => logInputEvent("reset.newPassword", "focus")}
                  onBlur={() => logInputEvent("reset.newPassword", "blur")}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textTertiary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  logInputEvent("reset.confirmPassword", "change", value);
                }}
                onFocus={() => logInputEvent("reset.confirmPassword", "focus")}
                onBlur={() => logInputEvent("reset.confirmPassword", "blur")}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={handleReset} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                </>
              )}
            </Pressable>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <Pressable onPress={() => goBackSafe("/login")}>
              <Text style={styles.linkText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  logoSection: { alignItems: "center", marginBottom: 32 },
  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.primary },
  tagline: { marginTop: 4, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  formSection: { gap: 14 },
  debugHint: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textTertiary },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, marginLeft: 4 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 46 },
  eyeButton: { position: "absolute", right: 14 },
  primaryButton: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 54,
  },
  primaryButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  footer: { marginTop: 26, flexDirection: "row", justifyContent: "center" },
  linkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.errorBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.error, flex: 1 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  successText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.success, flex: 1 },
});
