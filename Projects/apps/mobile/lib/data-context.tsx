import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Site, Entry, GeneratedDiary } from "@/lib/types";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useAuth, isTokenExpiringSoon } from "@/lib/auth-context";
import {
  deletePhotoPayloads,
  hydrateEntriesWithPhotoPayloads,
  savePhotoPayloads,
  stripPhotoPayloads,
} from "@/lib/photo-payload-store";

interface DataContextType {
  sites: Site[];
  entries: Entry[];
  diaries: GeneratedDiary[];
  syncStatus: "idle" | "syncing" | "offline" | "error";
  lastSyncError: string | null;
  addSite: (site: Omit<Site, "id" | "createdAt">) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
  addEntry: (entry: Omit<Entry, "id" | "timestamp" | "createdAt">) => Promise<void>;
  updateEntry: (id: string, patch: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addDiary: (diary: Omit<GeneratedDiary, "id" | "generatedAt">) => GeneratedDiary;
  updateDiary: (id: string, patch: Partial<GeneratedDiary>) => void;
  getSite: (id?: string) => Site | undefined;
  getEntry: (id?: string) => Entry | undefined;
  getSiteEntries: (siteId?: string) => Entry[];
  getSiteDiaries: (siteId?: string) => GeneratedDiary[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);
const SITES_KEY = "sitesnap.sites";
const ENTRIES_KEY = "sitesnap.entries";
const DIARIES_KEY = "sitesnap.diaries";
const BASE_URL = resolveApiBaseUrl();

function normalizeEmailKey(email?: string | null) {
  return (email || "anonymous").trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, "_");
}

function getCacheKeys(email?: string | null) {
  const scope = normalizeEmailKey(email);
  return {
    sites: `${SITES_KEY}:${scope}`,
    entries: `${ENTRIES_KEY}:${scope}`,
    diaries: `${DIARIES_KEY}:${scope}`,
  };
}

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function getToken() {
  return AsyncStorage.getItem("sitesnap.token");
}

// Holds a reference to the auth context's refreshToken so apiJson can call it without prop-drilling
let _refreshTokenFn: (() => Promise<string | null>) | null = null;
export function _setRefreshTokenFn(fn: () => Promise<string | null>) {
  _refreshTokenFn = fn;
}

async function doFetch<T>(path: string, init: RequestInit | undefined, token: string | null): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error("Unauthorized") as Error & { status: number };
      err.status = 401;
      throw err;
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as { error?: string; message?: string };
      throw new Error(payload.error || payload.message || `Request failed (${res.status})`);
    }
    const text = await res.text();
    if (text.trim().toLowerCase().startsWith("<!doctype html")) {
      throw new Error("API returned HTML instead of JSON. Check EXPO_PUBLIC_API_URL and backend port.");
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  const okContentType = res.headers.get("content-type") || "";
  if (!okContentType.includes("application/json")) {
    const text = await res.text();
    if (text.trim().toLowerCase().startsWith("<!doctype html")) {
      throw new Error("API returned HTML instead of JSON. Check EXPO_PUBLIC_API_URL and backend port.");
    }
    throw new Error("Unexpected response type from API.");
  }
  return res.json() as Promise<T>;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let token = await getToken();

  // Proactively refresh if the token expires within 1 hour
  if (token && isTokenExpiringSoon(token) && _refreshTokenFn) {
    const refreshed = await _refreshTokenFn();
    if (refreshed) token = refreshed;
  }

  try {
    return await doFetch<T>(path, init, token);
  } catch (err) {
    // On 401, attempt one token refresh then retry
    if (err instanceof Error && (err as Error & { status?: number }).status === 401 && _refreshTokenFn) {
      const refreshed = await _refreshTokenFn();
      if (refreshed) return doFetch<T>(path, init, refreshed);
    }
    throw err;
  }
}

async function uploadPhoto(photo: Entry["photos"][number]) {
  if (/^https?:\/\//i.test(photo.uri)) {
    return photo;
  }

  const token = await getToken();
  if (!token) {
    throw new Error("Authentication is required to upload photos.");
  }
  const form = new FormData();
  form.append("file", {
    uri: photo.uri,
    type: photo.mimeType || "image/jpeg",
    name: `${photo.id || Date.now()}.jpg`,
  } as unknown as Blob);

  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Photo upload failed (${res.status})`);
  }

  const payload = (await res.json()) as { url?: string; storagePath?: string; storageKey?: string };
  // Store the canonical path only — tokens are never embedded in URIs
  const canonicalPath = payload.url?.startsWith("/") ? payload.url : (payload.url || "");

  return {
    ...photo,
    uri: canonicalPath,
    storagePath: payload.storagePath,
    storageKey: payload.storageKey,
  };
}

async function uploadPhotos(photos: Entry["photos"]) {
  return Promise.all(photos.map((photo) => uploadPhoto(photo)));
}

async function persistCache(email: string | null | undefined, sites: Site[], entries: Entry[], diaries: GeneratedDiary[]) {
  const keys = getCacheKeys(email);
  await Promise.all([
    AsyncStorage.setItem(keys.sites, JSON.stringify(sites)),
    AsyncStorage.setItem(keys.entries, JSON.stringify(entries.map((entry) => stripPhotoPayloads(entry)))),
    AsyncStorage.setItem(keys.diaries, JSON.stringify(diaries)),
  ]);
}


async function loadCache(email: string | null | undefined) {
  const keys = getCacheKeys(email);
  const [sitesRaw, entriesRaw, diariesRaw] = await Promise.all([
    AsyncStorage.getItem(keys.sites),
    AsyncStorage.getItem(keys.entries),
    AsyncStorage.getItem(keys.diaries),
  ]);

  const sites = safeParseArray<Site>(sitesRaw);
  const entries = await hydrateEntriesWithPhotoPayloads(safeParseArray<Entry>(entriesRaw));
  const diaries = safeParseArray<GeneratedDiary>(diariesRaw);

  if (sites.length > 0 || entries.length > 0 || diaries.length > 0) {
    return { sites, entries, diaries };
  }

  const [legacySitesRaw, legacyEntriesRaw, legacyDiariesRaw] = await Promise.all([
    AsyncStorage.getItem(SITES_KEY),
    AsyncStorage.getItem(ENTRIES_KEY),
    AsyncStorage.getItem(DIARIES_KEY),
  ]);
  const legacySites = safeParseArray<Site>(legacySitesRaw);
  const legacyEntries = await hydrateEntriesWithPhotoPayloads(safeParseArray<Entry>(legacyEntriesRaw));
  const legacyDiaries = safeParseArray<GeneratedDiary>(legacyDiariesRaw);
  if (legacySites.length > 0 || legacyEntries.length > 0 || legacyDiaries.length > 0) {
    await persistCache(email, legacySites, legacyEntries, legacyDiaries);
  }
  return { sites: legacySites, entries: legacyEntries, diaries: legacyDiaries };
}

// Module-level signed URL cache keyed by canonical path
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_CACHE_TTL_MS = 90 * 60 * 1000; // 90 min — well under 2-hr server TTL

function toCanonicalPath(uri: string): string | null {
  // Strip legacy ?authToken= or ?sig= query params to recover the canonical path
  const cleaned = uri.replace(/[?&](authToken|sig|exp)=[^&]*/g, "").replace(/[?&]$/, "");
  // Accept absolute URLs pointing to our API or relative /api/uploads/ paths
  const match = cleaned.match(/(\/api\/uploads\/[^?#]+)/);
  return match ? match[1] : null;
}

async function batchSignPaths(paths: string[], token: string): Promise<void> {
  if (paths.length === 0) return;
  try {
    const res = await fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { signed: { path: string; url: string | null }[] };
    const expiresAt = Date.now() + SIGNED_URL_CACHE_TTL_MS;
    for (const item of data.signed) {
      if (item.url) signedUrlCache.set(item.path, { url: item.url, expiresAt });
    }
  } catch {
    // Signing failure is non-fatal — photos just won't display
  }
}

async function attachSignedPhotoUris(entries: Entry[], token: string | null): Promise<Entry[]> {
  if (!token || entries.length === 0) return entries;
  const now = Date.now();

  // Collect canonical paths that need (re-)signing
  const toSign: string[] = [];
  for (const entry of entries) {
    for (const photo of entry.photos) {
      if (!photo.uri) continue;
      const canonical = toCanonicalPath(photo.uri);
      if (!canonical) continue;
      const cached = signedUrlCache.get(canonical);
      if (!cached || cached.expiresAt <= now) toSign.push(canonical);
    }
  }
  // Deduplicate
  const unique = [...new Set(toSign)];
  // Batch in groups of 50 (server limit)
  for (let i = 0; i < unique.length; i += 50) {
    await batchSignPaths(unique.slice(i, i + 50), token);
  }

  return entries.map((entry) => ({
    ...entry,
    photos: entry.photos.map((photo) => {
      if (!photo.uri) return photo;
      const canonical = toCanonicalPath(photo.uri);
      if (!canonical) return photo;
      const cached = signedUrlCache.get(canonical);
      return cached ? { ...photo, uri: cached.url } : photo;
    }),
  }));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading, user, token, refreshToken } = useAuth();

  // Keep the module-level refresh fn in sync with the current context instance
  React.useEffect(() => {
    _setRefreshTokenFn(refreshToken);
  }, [refreshToken]);
  const [sites, setSites] = useState<Site[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [diaries, setDiaries] = useState<GeneratedDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "offline" | "error">("idle");
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refresh = async () => {
    const userEmail = user?.email ?? null;
    const cachedBase = await loadCache(userEmail);
    const cached = { ...cachedBase, entries: await attachSignedPhotoUris(cachedBase.entries, token) };
    setSites(cached.sites);
    setEntries(cached.entries);
    setDiaries(cached.diaries);

    if (!isAuthenticated) {
      setSyncStatus("offline");
      return;
    }

    try {
      setSyncStatus("syncing");
      setLastSyncError(null);
      const bootstrap = await apiJson<{ sites: Site[]; entries: Entry[]; diaries: GeneratedDiary[] }>("/projects/bootstrap");
      const hydratedEntries = await attachSignedPhotoUris(
        await hydrateEntriesWithPhotoPayloads(bootstrap.entries),
        token
      );
      // Server is authoritative after a successful sync — no local merge
      setSites(bootstrap.sites);
      setEntries(hydratedEntries);
      setDiaries(bootstrap.diaries);
      await persistCache(userEmail, bootstrap.sites, hydratedEntries, bootstrap.diaries);
      setSyncStatus("idle");
    } catch (err) {
      console.warn("Remote bootstrap failed, using cache:", err);
      setSites(cached.sites);
      setEntries(cached.entries);
      setDiaries(cached.diaries);
      setLastSyncError(err instanceof Error ? err.message : String(err));
      setSyncStatus(cached.sites.length > 0 || cached.entries.length > 0 || cached.diaries.length > 0 ? "offline" : "error");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, isAuthenticated, user?.email, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      loadCache(user?.email ?? null)
        .then((cached) => {
          setSites(cached.sites);
          setEntries(cached.entries);
          setDiaries(cached.diaries);
        })
        .catch((error) => console.warn("cache restore on logout failed", error));
    }
  }, [authLoading, isAuthenticated, user?.email, token]);

  const addSite = async (siteData: Omit<Site, "id" | "createdAt">) => {
    const response = await apiJson<{ site: Site }>("/projects/sites", {
      method: "POST",
      body: JSON.stringify(siteData),
    });
    const updated = [response.site, ...sites];
    setSites(updated);
    await persistCache(user?.email, updated, entries, diaries);
  };

  const deleteSite = async (id: string) => {
    await apiJson<{ ok: boolean }>(`/projects/sites/${id}`, { method: "DELETE" });
    const updatedSites = sites.filter((s) => s.id !== id);
    const updatedEntries = entries.filter((e) => e.siteId !== id);
    const updatedDiaries = diaries.filter((d) => d.siteId !== id);
    setSites(updatedSites);
    setEntries(updatedEntries);
    setDiaries(updatedDiaries);
    await persistCache(user?.email, updatedSites, updatedEntries, updatedDiaries);
  };

  const addEntry = async (entryData: Omit<Entry, "id" | "timestamp" | "createdAt">) => {
    const uploadedPhotos = await uploadPhotos(entryData.photos);
    await savePhotoPayloads(uploadedPhotos);
    const response = await apiJson<{ entry: Entry }>("/projects/entries", {
      method: "POST",
      body: JSON.stringify(stripPhotoPayloads({ ...entryData, photos: uploadedPhotos } as Entry)),
    });
    const [hydratedEntry] = await hydrateEntriesWithPhotoPayloads([response.entry]);
    const updated = [hydratedEntry, ...entries];
    setEntries(updated);
    await persistCache(user?.email, sites, updated, diaries);
  };

  const deleteEntry = async (id: string) => {
    const existing = entries.find((entry) => entry.id === id);
    await apiJson<{ ok: boolean }>(`/projects/entries/${id}`, { method: "DELETE" });
    const updated = entries.filter((e) => e.id !== id);
    if (existing) {
      await deletePhotoPayloads(existing.photos.map((photo) => photo.id));
    }
    setEntries(updated);
    await persistCache(user?.email, sites, updated, diaries);
  };

  const updateEntry = async (id: string, patch: Partial<Entry>) => {
    const existing = entries.find((entry) => entry.id === id);
    if (patch.photos) {
      const uploadedPhotos = await uploadPhotos(patch.photos);
      patch = { ...patch, photos: uploadedPhotos };
      await savePhotoPayloads(uploadedPhotos);
      if (existing) {
        const nextIds = new Set(uploadedPhotos.map((photo) => photo.id));
        const removedIds = existing.photos.filter((photo) => !nextIds.has(photo.id)).map((photo) => photo.id);
        await deletePhotoPayloads(removedIds);
      }
    }
    const response = await apiJson<{ entry: Entry }>(`/projects/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(
        patch.photos
          ? {
              ...patch,
              photos: stripPhotoPayloads({ photos: patch.photos } as Entry).photos,
            }
          : patch
      ),
    });
    const [hydratedEntry] = await hydrateEntriesWithPhotoPayloads([response.entry]);
    const updated = entries.map((e) => (e.id === id ? hydratedEntry : e));
    setEntries(updated);
    await persistCache(user?.email, sites, updated, diaries);
  };

  const addDiary = (diaryData: Omit<GeneratedDiary, "id" | "generatedAt">) => {
    const optimisticDiary: GeneratedDiary = {
      ...diaryData,
      id: Date.now().toString(),
      generatedAt: new Date().toISOString(),
    };
    setDiaries((prev) => {
      const next = [optimisticDiary, ...prev];
      void persistCache(user?.email, sites, entries, next);
      return next;
    });
    apiJson<{ diary: GeneratedDiary }>("/projects/diaries", {
      method: "POST",
      body: JSON.stringify(diaryData),
    })
      .then(({ diary }) => {
        setDiaries((prev) => {
          const next = [diary, ...prev.filter((d) => d.id !== optimisticDiary.id)];
          void persistCache(user?.email, sites, entries, next);
          return next;
        });
      })
      .catch((error) => {
        console.warn("save diary failed, rolling back optimistic entry", error);
        setDiaries((prev) => {
          const next = prev.filter((d) => d.id !== optimisticDiary.id);
          void persistCache(user?.email, sites, entries, next);
          return next;
        });
      });
    return optimisticDiary;
  };

  const updateDiary = (id: string, patch: Partial<GeneratedDiary>) => {
    let previousDiary: GeneratedDiary | undefined;
    setDiaries((prev) => {
      previousDiary = prev.find((d) => d.id === id);
      const next = prev.map((d) => (d.id === id ? { ...d, ...patch } : d));
      void persistCache(user?.email, sites, entries, next);
      return next;
    });
    apiJson<{ diary: GeneratedDiary }>(`/projects/diaries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
      .then(({ diary }) => {
        setDiaries((prev) => {
          const next = prev.map((d) => (d.id === id ? diary : d));
          void persistCache(user?.email, sites, entries, next);
          return next;
        });
      })
      .catch((error) => {
        console.warn("update diary failed, rolling back optimistic update", error);
        if (previousDiary) {
          const snapshot = previousDiary;
          setDiaries((prev) => {
            const next = prev.map((d) => (d.id === id ? snapshot : d));
            void persistCache(user?.email, sites, entries, next);
            return next;
          });
        }
      });
  };

  const getSite = (id?: string) => {
    if (!id) return undefined;
    return sites.find((s) => s.id === id);
  };

  const getEntry = (id?: string) => {
    if (!id) return undefined;
    return entries.find((e) => e.id === id);
  };

  const getSiteEntries = (siteId?: string) => {
    if (!siteId) return [];
    return entries.filter((e) => e.siteId === siteId);
  };

  const getSiteDiaries = (siteId?: string) => {
    if (!siteId) return [];
    if (!Array.isArray(diaries)) return [];
    return diaries.filter((d) => d.siteId === siteId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  };

  return (
    <DataContext.Provider
      value={{
        sites,
        entries,
        diaries,
        syncStatus,
        lastSyncError,
        addSite,
        deleteSite,
        addEntry,
        updateEntry,
        deleteEntry,
        addDiary,
        updateDiary,
        getEntry,
        getSite,
        getSiteEntries,
        getSiteDiaries,
        loading,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within DataProvider");
  }
  return context;
}
