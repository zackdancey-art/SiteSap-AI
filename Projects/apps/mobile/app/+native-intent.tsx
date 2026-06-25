export function redirectSystemPath({
  path,
  initial: _initial,
}: { path: string; initial: boolean }) {
  const rawPath = String(path || "");
  if (!rawPath) return "/";

  try {
    const normalized = rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("sitesnap://")
      ? rawPath
      : `sitesnap://${rawPath.replace(/^\/+/, "")}`;
    const url = new URL(normalized);

    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/^\/+/, "");
    const token = url.searchParams.get("token");

    const isReset =
      hostname === "reset-password" ||
      pathname === "reset-password";

    if (isReset) {
      if (token) {
        return `/reset-password?token=${encodeURIComponent(token)}`;
      }
      return "/reset-password";
    }

    const isInvite =
      hostname === "invite" ||
      pathname === "invite";

    if (isInvite) {
      if (token) {
        return `/invite?token=${encodeURIComponent(token)}`;
      }
      return "/invite";
    }
  } catch {
    // ignore malformed links and fall back home
  }

  return "/";
}
