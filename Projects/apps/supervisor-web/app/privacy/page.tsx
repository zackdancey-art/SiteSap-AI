import Link from "next/link";

export const metadata = { title: "Privacy Policy — SiteSnap AI" };

// DRAFT — requires legal review before onboarding paying customers.
// Registered entity name to be confirmed once the company is incorporated in NZ.
// Update LEGAL_ENTITY in one place below when the name is finalised.
const LEGAL_ENTITY = "SiteSnap AI Limited";
const LAST_UPDATED = "3 July 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F2B46", marginBottom: 12, borderBottom: "1px solid #DDE3EB", paddingBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5F7FA", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/settings" style={{ color: "#E8731A", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← Back to Settings</Link>
        </div>

        {/* Draft notice */}
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: "14px 20px", marginBottom: 24, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
          <strong>Draft — not yet in effect.</strong> This document requires legal review and sign-off before SiteSnap onboards paying customers. The registered entity name must also be confirmed and updated below once the company is incorporated in New Zealand.
        </div>

        <div style={{ background: "#0F2B46", borderRadius: 16, padding: "32px 40px", marginBottom: 32, color: "#fff" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ opacity: 0.7, fontSize: 13 }}>Last updated: {LAST_UPDATED}</p>
          <p style={{ marginTop: 16, opacity: 0.85, lineHeight: 1.7, fontSize: 14 }}>
            {LEGAL_ENTITY} is committed to protecting your personal information in accordance with the New Zealand Privacy Act 2020 and its Information Privacy Principles (IPPs). Where the service is used by Australian users, we also comply with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", boxShadow: "0 1px 4px rgba(15,43,70,0.08)" }}>
          <Section title="1. Who We Are">
            <p>{LEGAL_ENTITY} is a New Zealand company that operates the SiteSnap mobile application and supervisor web portal. Contact our Privacy Officer at <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a> with the subject "Privacy Enquiry".</p>
          </Section>

          <Section title="2. Information We Collect">
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong>Account information:</strong> name, email address, mobile phone number, hashed password</li>
              <li><strong>Site and project data:</strong> site names, addresses, diary entries, notes, photos, crew counts, weather readings</li>
              <li><strong>Incident, inspection, and delivery records</strong> entered by users</li>
              <li><strong>Device information:</strong> device type, OS version, push notification token</li>
              <li><strong>Location data:</strong> GPS coordinates used at the moment of request to auto-fill weather — not stored beyond the request</li>
              <li><strong>Usage data:</strong> anonymised analytics events to improve the product</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Providing and operating the SiteSnap service</li>
              <li>Sending verification codes, password resets, and notifications</li>
              <li>Analysing photos and notes to generate AI diary content (via OpenAI)</li>
              <li>Improving the product through aggregate, anonymised analytics</li>
              <li>Meeting record-keeping obligations under the New Zealand Health and Safety at Work Act 2015 (HSWA) and, where applicable to Australian users, the Model WHS Act and state/territory Work Health and Safety legislation</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p style={{ marginBottom: 8 }}>The following processors handle data on our behalf:</p>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong>OpenAI (USA)</strong> — AI diary generation. Photos and notes may be transmitted to OpenAI&apos;s API.</li>
              <li><strong>Resend / SendGrid (USA)</strong> — Transactional email delivery</li>
              <li><strong>Twilio (USA)</strong> — SMS delivery</li>
              <li><strong>Sentry (USA)</strong> — Crash reporting and error monitoring</li>
              <li><strong>Amazon Web Services S3</strong> — Photo and file storage</li>
            </ul>
            <p style={{ marginTop: 8 }}>All overseas transfers of personal information are made in compliance with the NZ Privacy Act 2020 information privacy principle 12 (restrictions on disclosure overseas). Where applicable to Australian users, transfers also comply with the Australian Privacy Act 1988.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain data as long as your account is active or as required by law. Site diary records are subject to a minimum 7-year retention period under the New Zealand Health and Safety at Work Act 2015 (HSWA), regulations made under it, and — where records relate to Australian sites — the applicable state/territory Work Health and Safety legislation. Deleted account data is permanently purged within 30 days, subject to these retention obligations.</p>
          </Section>

          <Section title="6. Your Rights">
            <p style={{ marginBottom: 8 }}>Under the New Zealand Privacy Act 2020 you have the right to:</p>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong>Access</strong> — request a copy of personal information we hold about you (IPP 6)</li>
              <li><strong>Correction</strong> — ask us to correct inaccurate information (IPP 7)</li>
              <li><strong>Deletion</strong> — request account and data deletion (subject to legal retention obligations)</li>
              <li><strong>Portability</strong> — request a machine-readable data export</li>
              <li><strong>Opt-out</strong> — withdraw consent for non-essential communications via Settings &gt; Notifications</li>
            </ul>
            <p style={{ marginTop: 8 }}>Australian users also have equivalent rights under the Australian Privacy Act 1988 (APPs 12 and 13).</p>
            <p style={{ marginTop: 8 }}>Email <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a> with subject "Privacy Request". We respond within 20 working days as required by the NZ Privacy Act 2020. For Australian users, we respond within 30 days.</p>
          </Section>

          <Section title="7. Security">
            <p>Passwords are hashed with scrypt. API communications use HTTPS with HSTS. Auth tokens use HMAC-SHA256. Auth tokens are stored in httpOnly cookies, not accessible by browser JavaScript. Despite these measures, no internet transmission is completely secure. We will notify affected users and relevant authorities of any notifiable privacy breach as required by the NZ Privacy Act 2020 (Part 7) and, where applicable, the Australian Privacy Act 1988.</p>
          </Section>

          <Section title="8. Children&apos;s Privacy">
            <p>SiteSnap is intended for construction professionals aged 18 and over. We do not knowingly collect information from minors.</p>
          </Section>

          <Section title="9. Changes">
            <p>We will notify you of material changes via the app or email at least 14 days before they take effect.</p>
          </Section>

          <Section title="10. Contact & Complaints">
            <p>Privacy Officer — <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a></p>
            <p style={{ marginTop: 8 }}><strong>New Zealand:</strong> Complaints unresolved by us may be referred to the <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer" style={{ color: "#E8731A" }}>Office of the Privacy Commissioner (OPC)</a> at privacy.org.nz or 0800 803 909.</p>
            <p style={{ marginTop: 8 }}><strong>Australia:</strong> Australian users may also lodge complaints with the <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" style={{ color: "#E8731A" }}>Office of the Australian Information Commissioner (OAIC)</a> at oaic.gov.au.</p>
          </Section>

          <div style={{ marginTop: 32, padding: "16px 20px", background: "#F9FAFB", borderRadius: 10, fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
            <strong>Assumptions requiring verification before this document goes live:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Registered entity name is "{LEGAL_ENTITY}" — update LEGAL_ENTITY in this file once confirmed.</li>
              <li>Company is incorporated in New Zealand (not Australia).</li>
              <li>Primary market is NZ; AU is a secondary market where the service is also offered.</li>
              <li>No advertising; no sale of user data — correct for a B2B tool.</li>
              <li>Third-party processors are OpenAI, Resend/SendGrid, Twilio, Sentry, and AWS S3 — verify this remains current.</li>
              <li>7-year HSWA record-keeping obligation applies to the project diary records stored by SiteSnap — seek NZ legal advice to confirm.</li>
              <li>support@getsitesnapai.com is the active privacy/support contact.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
