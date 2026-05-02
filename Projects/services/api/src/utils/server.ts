import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/uploads", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Missing file field 'file'" });
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  res.json({
    id,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

app.post("/api/ai/generate", (req, res) => {
  const { prompt } = req.body ?? {};
  res.json({
    draft: {
      title: "Site Update Draft",
      summary:
        typeof prompt === "string"
          ? prompt.slice(0, 140)
          : "Generated summary placeholder.",
      hazards: ["Hazard list placeholder"],
      progress: ["Progress item placeholder"],
      nextSteps: ["Next step placeholder"],
    },
  });
});

app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
