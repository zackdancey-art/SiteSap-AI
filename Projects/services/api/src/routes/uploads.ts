import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { verifyAuthToken } from "../utils/authToken";
import { getMediaStorage } from "../storage/mediaStorage";

export const uploadsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const storage = getMediaStorage();

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

uploadsRouter.post("/uploads", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Missing file field 'file' in multipart form-data." });
  }

  try {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filename = sanitizeFilename(req.file.originalname || `${id}.jpg`);
    const saved = await storage.saveFile({
      id,
      filename,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    return res.json({
      id,
      filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: saved.urlPath,
      storageKey: saved.storageKey,
      storagePath: saved.storagePath,
    });
  } catch (error) {
    console.error("[uploads] save failed", error);
    return res.status(500).json({ error: "Failed to store upload." });
  }
});

function resolveUploadToken(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

uploadsRouter.get("/uploads/:id/:filename", async (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const queryToken = resolveUploadToken(req.query.authToken);
  const claims = verifyAuthToken(bearerToken || queryToken || "");
  if (!claims) {
    return res.status(401).json({ error: "Authentication required for media access." });
  }

  const id = String(req.params.id || "").trim();
  const filename = sanitizeFilename(String(req.params.filename || "").trim());
  if (!id || !filename) {
    return res.status(400).json({ error: "Invalid upload path." });
  }

  try {
    const storageKey = `uploads/${id}-${filename}`;
    const buffer = await storage.readFile(storageKey, filename);
    const extension = filename.split(".").pop()?.toLowerCase();
    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(buffer);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && String((error as { code?: string }).code) === "ENOENT") {
      return res.status(404).json({ error: "Upload not found." });
    }
    console.error("[uploads] read failed", error);
    return res.status(404).json({ error: "Upload not found." });
  }
});
