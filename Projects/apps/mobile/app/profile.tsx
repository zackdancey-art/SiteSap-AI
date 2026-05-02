import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import { DEFAULT_PROFILE, LocalProfile, getLocalProfile, saveLocalProfile } from "@/lib/profile-store";

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [profile, setProfile] = useState<LocalProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLocalProfile().then(setProfile).catch(() => setProfile(DEFAULT_PROFILE));
  }, []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfile((current) => ({ ...current, avatarUri: result.assets[0].uri }));
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      await saveLocalProfile(profile);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile update failed.";
      Alert.alert("Update Failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
          {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>
                {(name || user?.name || "U")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color={Colors.white} />
          </View>
        </Pressable>
        <Text style={styles.heroTitle}>Profile</Text>
        <Text style={styles.heroSubtitle}>Maintain your contact details, trade role, and site identity.</Text>
      </View>

      <View style={styles.card}>
        <Field label="Email" value={user?.email ?? "unknown"} readonly />
        <Field label="Display Name" value={name} onChangeText={setName} placeholder="Your full name" />
        <Field
          label="Job Title"
          value={profile.jobTitle}
          onChangeText={(value) => setProfile((current) => ({ ...current, jobTitle: value }))}
          placeholder="e.g. Site Supervisor"
        />
        <Field
          label="Company"
          value={profile.company}
          onChangeText={(value) => setProfile((current) => ({ ...current, company: value }))}
          placeholder="Your company"
        />
        <Field
          label="Phone"
          value={profile.phone}
          onChangeText={(value) => setProfile((current) => ({ ...current, phone: value }))}
          placeholder="+64 ..."
        />
        <Field
          label="Emergency Contact"
          value={profile.emergencyContact}
          onChangeText={(value) => setProfile((current) => ({ ...current, emergencyContact: value }))}
          placeholder="Name and phone"
        />
        <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]} onPress={onSave} disabled={saving}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Profile"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  readonly?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      {props.readonly ? (
        <Text style={styles.readonly}>{props.value}</Text>
      ) : (
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          style={styles.input}
          placeholder={props.placeholder}
          placeholderTextColor={Colors.textTertiary}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 30 },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 28,
    marginBottom: 14,
    position: "relative",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
  },
  avatarFallback: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 30,
    color: Colors.white,
    fontFamily: "Inter_700Bold",
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  heroTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.white },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  readonly: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonPressed: { opacity: 0.92 },
  saveButtonText: { color: Colors.white, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
