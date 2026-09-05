/**
 * Persistence Server Functions
 *
 * Bridge between client UI and backend services (Neon PostgreSQL + Cloudflare R2).
 * All database operations are strictly server-side.
 * Browser bundles NEVER connect to Neon directly.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { questionsRepo } from "../db/repositories/questions.repo";
import { quizzesRepo } from "../db/repositories/quizzes.repo";
import { masteryRepo } from "../db/repositories/mastery.repo";
import { documentsRepo } from "../db/repositories/documents.repo";
import { uploadFile } from "../storage/r2-storage";
import { logEvent } from "../observability/logger";
import type { QuestionBankItem } from "./question-bank";
import type { ConceptMastery } from "./mastery-engine";

// ---------------------------------------------------------------------------
// 1. Question Bank Persistence
// ---------------------------------------------------------------------------

const SaveQuestionBankSchema = z.object({
  items: z.array(z.any()),
  userId: z.string().optional(),
});

export const saveQuestionBankServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveQuestionBankSchema.parse(input))
  .handler(async ({ data }): Promise<{ savedCount: number; items: QuestionBankItem[] }> => {
    const startTime = Date.now();
    try {
      const items = data.items as QuestionBankItem[];
      const savedItems = await questionsRepo.saveBatch(items, data.userId);

      logEvent("info", {
        operation: "save_question_bank_neon",
        category: "mastery",
        durationMs: Date.now() - startTime,
        metadata: {
          requestedCount: items.length,
          savedCount: savedItems.length,
          userId: data.userId || "anonymous",
        },
      });

      return { savedCount: savedItems.length, items: savedItems };
    } catch (err) {
      logEvent("error", {
        operation: "save_question_bank_neon",
        category: "mastery",
        durationMs: Date.now() - startTime,
        error: {
          code: "DB_SAVE_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

const LoadQuestionBankSchema = z.object({
  topic: z.string().optional(),
  difficulty: z.string().optional(),
  importMode: z.string().optional(),
  status: z.string().optional(),
  documentId: z.string().optional(),
  limit: z.number().int().min(1).max(300).optional(),
  offset: z.number().int().min(0).optional(),
});

export const loadQuestionBankServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoadQuestionBankSchema.parse(input))
  .handler(async ({ data }): Promise<{ items: QuestionBankItem[] }> => {
    try {
      const items = await questionsRepo.listQuestions(data);
      return { items };
    } catch (err) {
      logEvent("error", {
        operation: "load_question_bank_neon",
        category: "mastery",
        error: {
          code: "DB_LOAD_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

// ---------------------------------------------------------------------------
// 2. Quiz Attempt Persistence
// ---------------------------------------------------------------------------

const SaveQuizAttemptSchema = z.object({
  userId: z.string().optional(),
  documentId: z.string().optional(),
  courseId: z.string().optional(),
  totalQuestions: z.number().int().min(1),
  score: z.number().int().min(0),
  percentage: z.number().int().min(0).max(100),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().nullable().optional(),
      isCorrect: z.boolean(),
      timeTakenSeconds: z.number().optional(),
    }),
  ),
});

export const saveQuizAttemptServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveQuizAttemptSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string }> => {
    try {
      const result = await quizzesRepo.recordAttempt(data);
      return result;
    } catch (err) {
      logEvent("error", {
        operation: "save_quiz_attempt_neon",
        category: "mastery",
        error: {
          code: "DB_ATTEMPT_SAVE_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

// ---------------------------------------------------------------------------
// 3. Learner Mastery Persistence
// ---------------------------------------------------------------------------

const LoadLearnerMasterySchema = z.object({
  userId: z.string().min(1),
});

export const loadLearnerMasteryServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoadLearnerMasterySchema.parse(input))
  .handler(async ({ data }): Promise<{ mastery: Record<string, ConceptMastery> }> => {
    try {
      const mastery = await masteryRepo.getLearnerMastery(data.userId);
      return { mastery };
    } catch (err) {
      logEvent("error", {
        operation: "load_mastery_neon",
        category: "mastery",
        error: {
          code: "DB_MASTERY_LOAD_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

// ---------------------------------------------------------------------------
// 4. Source Document Persistence (Neon + Cloudflare R2)
// ---------------------------------------------------------------------------

const UploadSourceDocumentSchema = z.object({
  title: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().min(1),
  fileType: z.string().min(1),
  fileDataBufferBase64: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
  extractedText: z.string().optional(),
  summary: z.string().optional(),
  dominantLanguage: z.string().default("ar"),
  userId: z.string().optional(),
});

export const uploadSourceDocumentServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => UploadSourceDocumentSchema.parse(input))
  .handler(async ({ data }): Promise<{ documentId: string; storageKey: string; url: string }> => {
    const startTime = Date.now();
    try {
      // 1. Convert base64 buffer
      const buffer = Uint8Array.from(atob(data.fileDataBufferBase64), (c) => c.charCodeAt(0));
      const fileExt = data.fileName.split(".").pop() || "bin";
      const storageKey = `documents/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      // 2. Upload to Cloudflare R2
      const uploadRes = await uploadFile(storageKey, buffer, data.fileType);

      // 3. Save metadata to Neon PostgreSQL
      const docRecord = await documentsRepo.createDocument({
        userId: data.userId,
        title: data.title,
        fileName: data.fileName,
        fileSizeBytes: data.fileSizeBytes,
        fileType: data.fileType,
        storageKey: uploadRes.key,
        storageBucket: "quizy-storage",
        pageCount: data.pageCount,
        extractedText: data.extractedText,
        summary: data.summary,
        dominantLanguage: data.dominantLanguage,
      });

      logEvent("info", {
        operation: "upload_source_document",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          documentId: docRecord.id,
          storageKey: uploadRes.key,
          sizeBytes: data.fileSizeBytes,
        },
      });

      return {
        documentId: docRecord.id,
        storageKey: uploadRes.key,
        url: uploadRes.url,
      };
    } catch (err) {
      logEvent("error", {
        operation: "upload_source_document",
        category: "document",
        durationMs: Date.now() - startTime,
        error: {
          code: "DOCUMENT_UPLOAD_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });
