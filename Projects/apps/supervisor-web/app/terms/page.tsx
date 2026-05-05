import Link from "next/link";

export const metadata = { title: "Terms of Service — SiteSnap AI" };

const LAST_UPDATED = "5 May 2026";

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
        <div style={{ background: "#0F2B46", borderRadius: 16, padding: "32px 40px", marginBottom: 32, color: "#fff" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ opacity: 0.7, fontSize: 13 }}>Last updated: {LAST_UPDATED}</p>
          <p style={{ marginTop: 16, opacity: 0.85, lineHeight: 1.7, fontSize: 14 }}>
            By creating an account or using SiteSnap, you agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", boxShadow: "0 1px 4px rgba(15,43,70,0.08)" }}>
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the SiteSnap AI mobile application or supervisor web portal (together, the "Service"), you agree to these Terms of Service and our Privacy Policy. If you do not agree, you must not use the Service. These terms form a binding agreement between you and SiteSnap AI Pty Ltd ("SiteSnap", "we", "us").</p>
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
              <li>Store or transmit others' personal information without consent</li>
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
            <p>SiteSnap may offer free and paid tiers. Subscriptions are billed in advance in Australian Dollars (AUD). Refunds are provided at our discretion in accordance with Australian Consumer Law. We reserve the right to change pricing with 30 days' notice.</p>
          </Section>

          <Section title="8. Work Health & Safety Disclaimer">
            <p>SiteSnap is a record-keeping tool and is not a substitute for professional WHS advice or compliance assessments. You must ensure all records comply with applicable Australian WHS legislation. AI-generated safety checklists do not constitute professional WHS advice. SiteSnap accepts no liability for WHS incidents or fines arising from use of the Service.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>To the maximum extent permitted by Australian law, SiteSnap provides the Service "as is" without warranty. We are not liable for indirect, incidental, or consequential loss. Our total liability shall not exceed fees you paid in the preceding 12 months. Nothing limits your rights under the Australian Consumer Law.</p>
          </Section>

          <Section title="10. Termination">
            <p>You may terminate your account via Settings at any time. We may suspend or terminate your account immediately for breach of these Terms. Upon termination, your data is deleted in accordance with our Privacy Policy and legal obligations.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by the laws of New South Wales, Australia. Disputes shall be resolved in the courts of New South Wales.</p>
          </Section>

          <Section title="12. Changes">
            <p>We may update these Terms with 14 days' notice via the app or email. Continued use constitutes acceptance.</p>
          </Section>

          <Section title="13. Contact">
            <p>SiteSnap AI Pty Ltd · <a href="mailto:support@getsitesnapai.com" style={{ color: "#E8731A" }}>support@getsitesnapai.com</a></p>
          </Section>
        </div>
      </div>
    </div>
  );
}
