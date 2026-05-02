import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { verifyAuthToken } from "../utils/authToken";
import { getMediaStorage } from "../storage/mediaStorage";
import { signUploadPath, verifyUploadSignature } from "../utils/signedUrl";
import { rateLimit } from "../middleware/rateLimit";

export const uploadsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const storage = getMediaStorage();

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

uploadsRouter.post("/uploads", requireAuth, rateLimit("uploads-post", 30, 60 * 60 * 1000), upload.single("file"), async (req, res) => {
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

    // Return canonical path only — callers use POST /uploads/sign to get a time-limited URL
    const canonicalPath = `/api/uploads/${id}/${filename}`;
    return res.json({
      id,
      filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: canonicalPath,
      storageKey: saved.storageKey,
      storagePath: saved.storagePath,
    });
  } catch (error) {
    console.error("[uploads] save failed", error);
    return res.status(500).json({ error: "Failed to store upload." });
  }
});

// Batch sign endpoint — accepts an array of canonical paths, returns short-lived HMAC URLs
uploadsRouter.post("/uploads/sign", requireAuth, (req, res) => {
  const paths = req.body?.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: "paths must be a non-empty array of strings." });
  }
  if (paths.length > 50) {
    return res.status(400).json({ error: "Maximum 50 paths per sign request." });
  }

  const base = `${req.protocol}://${req.get("host")}`;
  const signed = (paths as unknown[]).map((raw) => {
    const path = typeof raw === "string" ? raw.trim() : "";
    // Extract id and filename from /api/uploads/:id/:filename
    const match = path.match(/\/api\/uploads\/([^/]+)\/([^/?]+)/);
    if (!match) return { path, url: null, error: "Invalid upload path." };
    const [, id, filename] = match;
    const { sig, exp } = signUploadPath(id, filename);
    return {
      path,
      url: `${base}/api/uploads/${id}/${filename}?sig=${encodeURIComponent(sig)}&exp=${exp}`,
    };
  });

  return res.json({ signed });
});

uploadsRouter.get("/uploads/:id/:filename", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const filename = sanitizeFilename(String(req.params.filename || "").trim());
  if (!id || !filename) {
    return res.status(400).json({ error: "Invalid upload path." });
  }

  // Accept: Authorization: Bearer <jwt>  OR  ?sig=<hmac>&exp=<ts>
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  let authorized = false;
  if (bearerToken) {
    authorized = Boolean(verifyAuthToken(bearerToken));
  } else {
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";
    const exp = typeof req.query.exp === "string" ? req.query.exp : "";
    authorized = sig !== "" && exp !== "" && verifyUploadSignature(id, filename, sig, exp);
  }

  if (!authorized) {
    return res.status(401).json({ error: "Authentication required for media access." });
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
    // Signed URLs are short-lived, so a slightly longer client cache is fine
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(buffer);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && String((error as { code?: string }).code) === "ENOENT") {
      return res.status(404).json({ error: "Upload not found." });
    }
    console.error("[uploads] read failed", error);
    return res.status(404).json({ error: "Upload not found." });
  }
});
