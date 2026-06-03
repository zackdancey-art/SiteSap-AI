import AsyncStorage from "@react-native-async-storage/async-storage";
import { Entry, Photo } from "@/lib/types";

type StoredPhotoPayload = {
  base64?: string;
  mimeType?: string;
  savedAt: number;
};

const PHOTO_PAYLOADS_KEY = "sitesnap.photoPayloads";
const MAX_CACHED_PHOTOS = 50;

async function readPayloadMap(): Promise<Record<string, StoredPhotoPayload>> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_PAYLOADS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredPhotoPayload>) : {};
  } catch {
    return {};
  }
}

async function writePayloadMap(value: Record<string, StoredPhotoPayload>) {
  await AsyncStorage.setItem(PHOTO_PAYLOADS_KEY, JSON.stringify(value));
}

function evictLruEntries(map: Record<string, StoredPhotoPayload>): Record<string, StoredPhotoPayload> {
  const keys = Object.keys(map);
  if (keys.length <= MAX_CACHED_PHOTOS) return map;
  const sorted = keys.sort((a, b) => (map[a].savedAt ?? 0) - (map[b].savedAt ?? 0));
  const toEvict = sorted.slice(0, keys.length - MAX_CACHED_PHOTOS);
  console.warn(`[photo-payload-store] Evicting ${toEvict.length} cached photo payload(s) — cache limit (${MAX_CACHED_PHOTOS}) reached. Upload pending entries to avoid data loss.`);
  const evicted = { ...map };
  toEvict.forEach((k) => delete evicted[k]);
  return evicted;
}

export function stripPhotoPayloads<T extends { photos: Photo[] }>(entry: T): T {
  return {
    ...entry,
    photos: entry.photos.map((photo) => ({
      ...photo,
      base64: undefined,
      mimeType: photo.mimeType,
    })),
  };
}

export async function savePhotoPayloads(photos: Photo[]) {
  let payloadMap = await readPayloadMap();
  const now = Date.now();
  photos.forEach((photo) => {
    if (!photo.id) return;
    if (!photo.base64) return;
    payloadMap[photo.id] = {
      base64: photo.base64,
      mimeType: photo.mimeType || "image/jpeg",
      savedAt: now,
    };
  });
  payloadMap = evictLruEntries(payloadMap);
  await writePayloadMap(payloadMap);
}

export async function deletePhotoPayloads(photoIds: string[]) {
  if (photoIds.length === 0) return;
  const payloadMap = await readPayloadMap();
  photoIds.forEach((photoId) => {
    delete payloadMap[photoId];
  });
  await writePayloadMap(payloadMap);
}

export async function hydrateEntriesWithPhotoPayloads(entries: Entry[]) {
  const payloadMap = await readPayloadMap();
  return entries.map((entry) => ({
    ...entry,
    photos: entry.photos.map((photo) => ({
      ...photo,
      base64: photo.base64 || payloadMap[photo.id]?.base64,
      mimeType: photo.mimeType || payloadMap[photo.id]?.mimeType || "image/jpeg",
    })),
  }));
}
