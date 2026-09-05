import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeEducationalContent } from "./ai/content-analyzer";
import { generateQuizFromContent } from "./ai/quiz-generator";
import { extractQuestionsFromSource } from "./ai/exact-extractor";
import {
  askGroundedTutor,
  TutorRequestSchema,
  type TutorRequest,
  type TutorPromptType,
} from "./ai/tutor";
import {
  QuizConfigSchema,
  QuizQuestionSchema,
  DocumentAnalysisSchema,
  ConceptSchema,
  type QuizConfig,
  type QuizQuestion,
  type DocumentAnalysis,
  type Concept,
} from "./ai/schemas";
import { processPagesWithOcr } from "./documents/ocr";
import type { OCRBatchResult } from "./documents/ocr/types";
import { logEvent } from "./observability/logger";

export {
  QuizConfigSchema,
  QuizQuestionSchema,
  DocumentAnalysisSchema,
  ConceptSchema,
  TutorRequestSchema,
  type QuizConfig,
  type QuizQuestion,
  type DocumentAnalysis,
  type Concept,
  type TutorRequest,
  type TutorPromptType,
};

export type { ExactImportResult, ExactImportProgress } from "./learning/exact-import-types";

const OcrInputSchema = z.object({
  pages: z.array(
    z.object({
      pageNumber: z.number(),
      imageBufferBase64: z.string(),
      mimeType: z.string().optional(),
    }),
  ),
  documentName: z.string().optional(),
});

/**
 * Server function to perform smart OCR on scanned or low-quality document pages.
 * Never exposes API keys or multimodal vision secrets to the client.
 */
export const ocrPagesServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => OcrInputSchema.parse(input))
  .handler(async ({ data }): Promise<OCRBatchResult> => {
    const startTime = Date.now();
    try {
      const result = await processPagesWithOcr(data.pages, data.documentName);
      logEvent("info", {
        operation: "ocr_pages",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          documentName: data.documentName || "unknown",
          requestedPages: data.pages.length,
          recognizedPages: result.pages.filter((p) => p.meaningfulWordCount > 0).length,
          provider: result.providerName,
        },
      });
      return result;
    } catch (err) {
      logEvent("error", {
        operation: "ocr_pages",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          documentName: data.documentName || "unknown",
          requestedPages: data.pages.length,
        },
        error: {
          code: "OCR_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

const AnalyzeInputSchema = z.object({
  text: z.string().min(10, "النص قصير جداً للتحليل").max(300000),
  filename: z.string().optional(),
});

/**
 * Server function to analyze document content:
 * Extracts topics, key concepts, detects existing questions vs lectures, and provides a summary.
 */
export const analyzeDocumentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInputSchema.parse(input))
  .handler(async ({ data }): Promise<DocumentAnalysis> => {
    const startTime = Date.now();
    try {
      const analysis = await analyzeEducationalContent(data.text);
      logEvent("info", {
        operation: "analyze_content",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          filename: data.filename || "unknown",
          textLength: data.text.length,
          topicsCount: analysis.topics.length,
          conceptsCount: analysis.concepts.length,
          dominantLanguage: analysis.dominantLanguage,
        },
      });
      return analysis;
    } catch (err) {
      logEvent("error", {
        operation: "analyze_content",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          filename: data.filename || "unknown",
          textLength: data.text.length,
        },
        error: {
          code: "ANALYSIS_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

const GenerateInputSchema = z.object({
  text: z.string().min(10, "النص قصير جداً").max(300000),
  config: QuizConfigSchema,
  contextTopics: z.array(z.string()).optional(),
  filename: z.string().optional(),
});

/**
 * Server function to generate an interactive quiz from educational content
 * applying strict grounding, chunking, deduplication, Bloom taxonomy, and schema validation.
 */
export const generateQuizFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => GenerateInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[] }> => {
    const startTime = Date.now();
    try {
      const questions = await generateQuizFromContent(data.text, data.config, data.contextTopics);
      logEvent("info", {
        operation: "generate_quiz",
        category: "ai",
        durationMs: Date.now() - startTime,
        metadata: {
          filename: data.filename || "unknown",
          requestedCount: data.config.questionCount,
          generatedCount: questions.length,
          difficulty: data.config.difficulty,
          language: data.config.language,
        },
      });
      return { questions };
    } catch (err) {
      logEvent("error", {
        operation: "generate_quiz",
        category: "ai",
        durationMs: Date.now() - startTime,
        metadata: {
          filename: data.filename || "unknown",
          requestedCount: data.config.questionCount,
        },
        error: {
          code: "GENERATION_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

/**
 * Server function for the interactive AI Tutor.
 * Provides grounded explanations, analogies, error diagnostics, and hints.
 */
export const askAiTutorFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => TutorRequestSchema.parse(input))
  .handler(async ({ data }): Promise<{ answer: string }> => {
    const answer = await askGroundedTutor(data);
    return { answer };
  });

// ---------------------------------------------------------------------------
// IMPORT_EXACT_MODE Server Function
// This is COMPLETELY SEPARATE from generateQuizFn.
// It runs the exact source extraction pipeline — never quiz generation.
// ---------------------------------------------------------------------------

const ExactImportInputSchema = z.object({
  text: z.string().min(10, "النص قصير جداً").max(500000),
  documentName: z.string().min(1),
  documentId: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
});

/**
 * Server function for IMPORT_EXACT_MODE.
 *
 * Runs the exact source extraction pipeline:
 * 1. Splits document text into page chunks
 * 2. Uses AI to detect question boundaries (NOT to generate content)
 * 3. Resolves answer keys if present
 * 4. Computes source + question hashes
 * 5. Assigns ImportFidelity per question
 * 6. Returns ExactImportResult for preview
 *
 * NEVER calls generateQuizFromContent or any quiz generation code.
 */
export const importExactBankFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => ExactImportInputSchema.parse(input))
  .handler(async ({ data }) => {
    const startTime = Date.now();
    try {
      const result = await extractQuestionsFromSource(data.text, {
        documentName: data.documentName,
        documentId: data.documentId,
        pageCount: data.pageCount,
      });
      logEvent("info", {
        operation: "import_exact_bank",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: {
          documentName: data.documentName,
          totalExtracted: result.questions.length,
          exactCount: result.preview.exact,
          needsReviewCount: result.preview.needsReview,
        },
      });
      return result;
    } catch (err) {
      logEvent("error", {
        operation: "import_exact_bank",
        category: "document",
        durationMs: Date.now() - startTime,
        metadata: { documentName: data.documentName },
        error: {
          code: "EXACT_IMPORT_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  });

/**
 * Legacy server function maintained for full backward compatibility.
 */
export const extractQuiz = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ text: z.string().min(10).max(300000) }).parse(input))
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[] }> => {
    const defaultConfig: QuizConfig = {
      questionCount: 10,
      difficulty: "mixed",
      questionType: "mixed",
      language: "auto",
      targetBloomLevel: "all",
    };
    const questions = await generateQuizFromContent(data.text, defaultConfig);
    return { questions };
  });
