import fs from "fs/promises";
import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { getMediaStorage } from "../storage/mediaStorage";
import { listEntries, listSites } from "../storage/projectsStore";
import { getOpenAIClient } from "../services/openaiClient";

type ReportPeriod = "daily" | "weekly" | "monthly";

type GenerateDiaryPhoto = {
  id?: string;
  uri?: string;
  caption?: string;
  timestamp?: string;
  base64?: string;
  mimeType?: string;
  storagePath?: string;
  storageKey?: string;
};

type GenerateDiaryEntry = {
  date?: string;
  locationAddress?: string;
  weather?: string;
  crewCount?: string;
  notes?: string;
  photos?: GenerateDiaryPhoto[];
  timestamp?: string;
};

type GenerateDiaryBody = {
  siteId?: string;
  site?: {
    name?: string;
    client?: string;
    address?: string;
    startDate?: string;
  };
  period?: ReportPeriod;
  entries?: GenerateDiaryEntry[];
};

type OpenAIErrorLike = {
  status?: number;
  response?: {
    status?: number;
  };
};

type DiarySection = {
  date: string;
  weather: string;
  crewCount: string;
  workCompleted: string;
  safetyObservations: string;
  materialsUsed: string;
  issues: string;
  photoAnalysis: string;
};

type DiaryOutput = {
  summary: string;
  fullReport: string;
  safetyChecklist: string[];
  reportPeriod: ReportPeriod;
  sections: DiarySection[];
};

type OpenAIContentItem =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export const aiRouter: Router = Router();
const mediaStorage = getMediaStorage();

function normalizePeriod(period: unknown): ReportPeriod {
  if (period === "weekly" || period === "monthly") return period;
  return "daily";
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeEntry(entry: GenerateDiaryEntry): DiarySection {
  const photos = Array.isArray(entry.photos) ? entry.photos : [];
  const workNotes = entry.locationAddress
    ? `${entry.notes || "No notes provided."}\nLocation: ${entry.locationAddress}`
    : entry.notes || "No notes provided.";
  const captionNotes = photos
    .map((photo) => String(photo.caption || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  let photoAnalysis = "N/A";
  if (captionNotes.length > 0) {
    photoAnalysis = `Photo observations provided in captions: ${captionNotes.join(" | ")}`;
  }

  return {
    date: String(entry.date ?? new Date().toISOString().slice(0, 10)),
    weather: String(entry.weather ?? "Not recorded"),
    crewCount: String(entry.crewCount ?? "Not recorded"),
    workCompleted: workNotes,
    safetyObservations: "N/A",
    materialsUsed: "N/A",
    issues: "N/A",
    photoAnalysis,
  };
}

function normalizeSection(section: Partial<DiarySection> | undefined, fallback: DiarySection): DiarySection {
  return {
    date: cleanString(section?.date, fallback.date),
    weather: cleanString(section?.weather, fallback.weather),
    crewCount: cleanString(section?.crewCount, fallback.crewCount),
    workCompleted: cleanString(section?.workCompleted, fallback.workCompleted),
    safetyObservations: cleanString(section?.safetyObservations, fallback.safetyObservations),
    materialsUsed: cleanString(section?.materialsUsed, fallback.materialsUsed),
    issues: cleanString(section?.issues, fallback.issues),
    photoAnalysis: cleanString(section?.photoAnalysis, fallback.photoAnalysis),
  };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function filterEntriesByPeriod(entries: GenerateDiaryEntry[], period: ReportPeriod) {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => dateOnly(String(a.date || "")).getTime() - dateOnly(String(b.date || "")).getTime());
  const latest = dateOnly(String(sorted[sorted.length - 1].date || new Date().toISOString().slice(0, 10)));
  if (period === "daily") {
    const key = String(sorted[sorted.length - 1].date || formatDateKey(latest));
    return sorted.filter((entry) => entry.date === key);
  }
  if (period === "weekly") {
    const start = new Date(latest);
    start.setDate(start.getDate() - 6);
    return sorted.filter((entry) => {
      const entryDate = dateOnly(String(entry.date || keyFromDate(latest)));
      return entryDate >= start && entryDate <= latest;
    });
  }
  return sorted.filter((entry) => {
    const d = dateOnly(String(entry.date || keyFromDate(latest)));
    return d.getFullYear() === latest.getFullYear() && d.getMonth() === latest.getMonth();
  });
}

function keyFromDate(date: Date) {
  return formatDateKey(date);
}

function extractObservedSafetyChecklist(entries: GenerateDiaryEntry[]) {
  const lines = entries.flatMap((entry) => {
    const notes = String(entry.notes || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const photoCaptions = (entry.photos || [])
      .map((photo) => String(photo.caption || "").trim())
      .filter(Boolean);
    return [...notes, ...photoCaptions];
  });

  const observed = lines.filter((line) =>
    /\b(safe|safely|safety|hazard|risk|ppe|helmet|harness|barrier|guardrail|secured|secure|inspection|inspected|clear access|signage)\b/i.test(
      line
    )
  );

  return Array.from(new Set(observed)).slice(0, 8);
}

function buildFullReport(args: { sections: DiarySection[]; period: ReportPeriod; siteName?: string }) {
  const { sections, period, siteName } = args;
  const lines: string[] = [];
  lines.push(`Period: ${period.toUpperCase()}`);
  lines.push(`Site: ${siteName || "Unspecified site"}`);
  lines.push(`Entries analyzed: ${sections.length}`);
  lines.push("");
  lines.push("Observed progress:");
  sections.forEach((section, index) => {
    lines.push(`${index + 1}. ${section.date}: ${section.workCompleted}`);
  });
  lines.push("");
  lines.push("Photo observations:");
  sections.forEach((section) => {
    if (section.photoAnalysis !== "N/A" && section.photoAnalysis !== "No photos attached for this entry") {
      lines.push(`- ${section.date}: ${section.photoAnalysis}`);
    }
  });
  if (lines[lines.length - 1] === "Photo observations:") {
    lines.push("- No photo observations captured.");
  }
  return lines.join("\n");
}

async function normalizeBase64Image(photo: GenerateDiaryPhoto) {
  const raw = String(photo.base64 || "").trim();
  const mimeType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(cleanString(photo.mimeType, "image/jpeg"))
    ? cleanString(photo.mimeType, "image/jpeg")
    : "image/jpeg";
  if (raw) {
    if (raw.startsWith("data:")) {
      const [, base64Part] = raw.split(",", 2);
      return base64Part ? `data:${mimeType};base64,${base64Part}` : null;
    }
    return `data:${mimeType};base64,${raw}`;
  }

  const storagePath = cleanString(photo.storagePath, "");
  const storageKey = cleanString(photo.storageKey, "");
  if (storagePath || storageKey) {
    try {
      const file = storageKey
        ? await mediaStorage.readFile(storageKey, storageKey.split("/").pop()?.split("-").slice(1).join("-") || "image.jpg", storagePath || undefined)
        : await fs.readFile(storagePath);
      return `data:${mimeType};base64,${file.toString("base64")}`;
    } catch (error) {
      console.warn("[ai] Failed to read stored photo for analysis", { storageKey, storagePath, error });
    }
  }
  return null;
}

async function buildVisionInputs(entries: GenerateDiaryEntry[]) {
  const content: OpenAIContentItem[] = [];
  let includedImages = 0;

  for (const [entryIndex, entry] of entries.entries()) {
    const photos = Array.isArray(entry.photos) ? entry.photos : [];
    for (const [photoIndex, photo] of photos.entries()) {
      if (includedImages >= 8) break;
      const imageUrl = await normalizeBase64Image(photo);
      if (!imageUrl) continue;
      includedImages += 1;
      content.push({
        type: "input_text",
        text: JSON.stringify({
          imageRef: `entry-${entryIndex + 1}-photo-${photoIndex + 1}`,
          entryDate: entry.date || "",
          photoTimestamp: photo.timestamp || "",
          userCaption: photo.caption || "",
          instruction:
            "Report only directly visible site conditions, equipment, materials, signage, weather, progress, or hazards visible in this image.",
        }),
      });
      content.push({
        type: "input_image",
        image_url: imageUrl,
      });
    }
  }

  return content;
}

function buildEvidenceCorpus(entries: GenerateDiaryEntry[], sections: DiarySection[]) {
  const rawLines = entries.flatMap((entry) => {
    const notes = String(entry.notes || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const captions = (entry.photos || []).map((photo) => String(photo.caption || "").trim()).filter(Boolean);
    return [...notes, ...captions];
  });

  const sectionLines = sections.flatMap((section) =>
    [section.safetyObservations, section.photoAnalysis].filter(
      (value) => value && value !== "N/A" && value !== "No photos attached for this entry"
    )
  );

  return [...rawLines, ...sectionLines].join(" \n ").toLowerCase();
}

function hasEvidenceSupport(item: string, corpus: string) {
  const normalized = item.toLowerCase();
  if (!normalized.trim()) return false;
  if (corpus.includes(normalized)) return true;
  const tokens = normalized.match(/[a-z0-9]{4,}/g) || [];
  if (tokens.length === 0) return false;
  const overlap = tokens.filter((token) => corpus.includes(token));
  return overlap.length >= Math.min(2, tokens.length);
}

export function buildDiaryFromEntries(entries: GenerateDiaryEntry[], period: ReportPeriod = "daily"): DiaryOutput {
  const sections = entries.map((entry) => normalizeEntry(entry));
  const summary = [
    `Executive summary (${period}):`,
    `Compiled from ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
    "Only observations explicitly stated in entry text and photo captions are included below.",
  ].join(" ");
  return {
    summary,
    fullReport: buildFullReport({ sections, period }),
    safetyChecklist: extractObservedSafetyChecklist(entries),
    reportPeriod: period,
    sections,
  };
}

async function tryGenerateWithOpenAI(body: GenerateDiaryBody): Promise<DiaryOutput> {
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const period = normalizePeriod(body.period);
  if (!process.env.OPENAI_API_KEY) {
    return buildDiaryFromEntries(entries, period);
  }

  const fallback = buildDiaryFromEntries(entries, period);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = getOpenAIClient();
  const promptPayload = {
    site: body.site || {},
    period,
    entries: entries.map((entry) => ({
      date: entry.date || "",
      locationAddress: entry.locationAddress || "",
      weather: entry.weather || "",
      crewCount: entry.crewCount || "",
      notes: entry.notes || "",
      photos: (entry.photos || []).map((photo) => ({
        id: photo.id || "",
        caption: photo.caption || "",
        timestamp: photo.timestamp || "",
        hasImage: Boolean(String(photo.base64 || "").trim()),
      })),
    })),
  };

  const visionInputs = await buildVisionInputs(entries);
  const userContent: OpenAIContentItem[] = [
    {
      type: "input_text",
      text: JSON.stringify(promptPayload),
    },
    ...visionInputs,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You generate construction diary reports. Output strict JSON with: summary, fullReport, safetyChecklist, and sections." +
              " Each section must include: date, weather, crewCount, workCompleted, safetyObservations, materialsUsed, issues, photoAnalysis." +
              " Use only evidence explicitly present in the entry text, structured fields, photo captions, and any uploaded images." +
              " When images are provided, prioritize direct visual observations in photoAnalysis and mention visible equipment, materials, work progress, weather, signage, hazards, or site conditions only if they are plainly visible." +
              " Do not infer causes, unseen work, compliance, incidents, or hidden risks." +
              " If an observation cannot be directly supported by visible image evidence or provided text, write 'N/A'." +
              " Safety checklist items must be directly supported by explicit notes, captions, or clearly visible image evidence.",
          },
        ],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text: { format: { type: "json_object" } } as any,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputText = String((response as any).output_text || "").trim();
  if (!outputText) {
    return fallback;
  }

  let parsed: Partial<DiaryOutput> = {};
  try {
    parsed = JSON.parse(outputText) as Partial<DiaryOutput>;
  } catch {
    return fallback;
  }

  const modelSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const safeSections = fallback.sections.map((section, index) => normalizeSection(modelSections[index], section));
  const evidenceCorpus = buildEvidenceCorpus(entries, safeSections);
  const parsedChecklist = Array.isArray(parsed.safetyChecklist)
    ? parsed.safetyChecklist.map((item) => cleanString(item, "")).filter(Boolean)
    : [];
  const supportedChecklist = parsedChecklist.filter((item) => hasEvidenceSupport(item, evidenceCorpus)).slice(0, 8);

  return {
    summary: cleanString(parsed.summary, fallback.summary),
    fullReport: cleanString(parsed.fullReport, buildFullReport({ sections: safeSections, period, siteName: body.site?.name })),
    safetyChecklist: supportedChecklist.length > 0 ? supportedChecklist : fallback.safetyChecklist,
    reportPeriod: period,
    sections: safeSections,
  };
}

async function resolveDiaryRequest(req: AuthenticatedRequest, body: GenerateDiaryBody) {
  const period = normalizePeriod(body.period);
  if (Array.isArray(body.entries) && body.entries.length > 0) {
    return { site: body.site || {}, period, entries: filterEntriesByPeriod(body.entries, period) };
  }

  const siteId = cleanString(body.siteId, "");
  if (!siteId) {
    throw new Error("A siteId or entries payload is required.");
  }

  const actor = { email: req.auth.email, role: req.auth.role };
  const [sites, entries] = await Promise.all([listSites(actor), listEntries(actor, siteId)]);
  const site = sites.find((item) => item.id === siteId);
  if (!site) {
    throw new Error("Site not found.");
  }

  const scopedEntries = filterEntriesByPeriod(
    entries.map((entry) => ({
      date: entry.date,
      locationAddress: entry.locationAddress,
      weather: entry.weather,
      crewCount: entry.crewCount,
      notes: entry.notes,
          photos: Array.isArray(entry.photos)
            ? entry.photos.map((photo) => ({
                id: typeof photo.id === "string" ? photo.id : undefined,
                uri: typeof photo.uri === "string" ? photo.uri : undefined,
                caption: typeof photo.caption === "string" ? photo.caption : undefined,
                timestamp: typeof photo.timestamp === "string" ? photo.timestamp : undefined,
                mimeType: typeof photo.mimeType === "string" ? photo.mimeType : undefined,
                storagePath: typeof photo.storagePath === "string" ? photo.storagePath : undefined,
                storageKey: typeof photo.storageKey === "string" ? photo.storageKey : undefined,
              }))
            : [],
      timestamp: entry.timestamp,
    })),
    period
  );

  return {
    site: {
      name: site.name,
      client: site.client,
      address: site.address,
      startDate: site.startDate,
    },
    period,
    entries: scopedEntries,
  };
}

aiRouter.post("/generate-diary", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as GenerateDiaryBody;
  const payloadBytes = Buffer.byteLength(JSON.stringify(body || {}), "utf8");

  try {
    const resolved = await resolveDiaryRequest(req as AuthenticatedRequest, body);
    if (resolved.entries.length === 0) {
      return res.status(400).json({ success: false, error: "No entries are available for the selected report period." });
    }
    const diary = await tryGenerateWithOpenAI(resolved);
    return res.json({ success: true, diary });
  } catch (err: unknown) {
    const statusFromOpenAI =
      typeof err === "object" && err !== null
        ? ((err as OpenAIErrorLike).status ?? (err as OpenAIErrorLike).response?.status)
        : undefined;

    console.error("[ai] generate-diary failed", {
      path: req.originalUrl,
      payloadBytes,
      siteId: body.siteId || null,
      message: err instanceof Error ? err.message : String(err),
      statusFromOpenAI: statusFromOpenAI ?? null,
    });

    try {
      const resolved = await resolveDiaryRequest(req as AuthenticatedRequest, body);
      const fallbackDiary = buildDiaryFromEntries(resolved.entries, resolved.period);
      const warning =
        statusFromOpenAI === 401
          ? "Invalid OPENAI_API_KEY (401). Used local generator."
          : statusFromOpenAI === 429
            ? "OpenAI quota/credits exceeded (429). Used local generator."
            : "AI unavailable, used local generator.";
      return res.json({ success: true, diary: fallbackDiary, warning });
    } catch (fallbackError) {
      return res.status(400).json({
        success: false,
        error: fallbackError instanceof Error ? fallbackError.message : "Failed to generate diary.",
      });
    }
  }
});
