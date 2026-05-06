import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const LAST_UPDATED = "6 May 2026";

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Terms of Service</Text>
          <Text style={styles.heroText}>
            Please read these terms carefully before using SiteSnap. By creating an account or using the application, you agree to be bound by these Terms of Service.
          </Text>
          <Text style={[styles.heroText, { marginTop: 8, opacity: 0.7 }]}>Last updated: {LAST_UPDATED}</Text>
        </View>

        <TermsCard
          title="1. Acceptance of Terms"
          body="By accessing or using the SiteSnap AI mobile application or supervisor web portal (together, the 'Service'), you agree to these Terms of Service and our Privacy Policy. If you do not agree, you must not use the Service. These terms form a binding agreement between you and SiteSnap AI Pty Ltd ('SiteSnap', 'we', 'us')."
        />

        <TermsCard
          title="2. Description of Service"
          body={"SiteSnap is a construction site diary and project management platform that allows workers to log site entries, upload photos, and generate AI-assisted diary reports. The Service is intended for use by construction industry professionals.\n\nFeatures include:\n• Site diary entry and photo logging\n• AI-generated diary summaries and safety observations\n• Supervisor review and approval workflows\n• Report export (PDF, Word, HTML, CSV)\n• Push notifications for diary approvals and safety alerts"}
        />

        <TermsCard
          title="3. Account Registration"
          body={"To use the Service, you must register an account with a valid email address and mobile phone number. You agree to:\n\n• Provide accurate and complete information at registration\n• Keep your account credentials secure and confidential\n• Notify us immediately at support@getsitesnapai.com if you suspect unauthorised access\n• Not share your account with any other person\n\nYou are responsible for all activity that occurs under your account."}
        />

        <TermsCard
          title="4. Acceptable Use"
          body={"You may use the Service only for lawful purposes related to construction site management. You must not:\n\n• Upload content that is illegal, defamatory, abusive, or infringes third-party rights\n• Use the Service to store or transmit personal information of others without consent\n• Attempt to gain unauthorised access to any part of the Service or its infrastructure\n• Reverse engineer, decompile, or extract source code from the application\n• Use automated scripts to scrape or bulk-download data\n• Interfere with the availability or performance of the Service\n\nViolation of these terms may result in immediate account suspension or termination."}
        />

        <TermsCard
          title="5. AI-Generated Content"
          body={"SiteSnap uses artificial intelligence (OpenAI) to generate diary summaries, safety observations, and report content based on your entries and uploaded photos.\n\nYou acknowledge that:\n\n• AI-generated content is provided as a draft aid only and must be reviewed by a qualified person before use in any official context\n• SiteSnap makes no warranty that AI-generated content is accurate, complete, or legally compliant\n• You remain solely responsible for the accuracy of any diary, report, or safety record submitted under your account\n• AI-generated safety observations do not constitute professional WHS advice"}
        />

        <TermsCard
          title="6. Data Ownership"
          body={"You retain ownership of all content and data you submit to the Service ('Your Content'). By using the Service, you grant SiteSnap a limited, non-exclusive licence to host, process, and display Your Content solely for the purpose of operating and improving the Service.\n\nWe will not sell Your Content to third parties. We may use aggregated, de-identified data to improve our AI models and product analytics."}
        />

        <TermsCard
          title="7. Subscription and Payment"
          body={"SiteSnap may offer free and paid subscription tiers. Pricing and features of each tier are described on our website.\n\n• Subscriptions are billed in advance on a monthly or annual basis\n• All fees are in Australian Dollars (AUD) unless otherwise stated\n• Refunds are provided at our discretion in accordance with Australian Consumer Law\n• We reserve the right to change pricing with 30 days' notice\n\nFailure to pay may result in suspension or downgrade of your account."}
        />

        <TermsCard
          title="8. Work Health & Safety Disclaimer"
          body={"SiteSnap is a record-keeping and reporting tool. It is not a substitute for professional Work Health and Safety advice, site inspections, or compliance assessments.\n\nYou must:\n\n• Ensure all diary entries and safety records comply with applicable Work Health and Safety legislation — including the Model WHS Act (Australia), Work Health and Safety Act 2011 (Qld/NSW/ACT/SA/Tas/NT), and the Health and Safety at Work Act 2015 (New Zealand)\n• Not rely solely on AI-generated safety checklists or observations to fulfil your WHS/HSWA obligations\n• Consult a qualified WHS/H&S professional for specific compliance advice\n\nSiteSnap accepts no liability for WHS or HSWA incidents, breaches, or fines arising from use of the Service."}
        />

        <TermsCard
          title="9. Limitation of Liability"
          body={"To the maximum extent permitted by applicable law:\n\n• SiteSnap provides the Service 'as is' without warranty of any kind\n• We are not liable for any indirect, incidental, special, or consequential loss arising from your use of the Service\n• Our total liability to you for any claim shall not exceed the fees you paid to us in the 12 months preceding the claim\n\nNothing in these terms limits any rights you have under the Australian Consumer Law, or the New Zealand Consumer Guarantees Act 1993 or Fair Trading Act 1986."}
        />

        <TermsCard
          title="10. Termination"
          body={"You may terminate your account at any time via Settings > Delete Account in the app. Upon termination, your data will be deleted in accordance with our Privacy Policy and applicable legal obligations.\n\nWe may suspend or terminate your account immediately if you breach these Terms, without notice or refund."}
        />

        <TermsCard
          title="11. Governing Law"
          body={"These Terms are governed by the laws of New South Wales, Australia. Any disputes arising from these Terms shall be resolved in the courts of New South Wales.\n\nFor users accessing the Service from New Zealand: where mandatory provisions of New Zealand law apply (including the Consumer Guarantees Act 1993, Fair Trading Act 1986, and Privacy Act 2020), those provisions are not excluded by this clause. New Zealand users may elect to resolve disputes under New Zealand jurisdiction if required by applicable law."}
        />

        <TermsCard
          title="12. Changes to These Terms"
          body="We may update these Terms from time to time. We will notify you of material changes via the app or email at least 14 days before the change takes effect. Continued use of the Service after that date constitutes acceptance of the updated Terms."
        />

        <TermsCard
          title="13. Contact"
          body={"For questions about these Terms:\n\nSiteSnap AI Pty Ltd\nemail: support@getsitesnapai.com\n\nFor disputes, please contact us first to seek resolution before pursuing formal legal action."}
        />
      </ScrollView>
    </View>
  );
}

function TermsCard(props: { title: string; body: string }) {
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
