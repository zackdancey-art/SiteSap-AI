import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useData } from "@/lib/data-context";
import Colors from "@/constants/colors";
import { InviteResult } from "@/lib/types";

type Role = "crew" | "manager";

export default function SiteInviteScreen() {
  const insets = useSafeAreaInsets();
  const { siteId, siteName } = useLocalSearchParams<{ siteId?: string; siteName?: string }>();
  const { inviteCrewMembers } = useData();

  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<Role>("crew");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const parseEmails = (raw: string): string[] =>
    raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

  const handleSend = async () => {
    if (!siteId) return;
    const emails = parseEmails(emailsText);
    if (emails.length === 0) {
      Alert.alert("No emails", "Enter at least one valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await inviteCrewMembers(siteId, emails, role);
      setResults(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Invite failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: InviteResult["status"]) => {
    if (status === "sent") return <Ionicons name="mail-outline" size={16} color={Colors.success} />;
    if (status === "resent") return <Ionicons name="refresh-outline" size={16} color={Colors.warning} />;
    return <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textTertiary} />;
  };

  const statusLabel = (status: InviteResult["status"]) => {
    if (status === "sent") return "Invite sent";
    if (status === "resent") return "Invite resent";
    return "Already a member";
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Invite Crew</Text>
          {!!siteName && <Text style={styles.headerSub}>{siteName}</Text>}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {results === null ? (
          <>
            <Text style={styles.label}>Email addresses</Text>
            <TextInput
              style={styles.textArea}
              placeholder={"alice@example.com\nbob@example.com"}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={6}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={emailsText}
              onChangeText={setEmailsText}
            />
            <Text style={styles.hint}>One email per line, or separated by commas.</Text>

            <Text style={[styles.label, { marginTop: 24 }]}>Role</Text>
            <View style={styles.roleRow}>
              {(["crew", "manager"] as Role[]).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.85 }, loading && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color={Colors.white} />
                  <Text style={styles.sendButtonText}>Send Invites</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.resultsTitle}>Invites sent</Text>
            {results.map((r) => (
              <View key={r.email} style={styles.resultRow}>
                {statusIcon(r.status)}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.resultEmail}>{r.email}</Text>
                  <Text style={styles.resultStatus}>{statusLabel(r.status)}</Text>
                </View>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.sendButton, { marginTop: 24 }, pressed && { opacity: 0.85 }]}
              onPress={() => router.back()}
            >
              <Text style={styles.sendButtonText}>Done</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 6,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roleChipActive: {
    backgroundColor: Colors.accent + "14",
    borderColor: Colors.accent,
  },
  roleChipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
  sendButton: {
    marginTop: 32,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  resultEmail: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  resultStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
