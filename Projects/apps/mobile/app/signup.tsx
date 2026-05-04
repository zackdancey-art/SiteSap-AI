import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

type PrefixOption = {
  label: string;
  code: string;
};

const PREFIX_OPTIONS: PrefixOption[] = [
  { label: "United States", code: "+1" },
  { label: "Canada", code: "+1" },
  { label: "Australia", code: "+61" },
  { label: "New Zealand", code: "+64" },
  { label: "United Kingdom", code: "+44" },
  { label: "Ireland", code: "+353" },
  { label: "Singapore", code: "+65" },
  { label: "India", code: "+91" },
  { label: "South Africa", code: "+27" },
  { label: "United Arab Emirates", code: "+971" },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeLocalPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [showPrefixModal, setShowPrefixModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const normalizedPhone = useMemo(
    () => `${phonePrefix}${normalizeLocalPhone(phoneLocal)}`,
    [phoneLocal, phonePrefix]
  );

  const selectedPrefixLabel = useMemo(() => {
    const found = PREFIX_OPTIONS.find((item) => item.code === phonePrefix);
    return found ? `${found.label} (${found.code})` : phonePrefix;
  }, [phonePrefix]);

  const handleStartRegistration = async () => {
    if (submitting) return;
    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (normalizeLocalPhone(phoneLocal).length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register/initiate", {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizedPhone,
        password,
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not start registration.");
      }
      setStep("verify");
      setMessage(data.message || "Verification codes sent to your email and phone.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (submitting) return;
    if (!emailCode.trim() || !smsCode.trim()) {
      setError("Enter both the email code and SMS code.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register/verify", {
        email: email.trim().toLowerCase(),
        emailCode: emailCode.trim(),
        smsCode: smsCode.trim(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }
      router.replace("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}> 
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Ionicons name={step === "details" ? "person-add" : "shield-checkmark"} size={36} color={Colors.white} />
            </View>
            <Text style={styles.appName}>{step === "details" ? "Create Account" : "Verify Account"}</Text>
            <Text style={styles.tagline}>
              {step === "details"
                ? "Register with email and mobile verification"
                : `Check your email inbox and SMS messages for the 6-digit codes`}
            </Text>
          </View>

          <View style={styles.formSection}>
            {!!error && (
              <View style={styles.errorBanner}>
                <View style={styles.bannerIconWrapError}>
                  <Ionicons name="close-circle" size={18} color={Colors.white} />
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!!message && (
              <View style={styles.successBanner}>
                <View style={styles.bannerIconWrapSuccess}>
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                </View>
                <Text style={styles.successText}>{message}</Text>
              </View>
            )}
            {step === "details" ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Jane Supervisor"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone</Text>
                  <View style={styles.phoneRow}>
                    <Pressable style={styles.prefixButton} onPress={() => setShowPrefixModal(true)}>
                      <Text style={styles.prefixButtonText}>{phonePrefix}</Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                    </Pressable>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="5551234567"
                      value={phoneLocal}
                      onChangeText={setPhoneLocal}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <Text style={styles.helperText}>{selectedPrefixLabel}</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={handleStartRegistration}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Send Verification Codes</Text>
                      <Ionicons name="mail-unread" size={20} color={Colors.white} />
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit email code"
                    value={emailCode}
                    onChangeText={setEmailCode}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>SMS Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit SMS code"
                    value={smsCode}
                    onChangeText={setSmsCode}
                    keyboardType="number-pad"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={handleVerify}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Verify and Create Account</Text>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                    </>
                  )}
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={handleStartRegistration} disabled={submitting}>
                  <Ionicons name="refresh" size={16} color={Colors.accent} />
                  <Text style={styles.secondaryButtonText}>Resend Codes</Text>
                </Pressable>

                <Pressable
                  style={styles.backButton}
                  onPress={() => {
                    setStep("details");
                    setError("");
                    setMessage("");
                    setEmailCode("");
                    setSmsCode("");
                  }}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.replace("/login")}>
              <Text style={styles.linkText}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPrefixModal} transparent animationType="fade" onRequestClose={() => setShowPrefixModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPrefixModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Select country code</Text>
            <FlatList
              data={PREFIX_OPTIONS}
              keyExtractor={(item) => `${item.label}-${item.code}`}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    setPhonePrefix(item.code);
                    setShowPrefixModal(false);
                  }}
                >
                  <Text style={styles.modalRowLabel}>{item.label}</Text>
                  <Text style={styles.modalRowCode}>{item.code}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  phoneRow: { flexDirection: "row", gap: 8 },
  prefixButton: {
    width: 92,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  prefixButtonText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  phoneInput: { flex: 1 },
  helperText: { marginLeft: 4, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
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
  primaryButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  primaryButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  secondaryButton: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  backButton: { alignItems: "center", paddingVertical: 6 },
  backButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  footer: { marginTop: 26, flexDirection: "row", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  linkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  bannerIconWrapError: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconWrapSuccess: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#991B1B" },
  successText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#166534" },
  devCodeCard: {
    backgroundColor: "#EEF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  devCodeCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1E3A8A",
  },
  devCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  devCodeLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  devCodeValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E3A8A" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,43,70,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: "75%",
    borderRadius: 16,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 10,
  },
  modalRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalRowLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  modalRowCode: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
});
