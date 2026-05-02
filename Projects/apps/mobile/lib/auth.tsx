import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

type AuthState = {
  token: string | null;
  loading: boolean;
  signInDev: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);
const TOKEN_KEY = "sitesnap.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(TOKEN_KEY);
        setToken(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signOut = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  const signInDev = async () => {
    const base = resolveApiBaseUrl();
    const url = `${base}/api/auth/login`;
    console.log(`[auth] signInDev request URL: ${url}`);

    let res: Response;
    try {
      res = await fetch(url, { method: "POST" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error calling ${url}: ${message}`);
    }

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}: ${text}`);
    }

    let data: { ok: boolean; token: string };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Bad JSON from ${url}: ${text}`);
    }

    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
  };

  return (
    <AuthContext.Provider value={{ token, loading, signInDev, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
