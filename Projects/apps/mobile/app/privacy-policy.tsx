import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroText}>
          This policy describes how SiteSnap AI collects, uses, stores, and shares project information entered through the mobile app.
        </Text>
      </View>

      <PolicyCard
        title="Information We Process"
        body="SiteSnap AI may process account identifiers, site details, diary entries, project notes, uploaded photos, timestamps, and device-provided metadata required to support diary creation and export."
      />
      <PolicyCard
        title="Purpose of Processing"
        body="Information is used to manage project records, generate site diary content, support supervisor review workflows, and enable exports or backups initiated by authorised users."
      />
      <PolicyCard
        title="Photos and AI Features"
        body="Uploaded photos and accompanying notes may be analysed to generate observations, summaries, and safety prompts. Users should avoid uploading personal or unrelated third-party content."
      />
      <PolicyCard
        title="Storage and Retention"
        body="Project data is stored securely on SiteSnap AI's cloud service so it can be synced across devices and reviewed by authorised supervisors. Exported files remain the responsibility of the organisation operating the project and should be handled under its retention policy."
      />
      <PolicyCard
        title="Access and Disclosure"
        body="Access is limited by the application role model. Supervisor and administrator accounts may review diaries and related site information for operational oversight. SiteSnap AI does not intentionally disclose project data beyond configured services and user-initiated exports."
      />
      <PolicyCard
        title="User Responsibilities"
        body="Users must ensure diary notes and uploads are accurate, work-related, and free from unnecessary sensitive personal information. Organisations are responsible for any internal privacy notices or contractual terms that also apply."
      />
      <PolicyCard
        title="Contact"
        body="Questions regarding privacy handling or operational data use can be directed to support@getsitesnapai.com."
      />
    </ScrollView>
  );
}

function PolicyCard(props: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title}</Text>
      <Text style={styles.cardBody}>{props.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
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
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 21 },
});
