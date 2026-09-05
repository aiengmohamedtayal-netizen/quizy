/**
 * Documents Repository — Neon PostgreSQL
 * Handles educational document metadata, source text, summaries, and R2 storage keys.
 */

import { getDb } from "../neon.ts";
import type { DocumentRecord } from "../types.ts";

export interface CreateDocumentInput {
  id?: string;
  userId?: string | null;
  courseId?: string | null;
  title: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: string;
  storageKey?: string | null;
  storageBucket?: string;
  fileHash?: string | null;
  pageCount?: number;
  extractedText?: string | null;
  summary?: string | null;
  dominantLanguage?: string;
}

export const documentsRepo = {
  async createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
    const sql = getDb();
    const rows = await sql`
      INSERT INTO public.documents (
        ${input.id ? sql`id,` : sql``}
        user_id,
        course_id,
        title,
        file_name,
        file_size_bytes,
        file_type,
        storage_key,
        storage_bucket,
        file_hash,
        page_count,
        extracted_text,
        summary,
        dominant_language
      ) VALUES (
        ${input.id ? sql`${input.id},` : sql``}
        ${input.userId ?? null},
        ${input.courseId ?? null},
        ${input.title},
        ${input.fileName},
        ${input.fileSizeBytes},
        ${input.fileType},
        ${input.storageKey ?? null},
        ${input.storageBucket ?? "quizy-storage"},
        ${input.fileHash ?? null},
        ${input.pageCount ?? 1},
        ${input.extractedText ?? null},
        ${input.summary ?? null},
        ${input.dominantLanguage ?? "ar"}
      )
      RETURNING *;
    `;
    return rows[0] as unknown as DocumentRecord;
  },

  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.documents WHERE id = ${id} LIMIT 1;
    `;
    return (rows[0] as unknown as DocumentRecord) ?? null;
  },

  async getDocumentsByUser(userId: string): Promise<DocumentRecord[]> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.documents WHERE user_id = ${userId} ORDER BY created_at DESC;
    `;
    return rows as unknown as DocumentRecord[];
  },

  async updateStorageKey(id: string, storageKey: string, bucket = "quizy-storage"): Promise<void> {
    const sql = getDb();
    await sql`
      UPDATE public.documents
      SET storage_key = ${storageKey}, storage_bucket = ${bucket}
      WHERE id = ${id};
    `;
  },

  async deleteDocument(id: string): Promise<void> {
    const sql = getDb();
    await sql`
      DELETE FROM public.documents WHERE id = ${id};
    `;
  },
};
