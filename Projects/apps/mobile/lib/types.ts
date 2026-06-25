export interface Site {
  id: string;
  name: string;
  address: string;
  client: string;
  startDate: string;
  status: "active" | "completed" | "on-hold";
  createdAt: string;
}

export interface Photo {
  id: string;
  uri: string;
  caption: string;
  timestamp: string;
  base64?: string;
  mimeType?: string;
  storagePath?: string;
  storageKey?: string;
  latitude?: number;
  longitude?: number;
}

export interface DailyEntry {
  id: string;
  siteId: string;
  date: string;
  locationAddress?: string;
  weather: string;
  crewCount: string;
  notes: string;
  photos: Photo[];
  createdAt?: string;
  timestamp: string;
  isPending?: boolean;
}

export interface DiaryEditLogEntry {
  at: string;
  action: "approved" | "reverted" | "edited";
  by?: string;
  note?: string;
}

export interface GeneratedDiary {
  id: string;
  siteId: string;
  generatedAt: string;
  status: "draft" | "approved";
  summary: string;
  reportPeriod?: "daily" | "weekly" | "monthly";
  fullReport?: string;
  safetyChecklist?: string[];
  sections: DiarySection[];
  editLog?: DiaryEditLogEntry[];
}

export interface DiarySection {
  date: string;
  weather: string;
  crewCount: string;
  workCompleted: string;
  safetyObservations: string;
  materialsUsed: string;
  issues: string;
  photoAnalysis: string;
}

// Backwards-compatible alias expected by some modules
export type Entry = DailyEntry;

export interface SiteTemplate {
  id: string;
  ownerEmail: string;
  siteId: string;
  name: string;
  weather: string;
  crewCount: string;
  notesTemplate: string;
  createdAt: string;
}
