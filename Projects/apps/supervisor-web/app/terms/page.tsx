import Link from "next/link";

export const metadata = { title: "Terms of Service — SiteSnap AI" };

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

export default function TermsPage() {
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
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ opacity: 0.7, fontSize: 13 }}>Last updated: {LAST_UPDATED}</p>
          <p style={{ marginTop: 16, opacity: 0.85, lineHeight: 1.7, fontSize: 14 }}>
            By creating an account or using SiteSnap, you agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", boxShadow: "0 1px 4px rgba(15,43,70,0.08)" }}>
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the SiteSnap AI mobile application or supervisor web portal (together, the &quot;Service&quot;), you agree to these Terms of Service and our Privacy Policy. If you do not agree, you must not use the Service. These terms form a binding agreement between you and {LEGAL_ENTITY} (&quot;SiteSnap&quot;, &quot;we&quot;, &quot;us&quot;), a New Zealand company.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>SiteSnap is a construction site diary and project management platform that allows workers to log site entries, upload photos, and generate AI-assisted diary reports. Features include site diary logging, AI-generated summaries, supervisor review and approval workflows, and multi-format report export.</p>
          </Section>

          <Section title="3. Account Registration">
            <p>To use the Service you must register with a valid email address and mobile phone number. You agree to provide accurate information, keep your credentials secure, and notify us immediately at <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a> if you suspect unauthorised access. You are responsible for all activity under your account.</p>
          </Section>

          <Section title="4. Acceptable Use">
            <p style={{ marginBottom: 8 }}>You may use the Service only for lawful construction site management purposes. You must not:</p>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Upload illegal, defamatory, or rights-infringing content</li>
              <li>Store or transmit others&apos; personal information without consent</li>
              <li>Attempt unauthorised access to the Service or its infrastructure</li>
              <li>Reverse engineer or extract source code from the application</li>
              <li>Use automated scripts to scrape or bulk-download data</li>
              <li>Interfere with the availability or performance of the Service</li>
            </ul>
          </Section>

          <Section title="5. AI-Generated Content">
            <p>SiteSnap uses OpenAI to generate diary summaries and safety observations. AI-generated content is a draft aid only and must be reviewed by a qualified person before use in any official context. SiteSnap makes no warranty that AI-generated content is accurate or legally compliant. You remain solely responsible for the accuracy of any diary or report submitted under your account.</p>
          </Section>

          <Section title="6. Data Ownership">
            <p>You retain ownership of all content you submit. By using the Service, you grant SiteSnap a limited, non-exclusive licence to host and process your content solely to operate and improve the Service. We will not sell your content to third parties.</p>
          </Section>

          <Section title="7. Subscription and Payment">
            <p>SiteSnap may offer free and paid tiers. Subscriptions are billed in advance in New Zealand Dollars (NZD). Australian users may be billed in AUD where indicated at checkout. Refunds are provided at our discretion, subject to the New Zealand Consumer Guarantees Act 1993 and Fair Trading Act 1986, and for Australian users the Australian Consumer Law. We reserve the right to change pricing with 30 days&apos; notice.</p>
          </Section>

          <Section title="8. Health &amp; Safety Disclaimer">
            <p>SiteSnap is a record-keeping tool and is not a substitute for professional health and safety advice or compliance assessments. You must ensure all records comply with applicable legislation — primarily the New Zealand Health and Safety at Work Act 2015 (HSWA) and regulations made under it, and, for Australian users, the applicable state/territory Work Health and Safety Act and the Model WHS Act. AI-generated safety checklists do not constitute professional H&amp;S or WHS advice. SiteSnap accepts no liability for H&amp;S or WHS incidents, breaches, or fines arising from use of the Service.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, SiteSnap provides the Service &quot;as is&quot; without warranty. We are not liable for indirect, incidental, or consequential loss. Our total liability shall not exceed fees you paid in the preceding 12 months. Nothing in these Terms limits your rights under the New Zealand Consumer Guarantees Act 1993, Fair Trading Act 1986, or — for Australian users — the Australian Consumer Law.</p>
          </Section>

          <Section title="10. Termination">
            <p>You may terminate your account via Settings at any time. We may suspend or terminate your account immediately for breach of these Terms. Upon termination, your data is deleted in accordance with our Privacy Policy and legal retention obligations.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by the laws of New Zealand. Disputes shall be resolved in the courts of New Zealand. For users in Australia, mandatory consumer and privacy protections under Australian law apply and are not excluded by this clause.</p>
          </Section>

          <Section title="12. Changes">
            <p>We may update these Terms with 14 days&apos; notice via the app or email. Continued use constitutes acceptance.</p>
          </Section>

          <Section title="13. Contact">
            <p>{LEGAL_ENTITY} · <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a></p>
          </Section>

          <div style={{ marginTop: 32, padding: "16px 20px", background: "#F9FAFB", borderRadius: 10, fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
            <strong>Assumptions requiring verification before this document goes live:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Registered entity name is &quot;{LEGAL_ENTITY}&quot; — update LEGAL_ENTITY in this file once confirmed.</li>
              <li>Company is incorporated in New Zealand; NZ law governs.</li>
              <li>NZD is the primary billing currency; AUD offered to Australian users.</li>
              <li>The Consumer Guarantees Act and Fair Trading Act carve-outs are appropriate — this is a B2B tool, but those Acts can still apply; seek NZ legal advice.</li>
              <li>The 7-year HSWA record-keeping obligation applies to the project diary data stored in SiteSnap — verify with NZ legal counsel.</li>
              <li>No advertising and no sale of user data.</li>
              <li>support@getsitesnapai.com is the active contact.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
