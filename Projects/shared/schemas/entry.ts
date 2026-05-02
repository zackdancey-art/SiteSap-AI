import { z } from "zod";

export const PhotoRefSchema = z.object({
  id: z.string(),
  filename: z.string(),
  url: z.string().optional(),
});

export const DiaryEntryDraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  hazards: z.array(z.string()),
  progress: z.string(),
  nextSteps: z.string(),
});

export const CreateEntrySchema = z.object({
  siteId: z.string(),
  date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date' }),
  notes: z.string().optional(),
  photos: z.array(PhotoRefSchema).optional(),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;
export type DiaryEntryDraft = z.infer<typeof DiaryEntryDraftSchema>;
export type PhotoRef = z.infer<typeof PhotoRefSchema>;
