import React, { createContext, useContext, useState, useEffect } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

type User = {
  email: string;
  name: string;
  role: "worker" | "supervisor" | "admin";
};

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  lastEmail: string;
  loading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const BASE_URL = resolveApiBaseUrl();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function inferNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "User";
  const words = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || "User";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("sitesnap.token");
        const userRaw = await AsyncStorage.getItem("sitesnap.user");
        const storedLastEmail = await AsyncStorage.getItem("sitesnap.lastEmail");
        if (storedLastEmail) {
          setLastEmail(storedLastEmail);
        }
        if (token && userRaw) {
          const parsed = JSON.parse(userRaw) as Partial<User>;
          const normalizedUser: User = {
            email: parsed.email || "",
            name: parsed.name || inferNameFromEmail(parsed.email || ""),
            role:
              parsed.role === "supervisor" || parsed.role === "admin" || parsed.role === "worker"
                ? parsed.role
                : "worker",
          };
          setToken(token);
          setUser(normalizedUser);
          setIsAuthenticated(true);
        }
      } catch (err: unknown) {
        console.error("Auth restore failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const url = `${BASE_URL}/api/auth/login`;
      console.log(`[auth] Login request URL: ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let message = `Login failed (${res.status})`;
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          const text = await res.text();
          if (text) {
            message = text;
          }
        }
        throw new Error(message);
      }

      const data = (await res.json()) as {
        token?: string;
        user?: { email?: string; name?: string; role?: "worker" | "supervisor" | "admin" };
      };
      if (!data.token) {
        throw new Error("No token in response");
      }

      await AsyncStorage.setItem("sitesnap.token", data.token);
      const userObj: User = {
        email: data.user?.email || email,
        name: data.user?.name || inferNameFromEmail(email),
        role: data.user?.role || "worker",
      };
      await AsyncStorage.setItem("sitesnap.user", JSON.stringify(userObj));
      await AsyncStorage.setItem("sitesnap.lastEmail", email);
      setToken(data.token);
      setLastEmail(email);
      setUser(userObj);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      // Network loss is expected in dev if API is offline; avoid red-box console errors.
      console.warn("Login failed:", err);
      if (message.includes("Network request failed")) {
        Alert.alert(
          "Network Error",
          `Unable to reach ${BASE_URL}. Please verify the backend is running and reachable from your device.`
        );
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("sitesnap.token");
      await AsyncStorage.removeItem("sitesnap.user");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (err: unknown) {
      console.warn("Logout failed:", err);
    }
  };

  const updateProfile = async (patch: Partial<User>) => {
    if (!user || !token) return;
    try {
      const url = `${BASE_URL}/api/auth/profile`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: patch.name, role: patch.role }),
      });

      if (!res.ok) {
        let message = `Profile update failed (${res.status})`;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = (await res.json()) as { error?: string; message?: string };
          message = payload.error || payload.message || message;
        } else {
          const text = await res.text();
          if (text.trim().toLowerCase().startsWith("<!doctype html")) {
            message = "API returned HTML instead of JSON. Check EXPO_PUBLIC_API_URL and backend port.";
          } else if (text) {
            message = text;
          }
        }
        throw new Error(message);
      }

      const payload = (await res.json()) as {
        token?: string;
        user?: { email?: string; name?: string; role?: "worker" | "supervisor" | "admin" };
      };
      const nextUser: User = {
        email: payload.user?.email || user.email,
        name: payload.user?.name || user.name,
        role: payload.user?.role || user.role,
      };
      if (payload.token) {
        await AsyncStorage.setItem("sitesnap.token", payload.token);
        setToken(payload.token);
      }
      setUser(nextUser);
      await AsyncStorage.setItem("sitesnap.user", JSON.stringify(nextUser));
    } catch (err: unknown) {
      console.warn("Profile update failed:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, lastEmail, loading, token, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
