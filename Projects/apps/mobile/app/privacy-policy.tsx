// DRAFT — requires legal review before onboarding paying customers.
// Update LEGAL_ENTITY below once the company is registered in New Zealand.
const LEGAL_ENTITY = "SiteSnap AI Limited";

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

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(href)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      <View style={styles.draftBanner}>
        <Text style={styles.draftText}>
          DRAFT — requires legal review and sign-off before onboarding paying customers. Entity name pending NZ registration.
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.heroText}>
          {LEGAL_ENTITY} is committed to protecting your personal information in accordance with the New Zealand Privacy Act 2020 and its Information Privacy Principles (IPPs). Where the service is used by Australian users, we also comply with the Australian Privacy Act 1988 (Cth).
        </Text>
      </View>

      <Section title="1. Who We Are">
        <Body>{`${LEGAL_ENTITY} is a New Zealand company that operates the SiteSnap mobile app and supervisor web portal. Contact our Privacy Officer at support@getsitesnapai.com with the subject "Privacy Enquiry".`}</Body>
      </Section>

      <Section title="2. Information We Collect">
        <Text style={styles.cardBody}>
          {"• Account info: name, email, phone number, hashed password\n"}
          {"• Site & project data: site names, addresses, diary entries, notes, photos, crew counts\n"}
          {"• Incident, inspection, and delivery records\n"}
          {"• Location data: GPS coordinates used at request time to auto-fill weather — not stored\n"}
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
          {"• Meeting record-keeping obligations under the NZ Health and Safety at Work Act 2015 (HSWA) and, for Australian users, applicable WHS legislation"}
        </Text>
      </Section>

      <Section title="4. Third-Party Services">
        <Text style={styles.cardBody}>
          {"• OpenAI (USA) — AI diary generation; photos and notes may be transmitted\n"}
          {"• Resend / SendGrid (USA) — Email delivery\n"}
          {"• Twilio (USA) — SMS delivery\n"}
          {"• Sentry (USA) — Crash reporting\n"}
          {"• Amazon Web Services S3 — Photo and file storage\n\n"}
          {"All overseas transfers comply with NZ Privacy Act 2020 IPP 12. For Australian users, they also comply with the Australian Privacy Act 1988."}
        </Text>
      </Section>

      <Section title="5. Data Retention">
        <Body>{"We retain data as long as your account is active or as required by law. Site diary records are subject to a minimum 7-year retention period under the NZ Health and Safety at Work Act 2015 (HSWA) and, for records relating to Australian sites, applicable state/territory WHS legislation. Deleted account data is permanently purged within 30 days, subject to these retention obligations."}</Body>
      </Section>

      <Section title="6. Your Rights (NZ Privacy Act 2020)">
        <Text style={styles.cardBody}>
          {"• Access (IPP 6) — request a copy of your personal information\n"}
          {"• Correction (IPP 7) — ask us to correct inaccurate information\n"}
          {"• Deletion — request account and data deletion (subject to legal retention obligations)\n"}
          {"• Portability — request a machine-readable data export\n\n"}
          {"Australian users also have equivalent rights under the Australian Privacy Act 1988.\n\n"}
          {"Email support@getsitesnapai.com with subject \"Privacy Request\". NZ users: we respond within 20 working days. AU users: within 30 days."}
        </Text>
      </Section>

      <Section title="7. Security">
        <Body>{"Passwords are hashed with scrypt. API communications use HTTPS with HSTS. Auth tokens are stored in httpOnly cookies not accessible by browser scripts. We will notify users and relevant authorities of any notifiable privacy breach under the NZ Privacy Act 2020 (Part 7) and, where applicable, the Australian Privacy Act 1988."}</Body>
      </Section>

      <Section title="8. Children's Privacy">
        <Body>SiteSnap is intended for construction professionals aged 18 and over. We do not knowingly collect information from minors.</Body>
      </Section>

      <Section title="9. Changes">
        <Body>We will notify you of material changes via the app or email at least 14 days before they take effect.</Body>
      </Section>

      <Section title="10. Contact & Complaints">
        <View style={{ gap: 8 }}>
          <Body>{`Privacy Officer — support@getsitesnapai.com`}</Body>
          <Text style={styles.cardBody}>
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>New Zealand: </Text>
            {"Complaints may be referred to the Privacy Commissioner at "}
          </Text>
          <ExternalLink href="https://www.privacy.org.nz" label="privacy.org.nz" />
          <Text style={styles.cardBody}>
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>Australia: </Text>
            {"AU users may also contact the OAIC at "}
          </Text>
          <ExternalLink href="https://www.oaic.gov.au" label="oaic.gov.au" />
        </View>
      </Section>

      <View style={styles.assumptionBox}>
        <Text style={styles.assumptionTitle}>Assumptions to verify before going live:</Text>
        <Text style={styles.assumptionBody}>
          {"1. Entity name is \"" + LEGAL_ENTITY + "\" — update once registered.\n"}
          {"2. Company incorporated in New Zealand.\n"}
          {"3. NZ primary market; AU secondary.\n"}
          {"4. Third-party processors: OpenAI, Resend/SendGrid, Twilio, Sentry, AWS S3.\n"}
          {"5. 7-year HSWA record retention applies — seek NZ legal advice to confirm.\n"}
          {"6. No advertising; no sale of user data.\n"}
          {"7. support@getsitesnapai.com is the active privacy contact."}
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
  link: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.accent, lineHeight: 21 },
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
