"use client";

type Props = {
  subject: string;
  body: string;
  onClose: () => void;
};

const SERVICES = [
  {
    name: "Gmail",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M2 6.5C2 5.4 2.9 4.5 4 4.5H20C21.1 4.5 22 5.4 22 6.5V17.5C22 18.6 21.1 19.5 20 19.5H4C2.9 19.5 2 18.6 2 17.5V6.5Z" fill="#EA4335" fillOpacity="0.12" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M2 7L12 13L22 7" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    color: "#EA4335",
    getUrl: (subject: string, body: string) =>
      `https://mail.google.com/mail/?view=cm&to=&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Outlook",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4.5" width="20" height="15" rx="2" fill="#0078D4" fillOpacity="0.1" stroke="#0078D4" strokeWidth="1.5"/>
        <path d="M2 7.5L12 13L22 7.5" stroke="#0078D4" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    color: "#0078D4",
    getUrl: (subject: string, body: string) =>
      `https://outlook.live.com/mail/0/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Yahoo Mail",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4.5" width="20" height="15" rx="2" fill="#6001D2" fillOpacity="0.1" stroke="#6001D2" strokeWidth="1.5"/>
        <path d="M2 7.5L12 13L22 7.5" stroke="#6001D2" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    color: "#6001D2",
    getUrl: (subject: string, body: string) =>
      `https://compose.mail.yahoo.com/?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Apple Mail",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4.5" width="20" height="15" rx="2" fill="#1C8EF9" fillOpacity="0.1" stroke="#1C8EF9" strokeWidth="1.5"/>
        <path d="M2 7.5L12 13L22 7.5" stroke="#1C8EF9" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    color: "#1C8EF9",
    getUrl: (subject: string, body: string) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
];

export default function EmailServicePicker({ subject, body, onClose }: Props) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = `${subject}\n\n${body}`;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    onClose();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,43,70,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(15,43,70,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Send via Email</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Choose your email app</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--surface-secondary)", border: "none", borderRadius: 8, width: 30, height: 30, fontSize: 16, cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SERVICES.map((svc) => (
            <a
              key={svc.name}
              href={svc.getUrl(subject, body)}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 16px", borderRadius: 10,
                border: "1.5px solid var(--border)", textDecoration: "none",
                background: "#fff", cursor: "pointer",
                transition: "border-color 0.12s, background 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = svc.color; (e.currentTarget as HTMLAnchorElement).style.background = "#FAFBFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.background = "#fff"; }}
            >
              {svc.icon}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{svc.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>→</span>
            </a>
          ))}

          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 16px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--surface-secondary)",
              cursor: "pointer", marginTop: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>📋</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Copy to clipboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
