import AsyncStorage from "@react-native-async-storage/async-storage";
import { Entry, Photo } from "@/lib/types";

type StoredPhotoPayload = {
  base64?: string;
  mimeType?: string;
};

const PHOTO_PAYLOADS_KEY = "sitesnap.photoPayloads";

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
  const payloadMap = await readPayloadMap();
  photos.forEach((photo) => {
    if (!photo.id) return;
    if (!photo.base64) return;
    payloadMap[photo.id] = {
      base64: photo.base64,
      mimeType: photo.mimeType || "image/jpeg",
    };
  });
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

export function stripPhotoArray(photos: Photo[]): Photo[] {
  return photos.map((photo) => ({
    ...photo,
    base64: undefined,
    mimeType: photo.mimeType,
  }));
}

export async function hydratePhotos(photos: Photo[]): Promise<Photo[]> {
  const payloadMap = await readPayloadMap();
  return photos.map((photo) => ({
    ...photo,
    base64: photo.base64 || payloadMap[photo.id]?.base64,
    mimeType: photo.mimeType || payloadMap[photo.id]?.mimeType || "image/jpeg",
  }));
}
