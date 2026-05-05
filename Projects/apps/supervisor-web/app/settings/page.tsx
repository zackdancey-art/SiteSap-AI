"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSavedUser, isAuthenticated, clearToken, changePassword, revokeAllSessions } from "@/lib/api";

type NotifPrefs = {
  weeklyDigest: boolean;
  approvalAlerts: boolean;
  newEntryAlerts: boolean;
  incidentAlerts: boolean;
};

type AppPrefs = {
  dateFormat: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
  timezone: string;
  defaultPeriod: "daily" | "weekly" | "monthly";
};

const TIMEZONES = [
  "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
  "Australia/Perth", "Australia/Adelaide", "Australia/Darwin",
  "Australia/Hobart", "Pacific/Auckland", "Asia/Singapore",
  "America/New_York", "America/Los_Angeles", "Europe/London",
];

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span className="card-title">{title}</span>
      </div>
      <div className="settings-section">{children}</div>
    </div>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div style={{ flex: 1 }}>
        <div className="settings-label">{label}</div>
        {sub && <div className="settings-sub">{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        background: checked ? "var(--accent)" : "var(--border)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const user = getSavedUser();

  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL ?? "");
  const [apiSaved, setApiSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  const [notifs, setNotifs] = useState<NotifPrefs>({
    weeklyDigest: true, approvalAlerts: true, newEntryAlerts: false, incidentAlerts: true,
  });

  const [appPrefs, setAppPrefs] = useState<AppPrefs>({
    dateFormat: "dd/mm/yyyy", timezone: "Australia/Sydney", defaultPeriod: "weekly",
  });

  const [orgName, setOrgName] = useState("");
  const [orgSaved, setOrgSaved] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  const [showPwForm, setShowPwForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/"); return; }
    const stored = localStorage.getItem("sitesnap.apiUrl");
    if (stored) setApiUrl(stored);
    const storedNotifs = localStorage.getItem("sitesnap.notifPrefs");
    if (storedNotifs) { try { setNotifs(JSON.parse(storedNotifs) as NotifPrefs); } catch { /* */ } }
    const storedPrefs = localStorage.getItem("sitesnap.appPrefs");
    if (storedPrefs) { try { setAppPrefs(JSON.parse(storedPrefs) as AppPrefs); } catch { /* */ } }
    const storedOrg = localStorage.getItem("sitesnap.orgName");
    if (storedOrg) setOrgName(storedOrg);
  }, [router]);

  const saveApiUrl = async () => {
    localStorage.setItem("sitesnap.apiUrl", apiUrl);
    setApiSaved(true);
    setApiStatus("checking");
    try {
      const res = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(4000) });
      setApiStatus(res.ok ? "ok" : "error");
    } catch { setApiStatus("error"); }
    setTimeout(() => setApiSaved(false), 2500);
  };

  const updateNotif = (key: keyof NotifPrefs, val: boolean) => {
    const next = { ...notifs, [key]: val };
    setNotifs(next);
    localStorage.setItem("sitesnap.notifPrefs", JSON.stringify(next));
  };

  const updateAppPref = <K extends keyof AppPrefs>(key: K, val: AppPrefs[K]) => {
    const next = { ...appPrefs, [key]: val };
    setAppPrefs(next);
    localStorage.setItem("sitesnap.appPrefs", JSON.stringify(next));
  };

  const saveOrg = () => {
    localStorage.setItem("sitesnap.orgName", orgName);
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2000);
  };

  const handleSignOut = () => { clearToken(); router.replace("/"); };

  const handleSignOutAll = async () => {
    if (!confirm("This will sign out all other devices. Your current session will remain active. Continue?")) return;
    try {
      await revokeAllSessions();
      alert("All other sessions have been signed out.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to revoke sessions. Please try again.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (pwNew.length < 12) { setPwError("New password must be at least 12 characters."); return; }
    if (pwNew !== pwConfirm) { setPwError("Passwords do not match."); return; }
    setPwLoading(true);
    try {
      await changePassword(pwCurrent, pwNew);
      setPwSuccess(true);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setTimeout(() => { setPwSuccess(false); setShowPwForm(false); }, 3000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleExportData = () => {
    const user = getSavedUser();
    const blob = new Blob([JSON.stringify({ user, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitesnap-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = { height: 38, fontSize: 14, borderRadius: 10 };
  const selectStyle = { ...inputStyle, paddingRight: 32, cursor: "pointer" };

  return (
    <div className="app-shell">
      <Sidebar userName={user?.name ?? user?.email ?? "Supervisor"} />
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">Settings</div>
          <div className="topbar-user">
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user?.email}</span>
            <div className="topbar-avatar">{(user?.name?.[0] ?? "S").toUpperCase()}</div>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: 760 }}>

          {/* ── Account ── */}
          <Section icon="👤" title="Account">
            <SettingRow label="Full name" sub="How your name appears in reports and exports">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{user?.name ?? "—"}</span>
            </SettingRow>
            <SettingRow label="Email address" sub="Your login and notification email">
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{user?.email ?? "—"}</span>
            </SettingRow>
            <SettingRow label="Role" sub="Determines what you can view and export">
              <span className="badge" style={{ background: "#FFF7ED", color: "#E8731A" }}>
                {user?.role?.toUpperCase() ?? "SUPERVISOR"}
              </span>
            </SettingRow>
            <SettingRow label="Password" sub="Change your account password">
              <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px" }}
                onClick={() => { setShowPwForm((v) => !v); setPwError(""); setPwSuccess(false); }}>
                {showPwForm ? "Cancel" : "Change password"}
              </button>
            </SettingRow>
            {showPwForm && (
              <form onSubmit={handleChangePassword} style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pwError && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>{pwError}</div>}
                {pwSuccess && <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>Password changed successfully.</div>}
                <div>
                  <label className="field-label">Current password</label>
                  <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)}
                    autoComplete="current-password" required style={{ height: 38, fontSize: 14, borderRadius: 10 }} />
                </div>
                <div>
                  <label className="field-label">New password <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(min 12 characters)</span></label>
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password" required style={{ height: 38, fontSize: 14, borderRadius: 10 }} />
                </div>
                <div>
                  <label className="field-label">Confirm new password</label>
                  <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)}
                    autoComplete="new-password" required style={{ height: 38, fontSize: 14, borderRadius: 10 }} />
                </div>
                <button type="submit" className="btn-primary" style={{ alignSelf: "flex-start", padding: "8px 20px" }} disabled={pwLoading}>
                  {pwLoading ? "Saving…" : "Update password"}
                </button>
              </form>
            )}
          </Section>

          {/* ── Organisation ── */}
          <Section icon="🏢" title="Organisation">
            <div style={{ padding: "14px 20px" }}>
              <label className="field-label" htmlFor="orgName">Organisation name</label>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 8px" }}>
                Shown on exported reports and diary headers.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Construction Pty Ltd" style={{ flex: 1, ...inputStyle }} />
                <button className="btn-primary" onClick={saveOrg} style={{ whiteSpace: "nowrap", padding: "0 16px" }}>
                  {orgSaved ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>
          </Section>

          {/* ── Notifications ── */}
          <Section icon="🔔" title="Notifications">
            <SettingRow label="Weekly digest" sub="Receive a summary of site activity every Monday">
              <Toggle checked={notifs.weeklyDigest} onChange={(v) => updateNotif("weeklyDigest", v)} />
            </SettingRow>
            <SettingRow label="Diary approval alerts" sub="Notify when a diary is approved or rejected">
              <Toggle checked={notifs.approvalAlerts} onChange={(v) => updateNotif("approvalAlerts", v)} />
            </SettingRow>
            <SettingRow label="New entry alerts" sub="Notify when a worker submits a new site entry">
              <Toggle checked={notifs.newEntryAlerts} onChange={(v) => updateNotif("newEntryAlerts", v)} />
            </SettingRow>
            <SettingRow label="Incident alerts" sub="Immediate notification when an incident is logged">
              <Toggle checked={notifs.incidentAlerts} onChange={(v) => updateNotif("incidentAlerts", v)} />
            </SettingRow>
          </Section>

          {/* ── Display Preferences ── */}
          <Section icon="🎨" title="Display Preferences">
            <SettingRow label="Date format" sub="How dates appear in reports and tables">
              <select value={appPrefs.dateFormat} onChange={(e) => updateAppPref("dateFormat", e.target.value as AppPrefs["dateFormat"])}
                style={{ ...selectStyle, width: 160 }}>
                <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                <option value="yyyy-mm-dd">YYYY-MM-DD</option>
              </select>
            </SettingRow>
            <SettingRow label="Timezone" sub="Used for report timestamps and scheduling">
              <select value={appPrefs.timezone} onChange={(e) => updateAppPref("timezone", e.target.value)}
                style={{ ...selectStyle, width: 200 }}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="Default report period" sub="Pre-selected period when generating diary reports">
              <select value={appPrefs.defaultPeriod} onChange={(e) => updateAppPref("defaultPeriod", e.target.value as AppPrefs["defaultPeriod"])}
                style={{ ...selectStyle, width: 140 }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </SettingRow>
          </Section>

          {/* ── API Connection ── */}
          <Section icon="🔌" title="API Connection">
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="field-label" htmlFor="apiUrl">API Base URL</label>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 8px" }}>
                  The backend server address. Set <code>NEXT_PUBLIC_API_URL</code> in <code>.env.local</code> for permanent configuration.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <input id="apiUrl" type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="http://192.168.x.x:4001" style={{ flex: 1, ...inputStyle }} />
                  <button className="btn-primary" onClick={saveApiUrl} style={{ whiteSpace: "nowrap", padding: "0 16px" }}>
                    {apiSaved ? "✓ Saved" : "Save & Test"}
                  </button>
                </div>
              </div>
              {apiStatus !== "idle" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                  color: apiStatus === "ok" ? "#22C55E" : apiStatus === "error" ? "var(--error)" : "var(--text-secondary)",
                  background: apiStatus === "ok" ? "#F0FDF4" : apiStatus === "error" ? "#FEF2F2" : "var(--surface-secondary)",
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  {apiStatus === "checking" && "⏳ Checking connection…"}
                  {apiStatus === "ok"       && "✓ Connected — API is reachable"}
                  {apiStatus === "error"    && "✗ Cannot reach API — check the URL and that the server is running"}
                </div>
              )}
            </div>
          </Section>

          {/* ── Data & Privacy ── */}
          <Section icon="🔒" title="Data & Privacy">
            <SettingRow label="Export my data" sub="Download a JSON copy of your account data">
              <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px" }} onClick={handleExportData}>
                Export
              </button>
            </SettingRow>
            <SettingRow label="Privacy Policy" sub="How SiteSnap handles your data">
              <a href="/privacy" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>View →</a>
            </SettingRow>
            <SettingRow label="Terms of Service" sub="Usage terms and conditions">
              <a href="/terms" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>View →</a>
            </SettingRow>
            <SettingRow label="Data retention" sub="Site diary entries and diaries are retained for 7 years in compliance with Australian WHS record-keeping requirements">
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 140, textAlign: "right" }}>7 years</span>
            </SettingRow>
          </Section>

          {/* ── About ── */}
          <Section icon="ℹ️" title="About">
            <SettingRow label="Application" sub="SiteSnap AI Supervisor Portal">
              <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>v0.1.0</span>
            </SettingRow>
            <SettingRow label="Platform" sub="Next.js 14 · TypeScript">
              <span style={{ fontSize: 12, background: "var(--surface-secondary)", padding: "3px 10px", borderRadius: 8, color: "var(--text-secondary)" }}>Web</span>
            </SettingRow>
            <SettingRow label="Support" sub="Technical support and account queries">
              <a href="mailto:support@getsitesnapai.com" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                support@getsitesnapai.com
              </a>
            </SettingRow>
            <SettingRow label="Documentation" sub="Setup guides and API reference">
              <a href="#" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>Docs →</a>
            </SettingRow>
          </Section>

          {/* ── Session ── */}
          <Section icon="🛡️" title="Security & Sessions">
            <SettingRow label="Current session" sub="You are currently signed in on this device">
              <span className="badge" style={{ background: "#F0FDF4", color: "#22C55E" }}>Active</span>
            </SettingRow>
            <SettingRow label="Sign out" sub="End your session on this device">
              <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px" }} onClick={handleSignOut}>
                Sign Out
              </button>
            </SettingRow>
            <SettingRow label="Sign out all devices" sub="Revoke all active sessions">
              <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px", color: "var(--error)", borderColor: "#FCA5A5" }} onClick={handleSignOutAll}>
                Sign Out All
              </button>
            </SettingRow>
          </Section>

          {/* ── Danger Zone ── */}
          <div style={{
            border: "1.5px solid #FCA5A5", borderRadius: "var(--radius)",
            overflow: "hidden", background: "#FFF5F5",
          }}>
            <button
              onClick={() => setShowDanger(!showDanger)}
              style={{
                width: "100%", padding: "14px 20px", background: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700,
                color: "var(--error)", border: "none",
              }}
            >
              <span>⚠️</span> Danger Zone
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--error)" }}>
                {showDanger ? "▲ Collapse" : "▼ Expand"}
              </span>
            </button>
            {showDanger && (
              <div className="settings-section" style={{ borderTop: "1px solid #FCA5A5" }}>
                <SettingRow label="Delete all site data" sub="Permanently removes all sites, entries, and diaries. Cannot be undone.">
                  <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px", color: "var(--error)", borderColor: "#FCA5A5" }}
                    onClick={() => alert("Contact support@getsitesnapai.com to request data deletion.")}>
                    Delete data
                  </button>
                </SettingRow>
                <SettingRow label="Close account" sub="Permanently delete your account and all associated data">
                  <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px", color: "var(--error)", borderColor: "#FCA5A5" }}
                    onClick={() => alert("Contact support@getsitesnapai.com to close your account.")}>
                    Close account
                  </button>
                </SettingRow>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
