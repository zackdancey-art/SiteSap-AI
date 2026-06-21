import AsyncStorage from "@react-native-async-storage/async-storage";

export interface EntryDraft {
  siteId: string;
  date: string;
  weather: string;
  locationAddress: string;
  crewCount: string;
  notes: string;
  savedAt: string;
}

const PREFIX = "sitesnap.entrydraft";

function key(siteId: string) {
  return `${PREFIX}:${siteId}`;
}

export async function saveDraft(siteId: string, draft: Omit<EntryDraft, "savedAt">): Promise<void> {
  const record: EntryDraft = { ...draft, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(key(siteId), JSON.stringify(record));
}

export async function loadDraft(siteId: string): Promise<EntryDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(siteId));
    if (!raw) return null;
    return JSON.parse(raw) as EntryDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(siteId: string): Promise<void> {
  await AsyncStorage.removeItem(key(siteId));
}
