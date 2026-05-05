const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export type User = { email: string; name: string; role: string };
export type Site = { id: string; name: string; client: string; address: string; status: string; startDate?: string };
export type Entry = { id: string; siteId: string; date: string; notes: string; weather?: string; crewCount?: string };
export type DiarySection = {
  date?: string; weather?: string; crewCount?: string;
  workCompleted?: string; safetyObservations?: string;
  materialsUsed?: string; issues?: string; photoAnalysis?: string;
};

export type Diary = {
  id: string; siteId: string; status: string; generatedAt: string;
  reportPeriod?: string; summary?: string;
  fullReport?: string; sections?: DiarySection[];
  safetyChecklist?: string[];
  signedBy?: string; signedAt?: string;
};

export interface BootstrapData {
  sites: Site[];
  entries: Entry[];
  diaries: Diary[];
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sitesnap.token");
}

export function saveToken(token: string) {
  localStorage.setItem("sitesnap.token", token);
}

export function clearToken() {
  localStorage.removeItem("sitesnap.token");
  localStorage.removeItem("sitesnap.user");
}

export function getSavedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sitesnap.user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

export function saveUser(user: User) {
  localStorage.setItem("sitesnap.user", JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>("POST", "/api/auth/login", { email, password });
  saveToken(data.token);
  saveUser(data.user);
  return data;
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  return request<BootstrapData>("GET", "/api/projects/bootstrap");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<{ ok: boolean }>("POST", "/api/auth/change-password", { currentPassword, newPassword });
}

export async function revokeAllSessions(): Promise<string> {
  const data = await request<{ token: string }>("POST", "/api/auth/revoke-all");
  saveToken(data.token);
  return data.token;
}

export async function forgotPassword(identifier: string): Promise<void> {
  await request<{ ok: boolean }>("POST", "/api/auth/forgot-password", { identifier, channel: "email" });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await request<{ ok: boolean }>("POST", "/api/auth/reset-password", { token, newPassword });
}

export async function logout() {
  clearToken();
}
