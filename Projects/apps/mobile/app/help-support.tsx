import React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function HelpSupportScreen() {
  const openMail = async () => {
    const url = "mailto:support@getsitesnapai.com?subject=SiteSnap%20Support%20Request";
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Unavailable", "Email is not configured on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Help & Support</Text>
        <Text style={styles.heroText}>
          Operational support for field teams, supervisors, and administrators using SiteSnap across active projects.
        </Text>
      </View>

      <View style={styles.card}>
        <SupportRow icon="mail-outline" title="Support Desk" body="support@getsitesnapai.com" />
        <SupportRow icon="time-outline" title="Service Hours" body="Monday to Friday, 8:00am to 6:00pm NZT" />
        <SupportRow icon="flash-outline" title="Priority Response" body="Critical production incidents are triaged within 4 business hours." />
        <SupportRow icon="document-text-outline" title="General Response" body="Standard product and account enquiries are typically answered within 1 business day." />
        <Pressable style={styles.primaryButton} onPress={openMail}>
          <Ionicons name="send" size={16} color={Colors.white} />
          <Text style={styles.primaryButtonText}>Contact Support</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recommended Information to Include</Text>
        <Text style={styles.body}>Project name, affected site, user email, device type, screenshots, and the exact time the issue occurred.</Text>
        <Text style={styles.body}>For diary-generation issues, include the reporting period selected and whether photos were attached to the entry.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Self-Service Guidance</Text>
        <Text style={styles.body}>1. Confirm the mobile device is on the same network as the API when testing locally.</Text>
        <Text style={styles.body}>2. Re-open Expo Go after config or environment changes.</Text>
        <Text style={styles.body}>3. Verify required fields are completed before saving sites, entries, or profile updates.</Text>
      </View>
    </ScrollView>
  );
}

function SupportRow(props: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={props.icon} size={18} color={Colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        <Text style={styles.rowBody}>{props.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    padding: 22,
    gap: 8,
  },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.white },
  heroText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.84)", lineHeight: 21 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.accent + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rowBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 19 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  primaryButton: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: Colors.white, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
