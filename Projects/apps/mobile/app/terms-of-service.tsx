// DRAFT — requires legal review before onboarding paying customers.
// Update LEGAL_ENTITY below once the company is registered in New Zealand.
const LEGAL_ENTITY = "SiteSnap AI Limited";

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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

export default function TermsOfServiceScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      <View style={styles.draftBanner}>
        <Text style={styles.draftText}>
          DRAFT — requires legal review and sign-off before onboarding paying customers. Entity name pending NZ registration.
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Terms of Service</Text>
        <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.heroText}>
          By creating an account or using SiteSnap, you agree to be bound by these Terms of Service and our Privacy Policy.
        </Text>
      </View>

      <Section title="1. Acceptance of Terms">
        <Body>{`By accessing or using the SiteSnap AI mobile application or supervisor web portal (the "Service"), you agree to these Terms and our Privacy Policy. These terms form a binding agreement between you and ${LEGAL_ENTITY} ("SiteSnap", "we", "us"), a New Zealand company. If you do not agree, you must not use the Service.`}</Body>
      </Section>

      <Section title="2. Description of Service">
        <Body>SiteSnap is a construction site diary and project management platform that allows workers to log site entries, upload photos, and generate AI-assisted diary reports. Features include diary logging, AI-generated summaries, supervisor review workflows, and multi-format report export.</Body>
      </Section>

      <Section title="3. Account Registration">
        <Body>{"To use the Service you must register with a valid email address and mobile phone number. You agree to provide accurate information, keep your credentials secure, and notify us immediately at support@getsitesnapai.com if you suspect unauthorised access. You are responsible for all activity under your account."}</Body>
      </Section>

      <Section title="4. Acceptable Use">
        <Text style={styles.cardBody}>
          {"You may use the Service only for lawful construction site management. You must not:\n\n"}
          {"• Upload illegal, defamatory, or rights-infringing content\n"}
          {"• Store others' personal information without consent\n"}
          {"• Attempt unauthorised access to the Service or its infrastructure\n"}
          {"• Reverse engineer or extract source code from the application\n"}
          {"• Use automated scripts to scrape or bulk-download data\n"}
          {"• Interfere with the availability or performance of the Service"}
        </Text>
      </Section>

      <Section title="5. AI-Generated Content">
        <Body>SiteSnap uses OpenAI to generate diary summaries and safety observations. AI-generated content is a draft aid only and must be reviewed by a qualified person before use in any official context. SiteSnap makes no warranty that AI-generated content is accurate or legally compliant. You remain solely responsible for the accuracy of any diary or report submitted under your account.</Body>
      </Section>

      <Section title="6. Data Ownership">
        <Body>You retain ownership of all content you submit. By using the Service, you grant SiteSnap a limited, non-exclusive licence to host and process your content solely to operate and improve the Service. We will not sell your content to third parties.</Body>
      </Section>

      <Section title="7. Subscription and Payment">
        <Body>SiteSnap may offer free and paid tiers. Subscriptions are billed in advance in New Zealand Dollars (NZD). Australian users may be billed in AUD where indicated at checkout. Refunds are subject to the NZ Consumer Guarantees Act 1993 and Fair Trading Act 1986, and for AU users the Australian Consumer Law. We reserve the right to change pricing with 30 days' notice.</Body>
      </Section>

      <Section title="8. Health & Safety Disclaimer">
        <Body>{"SiteSnap is a record-keeping tool, not a substitute for professional H&S advice. You must ensure all records comply with the NZ Health and Safety at Work Act 2015 (HSWA) and, for Australian users, applicable state/territory WHS legislation. AI-generated safety checklists do not constitute professional H&S advice. SiteSnap accepts no liability for H&S/WHS incidents, breaches, or fines arising from use of the Service."}</Body>
      </Section>

      <Section title="9. Limitation of Liability">
        <Body>To the maximum extent permitted by applicable law, SiteSnap provides the Service "as is" without warranty. We are not liable for indirect, incidental, or consequential loss. Our total liability shall not exceed fees you paid in the preceding 12 months. Nothing limits your rights under the NZ Consumer Guarantees Act 1993, Fair Trading Act 1986, or for AU users the Australian Consumer Law.</Body>
      </Section>

      <Section title="10. Termination">
        <Body>You may terminate your account via Settings at any time. We may suspend or terminate your account immediately for breach of these Terms. Upon termination, your data is deleted in accordance with our Privacy Policy and legal retention obligations.</Body>
      </Section>

      <Section title="11. Governing Law">
        <Body>These Terms are governed by the laws of New Zealand. Disputes shall be resolved in the courts of New Zealand. For users in Australia, mandatory consumer and privacy protections under Australian law apply and are not excluded by this clause.</Body>
      </Section>

      <Section title="12. Changes">
        <Body>We may update these Terms with 14 days' notice via the app or email. Continued use constitutes acceptance.</Body>
      </Section>

      <Section title="13. Contact">
        <Body>{`${LEGAL_ENTITY} · support@getsitesnapai.com`}</Body>
      </Section>

      <View style={styles.assumptionBox}>
        <Text style={styles.assumptionTitle}>Assumptions to verify before going live:</Text>
        <Text style={styles.assumptionBody}>
          {"1. Entity name is \"" + LEGAL_ENTITY + "\" — update once registered.\n"}
          {"2. Company incorporated in New Zealand; NZ law governs.\n"}
          {"3. NZD primary billing currency; AUD for Australian users.\n"}
          {"4. Consumer Guarantees Act / Fair Trading Act carve-outs appropriate for this B2B context — seek NZ legal advice.\n"}
          {"5. 7-year HSWA record retention applies — seek NZ legal advice to confirm.\n"}
          {"6. No advertising; no sale of user data.\n"}
          {"7. support@getsitesnapai.com is the active contact."}
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  draftBanner: {
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: 12,
    padding: 14,
  },
  draftText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.warningText,
    lineHeight: 18,
  },
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
  assumptionBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  assumptionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  assumptionBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary, lineHeight: 19 },
});
