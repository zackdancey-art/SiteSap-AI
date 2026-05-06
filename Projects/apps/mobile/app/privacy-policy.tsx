import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const LAST_UPDATED = "6 May 2026";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroText}>
            SiteSnap AI Pty Ltd ("SiteSnap", "we", "us") is committed to protecting your personal information in accordance with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs), and the New Zealand Privacy Act 2020 and its Information Privacy Principles (IPPs).
          </Text>
          <Text style={[styles.heroText, { marginTop: 8, opacity: 0.7 }]}>Last updated: {LAST_UPDATED}</Text>
        </View>

        <PolicyCard
          title="1. Who We Are"
          body={"SiteSnap AI Pty Ltd operates the SiteSnap mobile application and supervisor web portal. Our registered contact address is:\n\nsupport@getsitesnapai.com\n\nFor privacy-related enquiries, contact our Privacy Officer at the email above with the subject line 'Privacy Enquiry'."}
        />

        <PolicyCard
          title="2. Information We Collect"
          body={"We collect the following categories of personal information:\n\n• Account information: name, email address, mobile phone number, and password (stored as a one-way hash).\n\n• Site and project data: site names, addresses, client names, diary entries, notes, photos, crew counts, and weather readings you enter into the application.\n\n• Device information: device type, operating system version, and push notification token (for sending alerts).\n\n• Location data: GPS coordinates when you choose to use the location feature to auto-fill weather conditions. Location is not stored — it is used only at the moment of the request.\n\n• Usage data: in-app analytics events (page views, report exports) to improve the product. No personally identifiable usage data is shared with third parties for advertising purposes."}
        />

        <PolicyCard
          title="3. How We Use Your Information"
          body={"We process your information for the following purposes:\n\n• Providing and operating the SiteSnap service (account management, diary generation, report exports).\n\n• Sending verification codes, password reset links, and safety or diary approval notifications.\n\n• Analysing uploaded photos and site notes to generate AI diary content (using OpenAI's API — see Third-Party Services).\n\n• Improving the product through aggregate, anonymised usage analytics.\n\n• Complying with legal obligations, including Australian WHS record-keeping requirements."}
        />

        <PolicyCard
          title="4. Third-Party Services"
          body={"We use the following third-party processors. Each operates under its own privacy policy and, where applicable, a Data Processing Agreement with us:\n\n• OpenAI (USA) — AI diary generation. Photos and site notes may be transmitted to OpenAI's API. OpenAI's data retention policies apply. openai.com/policies/privacy-policy\n\n• Resend / SendGrid (USA) — Transactional email delivery (verification codes, password resets). resend.com/privacy or sendgrid.com/privacy\n\n• Twilio (USA) — SMS delivery (verification codes). twilio.com/legal/privacy\n\n• Sentry (USA) — Crash reporting and error monitoring. Sentry may receive device and stack trace data when errors occur. sentry.io/privacy\n\n• Amazon Web Services S3 (Australia / USA) — Photo storage. Files are stored in S3-compatible object storage.\n\nAll overseas transfers are made on the basis that the recipient country has equivalent privacy protections, or under standard contractual clauses."}
        />

        <PolicyCard
          title="5. Data Retention"
          body={"We retain your personal information for as long as your account is active or as required by law.\n\n• Site diary records may be subject to a minimum 7-year retention requirement under Australian Work Health and Safety (WHS) legislation and New Zealand Health and Safety at Work Act 2015 (HSWA).\n\n• When you delete your account, your personal account details and project data are scheduled for permanent deletion within 30 days, except where retention is required by law.\n\n• Photos stored in S3 are deleted within 30 days of account deletion.\n\n• Soft-deleted records are permanently purged on a scheduled basis."}
        />

        <PolicyCard
          title="6. Your Rights"
          body={"Under the Australian Privacy Act 1988, the New Zealand Privacy Act 2020, and where applicable the GDPR, you have the right to:\n\n• Access: Request a copy of the personal information we hold about you.\n\n• Correction: Ask us to correct inaccurate or incomplete information.\n\n• Deletion: Request deletion of your account and associated data (subject to legal retention obligations).\n\n• Portability: Request an export of your data in a machine-readable format.\n\n• Opt-out: Withdraw consent for non-essential communications at any time via app Settings > Notifications.\n\nTo exercise any of these rights, email support@getsitesnapai.com with the subject line 'Privacy Request'. We will respond within 20 working days (as required by the NZ Privacy Act 2020) or 30 calendar days for Australian users."}
        />

        <PolicyCard
          title="7. Security"
          body={"We implement industry-standard security measures including:\n\n• Passwords are hashed using scrypt with a random salt — we never store plain-text passwords.\n\n• All API communications use HTTPS with HSTS enforced in production.\n\n• Authentication tokens use HMAC-SHA256 signing with a secret key.\n\n• Access to personal data is restricted to employees who need it to operate the service.\n\nDespite these measures, no internet transmission is completely secure. In the event of a data breach, we will notify affected users and relevant authorities as required by Australian law."}
        />

        <PolicyCard
          title="8. Children's Privacy"
          body="SiteSnap is intended for use by construction industry professionals aged 18 and over. We do not knowingly collect personal information from individuals under 18. If you believe a minor has provided us with personal information, please contact us immediately."
        />

        <PolicyCard
          title="9. Changes to This Policy"
          body="We may update this Privacy Policy from time to time. We will notify you of material changes via the app or email at least 14 days before the change takes effect. Continued use of the app after that date constitutes acceptance of the updated policy."
        />

        <PolicyCard
          title="10. Contact & Complaints"
          body={"For privacy enquiries or complaints, contact:\n\nPrivacy Officer\nemail: support@getsitesnapai.com\n\nAustralian users: If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.\n\nNew Zealand users: You may contact the Office of the Privacy Commissioner (OPC) at privacy.org.nz or by phone 0800 803 909. You may also refer a complaint to the OPC if you are not satisfied with our response within 20 working days.\n\nEU/UK residents: You may contact your local supervisory authority (e.g. ICO in the UK)."}
        />
      </ScrollView>
    </View>
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
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: Colors.text },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { backgroundColor: Colors.primary, borderRadius: 22, padding: 22, gap: 8 },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.white },
  heroText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.84)", lineHeight: 20 },
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16, gap: 8,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 21 },
});
