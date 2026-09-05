/**
 * Questions Repository — Neon PostgreSQL
 * Handles AI-generated questions and Exact Source question banks.
 * Preserves Exact Source fidelity, two-hash integrity model, and media references.
 */

import { getDb } from "../neon.ts";
import type {
  QuestionBankItem,
  QuestionBankFilter,
  QuestionStatus,
} from "../../learning/question-bank.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

import type { Difficulty, BloomLevel } from "../../ai/schemas.ts";
import type {
  ImportMode,
  ImportFidelity,
  QuestionMediaRef,
} from "../../learning/exact-import-types.ts";

export interface QuestionDbRow {
  id: string;
  question: string;
  options: string[] | string;
  correct_index: number | string;
  explanation?: string | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
  bloom_level?: BloomLevel | null;
  evidence_quote?: string | null;
  source_document_name?: string | null;
  document_id?: string | null;
  source_page?: number | null;
  source_section?: string | null;
  source_question_number?: number | null;
  import_mode?: ImportMode | null;
  import_fidelity?: ImportFidelity | null;
  original_text?: string | null;
  source_snapshot?: string | null;
  source_raw_hash?: string | null;
  canonical_question_hash?: string | null;
  render_source_exactly?: boolean | null;
  correct_answer_source?: string | null;
  requires_review?: boolean | null;
  review_reason?: string | null;
  media_refs?: QuestionMediaRef[] | string | null;
  status?: string | null;
  created_at?: string | Date | null;
}

export function mapRowToQuestionBankItem(row: QuestionDbRow): QuestionBankItem {
  const options = Array.isArray(row.options)
    ? row.options
    : typeof row.options === "string"
      ? JSON.parse(row.options)
      : [];

  const mediaRefs = Array.isArray(row.media_refs)
    ? row.media_refs
    : typeof row.media_refs === "string"
      ? JSON.parse(row.media_refs)
      : undefined;

  const rawHash = row.source_raw_hash ?? undefined;
  const canonicalHash = row.canonical_question_hash ?? undefined;

  return {
    id: row.id,
    question: row.question,
    options,
    correctIndex: Number(row.correct_index),
    explanation: row.explanation || "",
    topic: row.topic || "عام",
    difficulty: row.difficulty || "medium",
    bloomLevel: row.bloom_level || "understand",
    evidenceQuote: row.evidence_quote ?? undefined,

    sourceDocumentName: row.source_document_name || "مصدر غير محدد",
    sourceDocumentId: row.document_id ?? undefined,
    sourcePage: row.source_page ?? undefined,
    sourceSection: row.source_section ?? undefined,
    sourceQuestionNumber: row.source_question_number ?? undefined,

    importMode: row.import_mode || "ai_generated",
    importFidelity: row.import_fidelity ?? undefined,

    originalText: row.original_text ?? undefined,
    sourceSnapshot: row.source_snapshot ?? undefined,
    sourceRawHash: rawHash,
    sourceHash: rawHash,
    canonicalQuestionHash: canonicalHash,
    questionHash: canonicalHash,
    renderSourceExactly: Boolean(row.render_source_exactly),
    correctAnswerSource: row.correct_answer_source ?? undefined,

    requiresReview: Boolean(row.requires_review),
    reviewReason: row.review_reason ?? undefined,
    mediaRequired: Boolean(mediaRefs && mediaRefs.length > 0),
    mediaExtracted: Boolean(mediaRefs && mediaRefs.length > 0),
    mediaRefs,

    status: (row.status as QuestionStatus) || "validated",
    isVerified: row.status === "approved",
    isSaved: false,
    markedForReview: Boolean(row.requires_review),

    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    tags: [row.topic || "عام", row.import_mode || "ai_generated"],
  };
}

export const questionsRepo = {
  /**
   * Save a single question into Neon.
   */
  async saveQuestion(item: QuestionBankItem, userId?: string): Promise<QuestionBankItem> {
    const sql = getDb();
    const docId = isValidUuid(item.sourceDocumentId) ? item.sourceDocumentId : null;
    const authorId = isValidUuid(userId) ? userId : null;
    const specifiedId = isValidUuid(item.id) ? item.id : null;

    const optionsJson = JSON.stringify(item.options);
    const mediaRefsJson = item.mediaRefs ? JSON.stringify(item.mediaRefs) : null;
    const qualityScoreJson = item.extractionConfidence
      ? JSON.stringify({ confidence: item.extractionConfidence })
      : null;

    const rows = await sql`
      INSERT INTO public.questions (
        ${specifiedId ? sql`id,` : sql``}
        document_id,
        created_by,
        question,
        options,
        correct_index,
        explanation,
        topic,
        difficulty,
        bloom_level,
        evidence_quote,
        quality_score,
        status,
        import_mode,
        import_fidelity,
        original_text,
        source_snapshot,
        source_raw_hash,
        canonical_question_hash,
        render_source_exactly,
        correct_answer_source,
        source_page,
        source_section,
        source_question_number,
        source_document_name,
        media_refs,
        requires_review,
        review_reason
      ) VALUES (
        ${specifiedId ? sql`${specifiedId},` : sql``}
        ${docId},
        ${authorId},
        ${item.question},
        ${optionsJson}::jsonb,
        ${item.correctIndex},
        ${item.explanation || ""},
        ${item.topic || "عام"},
        ${item.difficulty || "medium"},
        ${item.bloomLevel || "understand"},
        ${item.evidenceQuote ?? null},
        ${qualityScoreJson}::jsonb,
        ${item.status || "validated"},
        ${item.importMode || "ai_generated"},
        ${item.importFidelity ?? null},
        ${item.originalText ?? null},
        ${item.sourceSnapshot ?? null},
        ${item.sourceRawHash ?? item.sourceHash ?? null},
        ${item.canonicalQuestionHash ?? item.questionHash ?? null},
        ${Boolean(item.renderSourceExactly)},
        ${item.correctAnswerSource ?? null},
        ${item.sourcePage ?? null},
        ${item.sourceSection ?? null},
        ${item.sourceQuestionNumber ?? null},
        ${item.sourceDocumentName || "مصدر غير محدد"},
        ${mediaRefsJson}::jsonb,
        ${Boolean(item.requiresReview)},
        ${item.reviewReason ?? null}
      )
      RETURNING *;
    `;

    return mapRowToQuestionBankItem(rows[0] as unknown as QuestionDbRow);
  },

  /**
   * Batch save question bank items into Neon.
   * Deduplicates by canonical_question_hash when present.
   */
  async saveBatch(items: QuestionBankItem[], userId?: string): Promise<QuestionBankItem[]> {
    const saved: QuestionBankItem[] = [];
    for (const item of items) {
      // Deduplicate by canonicalQuestionHash if present
      const hash = item.canonicalQuestionHash ?? item.questionHash;
      if (hash) {
        const existing = await this.findByCanonicalHash(hash);
        if (existing) {
          saved.push(existing);
          continue;
        }
      }
      const newItem = await this.saveQuestion(item, userId);
      saved.push(newItem);
    }
    return saved;
  },

  async findById(id: string): Promise<QuestionBankItem | null> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.questions WHERE id = ${id} LIMIT 1;
    `;
    if (!rows || rows.length === 0) return null;
    return mapRowToQuestionBankItem(rows[0] as unknown as QuestionDbRow);
  },

  async findByCanonicalHash(hash: string): Promise<QuestionBankItem | null> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.questions WHERE canonical_question_hash = ${hash} LIMIT 1;
    `;
    if (!rows || rows.length === 0) return null;
    return mapRowToQuestionBankItem(rows[0] as unknown as QuestionDbRow);
  },

  async listQuestions(options?: {
    topic?: string;
    difficulty?: string;
    importMode?: string;
    status?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<QuestionBankItem[]> {
    const sql = getDb();
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await sql`
      SELECT * FROM public.questions
      WHERE
        (${options?.topic ? sql`topic = ${options.topic}` : sql`1=1`})
        AND (${options?.difficulty ? sql`difficulty = ${options.difficulty}` : sql`1=1`})
        AND (${options?.importMode ? sql`import_mode = ${options.importMode}` : sql`1=1`})
        AND (${options?.status ? sql`status = ${options.status}` : sql`1=1`})
        AND (${options?.documentId ? sql`document_id = ${options.documentId}` : sql`1=1`})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return (rows as unknown as QuestionDbRow[]).map(mapRowToQuestionBankItem);
  },

  async updateStatus(id: string, status: QuestionStatus): Promise<boolean> {
    const sql = getDb();
    const rows = await sql`
      UPDATE public.questions
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id;
    `;
    return rows.length > 0;
  },

  async deleteQuestion(id: string): Promise<boolean> {
    const sql = getDb();
    const rows = await sql`
      DELETE FROM public.questions WHERE id = ${id} RETURNING id;
    `;
    return rows.length > 0;
  },
};
