import React from "react";
import { ScrollView, StyleSheet, Text, View, Linking, Pressable } from "react-native";
import Colors from "@/constants/colors";

const LAST_UPDATED = "3 July 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: string }) {
  return <Text style={styles.cardBody}>{children}</Text>;
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(href)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.heroText}>
          SiteSnap AI Pty Ltd is committed to protecting your personal information in accordance with the Australian Privacy Act 1988 (Cth) and the New Zealand Privacy Act 2020.
        </Text>
      </View>

      <Section title="1. Who We Are">
        <Body>SiteSnap AI Pty Ltd operates the SiteSnap mobile app and supervisor web portal. Contact our Privacy Officer at support@getsitesnapai.com with the subject "Privacy Enquiry".</Body>
      </Section>

      <Section title="2. Information We Collect">
        <Text style={styles.cardBody}>
          {"• Account info: name, email, phone number, hashed password\n"}
          {"• Site & project data: site names, addresses, diary entries, notes, photos, crew counts\n"}
          {"• Incident, inspection, and delivery records\n"}
          {"• Location data: GPS coordinates used at the moment of request to auto-fill weather — not stored\n"}
          {"• Device info: device type, OS version, push notification token\n"}
          {"• Usage data: anonymised analytics events to improve the product"}
        </Text>
      </Section>

      <Section title="3. How We Use Your Information">
        <Text style={styles.cardBody}>
          {"• Providing and operating the SiteSnap service\n"}
          {"• Sending verification codes, password resets, and notifications\n"}
          {"• Analysing photos and notes to generate AI diary content (via OpenAI)\n"}
          {"• Improving the product through aggregate, anonymised analytics\n"}
          {"• Complying with AU WHS and NZ HSWA record-keeping requirements"}
        </Text>
      </Section>

      <Section title="4. Third-Party Services">
        <Text style={styles.cardBody}>
          {"• OpenAI (USA) — AI diary generation. Photos and notes may be transmitted to OpenAI.\n"}
          {"• Resend / SendGrid (USA) — Email delivery\n"}
          {"• Twilio (USA) — SMS delivery\n"}
          {"• Sentry (USA) — Crash reporting\n"}
          {"• Amazon Web Services S3 — Photo and file storage\n\n"}
          {"All overseas transfers are made under standard contractual clauses or equivalent protections."}
        </Text>
      </Section>

      <Section title="5. Data Retention">
        <Body>We retain data as long as your account is active or as required by law. Site diary records may be subject to a 7-year minimum retention under Australian WHS legislation and the NZ Health and Safety at Work Act 2015. Deleted account data is permanently purged within 30 days.</Body>
      </Section>

      <Section title="6. Your Rights">
        <Text style={styles.cardBody}>
          {"Under AU Privacy Act 1988, NZ Privacy Act 2020, and where applicable the GDPR, you have the right to:\n\n"}
          {"• Access — request a copy of personal information we hold\n"}
          {"• Correction — ask us to correct inaccurate information\n"}
          {"• Deletion — request account and data deletion (subject to legal retention obligations)\n"}
          {"• Portability — request a machine-readable data export\n\n"}
          {"Email support@getsitesnapai.com with subject \"Privacy Request\". AU users: we respond within 30 days. NZ users: within 20 working days."}
        </Text>
      </Section>

      <Section title="7. Security">
        <Body>Passwords are hashed with scrypt. API communications use HTTPS with HSTS. Auth tokens use HMAC-SHA256. We will notify affected users and relevant authorities of any data breach as required by AU and NZ law.</Body>
      </Section>

      <Section title="8. Children's Privacy">
        <Body>SiteSnap is intended for construction professionals aged 18 and over. We do not knowingly collect information from minors.</Body>
      </Section>

      <Section title="9. Changes">
        <Body>We will notify you of material changes via the app or email at least 14 days before they take effect.</Body>
      </Section>

      <Section title="10. Contact & Complaints">
        <View style={{ gap: 8 }}>
          <Body>Privacy Officer — support@getsitesnapai.com</Body>
          <Text style={styles.cardBody}>
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>Australia: </Text>
            {"Complaints may be lodged with the OAIC at "}
          </Text>
          <Link href="https://www.oaic.gov.au" label="oaic.gov.au" />
          <Text style={styles.cardBody}>
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>New Zealand: </Text>
            {"Contact the Privacy Commissioner at "}
          </Text>
          <Link href="https://www.privacy.org.nz" label="privacy.org.nz" />
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    padding: 22,
    gap: 8,
  },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.white },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
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
  link: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.accent, lineHeight: 21 },
});
