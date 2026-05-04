"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSavedUser, isAuthenticated, clearToken } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const user = getSavedUser();
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/"); return; }
    const stored = localStorage.getItem("sitesnap.apiUrl");
    if (stored) setApiUrl(stored);
  }, [router]);

  const handleSaveApi = () => {
    localStorage.setItem("sitesnap.apiUrl", apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    clearToken();
    router.replace("/");
  };

  return (
    <div className="app-shell">
      <Sidebar userName={user?.name ?? user?.email ?? "Supervisor"} />

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">Settings</div>
          <div className="topbar-user">
            <div className="topbar-avatar">{(user?.name?.[0] ?? "S").toUpperCase()}</div>
          </div>
        </div>

        <div className="page-body">
          {/* Profile */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 16 }}>👤</span>
              <span className="card-title">Profile</span>
            </div>
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Name</div>
                  <div className="settings-sub">Your display name</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{user?.name ?? "—"}</div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Email</div>
                  <div className="settings-sub">Your account email</div>
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{user?.email ?? "—"}</div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Role</div>
                  <div className="settings-sub">Account permissions level</div>
                </div>
                <span className="badge" style={{ background: "#FFF7ED", color: "#E8731A" }}>
                  {user?.role?.toUpperCase() ?? "SUPERVISOR"}
                </span>
              </div>
            </div>
          </div>

          {/* API config */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 16 }}>🔌</span>
              <span className="card-title">API Connection</span>
            </div>
            <div style={{ padding: "20px" }}>
              <label className="field-label" htmlFor="apiUrl">API Base URL</label>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <input
                  id="apiUrl"
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://192.168.x.x:4001"
                  style={{ flex: 1 }}
                />
                <button className="btn-primary" onClick={handleSaveApi} style={{ whiteSpace: "nowrap" }}>
                  {saved ? "✓ Saved" : "Save"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
                Set in <code>.env.local</code> as <code>NEXT_PUBLIC_API_URL</code> for permanent configuration.
              </p>
            </div>
          </div>

          {/* About */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 16 }}>ℹ️</span>
              <span className="card-title">About</span>
            </div>
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Application</div>
                  <div className="settings-sub">SiteSnap AI Supervisor Portal</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>v0.1.0</div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Support</div>
                  <div className="settings-sub">For technical issues and account support</div>
                </div>
                <a href="mailto:support@getsitesnapai.com" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                  support@getsitesnapai.com
                </a>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <button className="btn-ghost" onClick={handleLogout} style={{ width: "fit-content", color: "var(--error)", borderColor: "#FCA5A5" }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
