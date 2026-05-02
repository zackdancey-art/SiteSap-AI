import { DiaryEntryDraft } from '@sitesnap/shared/schemas/entry';

export interface AIService {
  generateDraft(input: { siteId: string; date: string; notes?: string; photos?: Array<{ id: string; filename: string; url?: string }> }): Promise<DiaryEntryDraft>;
}

export class AIServiceSync implements AIService {
  async generateDraft(input: { siteId: string; date: string; notes?: string; photos?: Array<{ id: string; filename: string; url?: string }> }) {
    // Very simple rule-based draft generator for dev
    const title = `Site ${input.siteId} diary ${new Date(input.date).toLocaleDateString()}`;
    const summary = (input.notes || '').slice(0, 240) || 'No notes provided.';
    const hazards = input.notes && input.notes.toLowerCase().includes('hazard') ? ['General site hazard noted'] : [];
    const progress = input.photos && input.photos.length > 0 ? `Uploaded ${input.photos.length} photos.` : 'No photos.';
    const nextSteps = 'Continue works as planned.';

    return {
      title,
      summary,
      hazards,
      progress,
      nextSteps,
    };
  }
}
