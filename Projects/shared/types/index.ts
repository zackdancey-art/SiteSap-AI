/* Shared TS types - re-export canonical types from schemas where available */

export type ID = string;

import type { PhotoRef as SchemaPhotoRef, DiaryEntryDraft as SchemaDiaryEntryDraft } from "../schemas/entry";

export type PhotoRef = SchemaPhotoRef;

export type Site = {
  id: ID;
  name: string;
  address?: string;
};

export type Entry = {
  id: ID;
  siteId: ID;
  date: string; // ISO
  createdBy: ID;
  photos: PhotoRef[];
  notes?: string;
  aiDraft?: DiaryEntryDraft;
};

export type DiaryEntryDraft = SchemaDiaryEntryDraft;

export type AuthTokenPayload = {
  sub: ID;
  exp?: number;
};
