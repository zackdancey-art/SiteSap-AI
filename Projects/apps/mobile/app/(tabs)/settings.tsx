import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import { DEFAULT_PROFILE, getLocalProfile } from "@/lib/profile-store";

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon, label, value, toggle, toggleValue, onToggle, onPress, danger }: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, danger && { backgroundColor: Colors.error + "14" }]}>
        <Ionicons name={icon} size={20} color={danger ? Colors.error : Colors.accent} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: Colors.error }]}>{label}</Text>
      {toggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: Colors.accent + "66" }}
          thumbColor={toggleValue ? Colors.accent : Colors.textTertiary}
        />
      )}
      {!!value && <Text style={styles.settingValue}>{value}</Text>}
      {!toggle && !value && <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, token } = useAuth();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const extra = Constants.expoConfig?.extra as { appVersion?: string; buildVersion?: string } | undefined;
  const versionLabel = `${extra?.appVersion || "0.0.1"} • ${extra?.buildVersion || "dev"}`;

  useFocusEffect(
    React.useCallback(() => {
      getLocalProfile().then(setProfile).catch(() => setProfile(DEFAULT_PROFILE));
    }, [])
  );

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your site data, entries, and reports. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const { resolveApiBaseUrl } = await import("@/lib/api-base-url");
              const BASE_URL = resolveApiBaseUrl();
              const res = await fetch(`${BASE_URL}/api/auth/account`, {
                method: "DELETE",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                throw new Error(data.error || "Failed to delete account.");
              }
              await logout();
              router.replace("/login");
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete account. Please try again.");
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Change Password",
      "Enter your current password and a new password (minimum 8 characters).",
      [{ text: "Continue", onPress: () => setChangingPassword(true) }, { text: "Cancel", style: "cancel" }]
    );
  };

  const submitPasswordChange = async () => {
    if (!pwCurrent) { Alert.alert("Error", "Current password is required."); return; }
    if (pwNew.length < 8) { Alert.alert("Error", "New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { Alert.alert("Error", "New passwords do not match."); return; }
    try {
      const { resolveApiBaseUrl } = await import("@/lib/api-base-url");
      const BASE_URL = resolveApiBaseUrl();
      const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to change password.");
      }
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setChangingPassword(false);
      Alert.alert("Success", "Your password has been updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to change password.");
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      router.replace("/login");
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + webBottomInset }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || "User"}</Text>
            <Text style={styles.profileEmail}>{profile.jobTitle || user?.email || "user@example.com"}</Text>
          </View>
          <Pressable style={styles.editProfileButton} onPress={() => router.push("/profile")}>
            <Ionicons name="pencil-outline" size={18} color={Colors.accent} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="notifications-outline"
              label="Push Notifications"
              toggle
              toggleValue={notifications}
              onToggle={setNotifications}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="save-outline"
              label="Auto-save Entries"
              toggle
              toggleValue={autoSave}
              onToggle={setAutoSave}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="location-outline"
              label="Location Tracking"
              toggle
              toggleValue={locationTracking}
              onToggle={setLocationTracking}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Export</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="download-outline" label="Export All Diaries" onPress={() => router.push("/export-diaries")} />
            <View style={styles.divider} />
            <SettingRow icon="cloud-upload-outline" label="Backup Data" onPress={() => router.push("/backup-data")} />
            <View style={styles.divider} />
            <SettingRow icon="document-outline" label="Export Format" value="PDF / Word" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="key-outline" label="Change Password" onPress={handleChangePassword} />
          </View>
          {changingPassword && (
            <View style={[styles.sectionCard, { marginTop: 12, padding: 16, gap: 12 }]}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary }}>Current password</Text>
              <TextInput
                style={styles.pwInput} secureTextEntry value={pwCurrent}
                onChangeText={setPwCurrent} autoComplete="current-password" placeholder="Current password"
              />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary }}>New password (min 8 chars)</Text>
              <TextInput
                style={styles.pwInput} secureTextEntry value={pwNew}
                onChangeText={setPwNew} autoComplete="new-password" placeholder="New password"
              />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary }}>Confirm new password</Text>
              <TextInput
                style={styles.pwInput} secureTextEntry value={pwConfirm}
                onChangeText={setPwConfirm} autoComplete="new-password" placeholder="Confirm new password"
              />
              <Pressable style={styles.pwButton} onPress={submitPasswordChange}>
                <Text style={styles.pwButtonText}>Update Password</Text>
              </Pressable>
              <Pressable onPress={() => { setChangingPassword(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}>
                <Text style={{ textAlign: "center", fontSize: 13, color: Colors.textTertiary, paddingTop: 4 }}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="information-circle-outline" label="Version" value={versionLabel} />
            <View style={styles.divider} />
            <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/privacy-policy")} />
            <View style={styles.divider} />
            <SettingRow icon="document-text-outline" label="Terms of Service" onPress={() => router.push("/terms-of-service")} />
            <View style={styles.divider} />
            <SettingRow icon="help-circle-outline" label="Help & Support" onPress={() => router.push("/help-support")} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <SettingRow icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
            <View style={styles.divider} />
            {deletingAccount ? (
              <View style={styles.settingRow}>
                <ActivityIndicator size="small" color={Colors.error} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: Colors.error }]}>Deleting account…</Text>
              </View>
            ) : (
              <SettingRow icon="trash-outline" label="Delete Account" onPress={handleDeleteAccount} danger />
            )}
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    gap: 14,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accent + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  settingValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 64,
  },
  pwInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  pwButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  pwButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
