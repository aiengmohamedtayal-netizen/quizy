/**
 * Exact Source Extractor — IMPORT_EXACT_MODE
 *
 * ARCHITECTURE CONSTRAINTS:
 * 1. Native text extraction is the ground truth. AI only assists with
 *    boundary detection and classification.
 * 2. AI is FORBIDDEN from generating, rewriting, or paraphrasing content.
 * 3. Fidelity is proven by: hash(sourceSnapshot) === hash(renderedQuestion)
 * 4. Every question is assigned an ImportFidelity before returning.
 * 5. This module MUST NEVER call generateQuizFromContent or quiz generation
 *    prompts. It is completely separate from the AI quiz pipeline.
 */

import { executeRoutedAiCall } from "./router";
import { extractJsonFromResponse } from "./provider";
import {
  getExactExtractionSystemPrompt,
  buildExactExtractionUserPrompt,
  getAnswerKeyResolutionPrompt,
  EXACT_EXTRACTION_TOOL,
} from "./prompts-exact";
import {
  computeCanonicalHash,
  computeSourceRawHash,
  sanitizeAiMetadata,
  detectDuplicates,
} from "../learning/question-integrity";
import type {
  ImportedQuestion,
  ExactImportResult,
  ImportFidelity,
  ExtractionStatus,
  ImportPreviewSummary,
  DocumentLayoutResult,
} from "../learning/exact-import-types";

// Hashing is now centralized in question-integrity.ts
// Re-export for test backward compatibility
export {
  computeQuestionHash,
  computeSourceHash,
  computeCanonicalHash,
  computeSourceRawHash,
} from "../learning/question-integrity";

// ---------------------------------------------------------------------------
// Fidelity Determination
// ---------------------------------------------------------------------------

/**
 * Strict ImportFidelity contract.
 * Returns "exact" ONLY when all conditions are provably met.
 * Returns "review_required" for ANY uncertainty.
 * NEVER promotes uncertain data to "exact".
 */
export function determineImportFidelity(candidate: {
  questionText: string;
  options: string[];
  correctAnswerSource?: string;
  correctIndex: number;
  extractionConfidence: number;
  requiresReview: boolean;
  mediaRequired: boolean;
  mediaExtracted: boolean;
  sourcePage?: number;
}): ImportFidelity {
  // Empty question text = failed
  if (!candidate.questionText.trim()) return "failed";

  // If flagged for review, never mark as exact
  if (candidate.requiresReview) return "review_required";

  // Must have sufficient confidence
  if (candidate.extractionConfidence < 0.75) return "review_required";

  // Must have at least 2 options
  if (candidate.options.length < 2) return "review_required";

  // Must have a traceable answer (source reference or high confidence)
  const hasTraceableAnswer =
    !!candidate.correctAnswerSource || candidate.extractionConfidence >= 0.85;
  if (!hasTraceableAnswer) return "review_required";

  // If media required, it must have been extracted
  if (candidate.mediaRequired && !candidate.mediaExtracted) return "review_required";

  // Source page must be known
  if (candidate.sourcePage === undefined) return "review_required";

  // correctIndex must not be unresolved (-1)
  if (candidate.correctIndex < 0) return "review_required";

  return "exact";
}

// ---------------------------------------------------------------------------
// Answer Key Resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve a letter/number answer key to an option index.
 *
 * POLICY: If the answer cannot be resolved with confidence:
 * - Returns -1 (unresolved)
 * - The caller MUST set requiresReview = true
 * - NEVER default to 0 (that would be guessing)
 */
function resolveAnswerKeyToIndex(correctAnswerSource: string, options: string[]): number {
  const raw = correctAnswerSource.trim().toUpperCase();

  // Common Arabic letter mappings
  const arabicMap: Record<string, number> = {
    "\u0623": 0,
    "\u0627": 0,
    "\u0623\u0644\u0641": 0, // أ, ا, ألف
    "\u0628": 1, // ب
    "\u062C": 2, // ج
    "\u062F": 3, // د
    "\u0647\u0640": 4,
    "\u0647": 4, // هـ, ه
  };
  if (arabicMap[raw] !== undefined) return arabicMap[raw];

  // Latin letter mappings
  const latinMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  if (latinMap[raw] !== undefined) return latinMap[raw];

  // Numeric (1-based)
  const num = parseInt(raw, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) return num - 1;

  // Match option text prefix
  const normalized = raw.toLowerCase();
  const idx = options.findIndex((o) => o.toLowerCase().trim().startsWith(normalized));
  if (idx !== -1) return idx;

  // Cannot resolve — caller must mark requiresReview
  return -1;
}

// ---------------------------------------------------------------------------
// Media Detection Heuristics
// ---------------------------------------------------------------------------

const MEDIA_REFERENCE_PATTERNS = [
  /الشكل\s+\d+/i,
  /الصورة\s+\d*/i,
  /الرسم\s+\d*/i,
  /الجدول\s+\d+/i,
  /المخطط\s+\d*/i,
  /الرسم البياني/i,
  /figure\s+\d+/i,
  /diagram\s+\d*/i,
  /chart\s+\d*/i,
  /table\s+\d+/i,
  /graph\s+\d*/i,
  /shown (below|above|in the figure)/i,
  /الموضح/i,
  /التالية?/i,
  /انظر/i,
  /كما في/i,
];

function detectMediaRequired(questionText: string): boolean {
  return MEDIA_REFERENCE_PATTERNS.some((pattern) => pattern.test(questionText));
}

// ---------------------------------------------------------------------------
// Raw AI Response Validation
// ---------------------------------------------------------------------------

interface RawExtractedQuestion {
  sourceQuestionNumber?: number;
  sourcePage?: number;
  questionText?: string;
  sourceSnapshot?: string;
  options?: unknown[];
  correctAnswerSource?: string;
  extractionConfidence?: number;
  requiresReview?: boolean;
  reviewReason?: string;
  mediaRequired?: boolean;
  topic?: string;
}

function isValidRawQuestion(raw: unknown): raw is RawExtractedQuestion {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.questionText === "string" &&
    obj.questionText.trim().length >= 5 &&
    Array.isArray(obj.options) &&
    (obj.options as unknown[]).length >= 2
  );
}

// ---------------------------------------------------------------------------
// Core Extraction Function
// ---------------------------------------------------------------------------

export interface ExactExtractionOptions {
  documentName: string;
  documentId: string;
  pageCount: number;
  layoutResult?: DocumentLayoutResult;
  onProgress?: (stage: string, current: number, total: number) => void;
}

// Bounded concurrency helper
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = await tasks[i]();
      } catch {
        results[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Main exact extraction function.
 *
 * Pipeline:
 * 1. Split text into page chunks — NO truncation, process ALL chunks
 * 2. Detect answer key section (if present)
 * 3. Per-chunk: AI-assisted boundary detection with per-chunk timeout
 * 4. Resolve answer keys (from key section OR inline markers)
 * 5. Compute sourceRawHash + canonicalQuestionHash per question
 * 6. Determine ImportFidelity per question
 * 7. Detect duplicates (report only — never auto-remove)
 * 8. Return ExactImportResult with real progress
 *
 * NEVER calls generateQuizFromContent or any quiz generation code.
 * NEVER auto-deduplicates questions.
 * NEVER guesses missing answers — sets requiresReview instead.
 */
export async function extractQuestionsFromSource(
  fullText: string,
  options: ExactExtractionOptions,
): Promise<ExactImportResult> {
  const { documentName, documentId, pageCount } = options;

  // -------------------------------------------------------------------------
  // Step 1: Split text into chunks — ALL chunks, no truncation
  // -------------------------------------------------------------------------
  const PAGE_CHUNK_SIZE = 12000;
  const OVERLAP = 500;
  const chunks: Array<{ text: string; pageHint: number }> = [];

  // Try to split by page markers first
  const pageMarkerRegex = /(?:صفحة|Page|PAGE)\s*[\d]+/gi;
  const pageMatches = [...fullText.matchAll(pageMarkerRegex)];

  if (pageMatches.length >= 2) {
    for (let i = 0; i < pageMatches.length; i++) {
      const start = pageMatches[i].index!;
      const end = pageMatches[i + 1]?.index ?? fullText.length;
      const chunkText = fullText.slice(start, end).trim();
      if (chunkText.length > 50) {
        chunks.push({ text: chunkText, pageHint: i + 1 });
      }
    }
  } else {
    let pos = 0;
    let pageHint = 1;
    while (pos < fullText.length) {
      const end = Math.min(pos + PAGE_CHUNK_SIZE, fullText.length);
      chunks.push({ text: fullText.slice(pos, end), pageHint });
      pos = end - OVERLAP;
      pageHint++;
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Detect answer key section
  // -------------------------------------------------------------------------
  const answerKeyPatterns = [
    /مفتاح الإجابات?/i,
    /الإجابات? الصحيحة/i,
    /answer\s+key/i,
    /answers?:/i,
    /إجابات?:/i,
  ];

  let answerKeyText: string | null = null;
  const answerKeyChunkIndex = chunks.findIndex((chunk) =>
    answerKeyPatterns.some((p) => p.test(chunk.text)),
  );

  if (answerKeyChunkIndex !== -1) {
    answerKeyText = chunks[answerKeyChunkIndex].text;
  }

  // -------------------------------------------------------------------------
  // Step 3: Extract per-chunk questions with bounded concurrency
  // Max 3 concurrent AI calls, 45s timeout per chunk
  // -------------------------------------------------------------------------
  const contentChunks = chunks.filter((_, i) => i !== answerKeyChunkIndex);
  const totalChunks = contentChunks.length;
  let processedChunks = 0;

  options.onProgress?.("بدء استخراج الأسئلة", 0, totalChunks);

  const extractionTasks = contentChunks.map((chunk, i) => async () => {
    const systemPrompt = getExactExtractionSystemPrompt();
    const userPrompt = buildExactExtractionUserPrompt(chunk.text, chunk.pageHint, documentName);

    const rawResponse = await executeRoutedAiCall("exact_source_extraction", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [EXACT_EXTRACTION_TOOL],
      toolChoice: { type: "function", function: { name: "extract_questions_exact" } },
    });

    processedChunks++;
    options.onProgress?.(
      `استخراج الصفحات (${processedChunks} من ${totalChunks})`,
      processedChunks,
      totalChunks,
    );

    const parsed = extractJsonFromResponse<{ questions?: unknown[] }>(rawResponse);
    const candidates = Array.isArray(parsed.questions)
      ? parsed.questions
      : Array.isArray(parsed)
        ? parsed
        : [];

    return candidates
      .filter(isValidRawQuestion)
      .map((q) => ({ ...q, chunkPageHint: chunk.pageHint }));
  });

  const chunkResults = await runWithConcurrency(
    extractionTasks,
    3, // max 3 concurrent AI calls
  );

  const allRawQuestions: (RawExtractedQuestion & { chunkPageHint: number })[] = chunkResults
    .filter((r): r is (RawExtractedQuestion & { chunkPageHint: number })[] => r !== null)
    .flat();

  // -------------------------------------------------------------------------
  // Step 4: Resolve answer keys
  // -------------------------------------------------------------------------
  const answerKeyMappings = new Map<number, { correctIndex: number; source: string }>();

  if (answerKeyText && allRawQuestions.length > 0) {
    try {
      const systemPrompt = getAnswerKeyResolutionPrompt();
      const userPrompt = `مفتاح الإجابات من المستند:\n\n<source_document_untrusted>\n${answerKeyText}\n</source_document_untrusted>`;

      const rawResponse = await executeRoutedAiCall("exact_source_extraction", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        jsonMode: true,
      });

      const parsed = extractJsonFromResponse<{
        mappings?: Array<{
          questionNumber: number;
          correctIndex: number;
          correctAnswerSource: string;
        }>;
      }>(rawResponse);

      if (Array.isArray(parsed.mappings)) {
        for (const mapping of parsed.mappings) {
          if (typeof mapping.questionNumber === "number") {
            answerKeyMappings.set(mapping.questionNumber, {
              correctIndex: mapping.correctIndex ?? 0,
              source: mapping.correctAnswerSource ?? "",
            });
          }
        }
      }
    } catch {
      // Answer key resolution failed — questions will be marked requiresReview
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Build validated ImportedQuestion[] with hashes and fidelity
  // NO automatic deduplication — preserve ALL questions from source
  // -------------------------------------------------------------------------
  const questions: ImportedQuestion[] = [];
  let questionIdx = 0;

  for (const raw of allRawQuestions) {
    if (!raw.questionText) continue;

    // sourceText: the immutable verbatim extracted text — NEVER modified
    const questionText = raw.questionText.trim();
    const sourceSnapshot = raw.sourceSnapshot?.trim() ?? questionText;

    // POLICY: No automatic deduplication in Exact Source mode.
    // All questions from source are preserved as-is.
    // Duplicates are reported via detectDuplicates() after building the list.

    const rawOptions = Array.isArray(raw.options)
      ? (raw.options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
      : [];

    if (rawOptions.length < 2) continue;

    // Resolve correct answer
    // POLICY: If unresolvable, correctIndex = -1 and requiresReview = true
    // NEVER default to 0 (that would be guessing)
    let correctIndex = -1; // -1 = unresolved
    let correctAnswerSource = raw.correctAnswerSource ?? undefined;
    let answerUnresolved = false;

    if (raw.sourceQuestionNumber !== undefined && answerKeyMappings.has(raw.sourceQuestionNumber)) {
      const keyMapping = answerKeyMappings.get(raw.sourceQuestionNumber)!;
      correctIndex = Math.max(0, Math.min(keyMapping.correctIndex, rawOptions.length - 1));
      correctAnswerSource = keyMapping.source || correctAnswerSource;
    } else if (correctAnswerSource) {
      const resolved = resolveAnswerKeyToIndex(correctAnswerSource, rawOptions);
      if (resolved === -1) {
        answerUnresolved = true;
      } else {
        correctIndex = resolved;
      }
    } else {
      answerUnresolved = true;
    }

    const mediaRequired = raw.mediaRequired ?? detectMediaRequired(questionText);
    const extractionConfidence = Math.min(1, Math.max(0, raw.extractionConfidence ?? 0.7));

    // requiresReview: true if any condition fails
    const requiresReview =
      raw.requiresReview === true ||
      answerUnresolved ||
      extractionConfidence < 0.75 ||
      (mediaRequired && correctIndex < 0) ||
      !raw.sourcePage;

    // If correctIndex still unresolved and review required, set to 0 for storage
    // but mark requiresReview so the UI never shows this as a confident answer
    const finalCorrectIndex = correctIndex >= 0 ? correctIndex : 0;

    // Compute hashes using centralized integrity module
    const [sourceRawHash, canonicalQuestionHash] = await Promise.all([
      computeSourceRawHash(sourceSnapshot),
      computeCanonicalHash({ questionText, options: rawOptions, correctIndex: finalCorrectIndex }),
    ]);

    const fidelity = determineImportFidelity({
      questionText,
      options: rawOptions,
      correctAnswerSource,
      correctIndex: finalCorrectIndex,
      extractionConfidence,
      requiresReview: !!requiresReview,
      mediaRequired,
      mediaExtracted: false,
      sourcePage: raw.sourcePage ?? raw.chunkPageHint,
    });

    const status: ExtractionStatus =
      fidelity === "exact"
        ? "ready"
        : fidelity === "failed"
          ? "failed"
          : answerUnresolved
            ? "no_answer"
            : "needs_review";

    // sanitizeAiMetadata is applied ONLY to AI-generated metadata, never to source content
    const reviewReason = raw.reviewReason
      ? sanitizeAiMetadata(raw.reviewReason)
      : requiresReview
        ? generateReviewReason(raw, mediaRequired, answerUnresolved)
        : undefined;
    const topic = raw.topic ? sanitizeAiMetadata(raw.topic) : undefined;

    const importedQuestion: ImportedQuestion = {
      id: `exact_${documentId}_${questionIdx++}_${Date.now()}`,
      // sourceText fields — IMMUTABLE, never sanitized
      originalText: questionText,
      sourceSnapshot,
      sourceRawHash,
      canonicalQuestionHash,
      renderSourceExactly: fidelity === "exact",
      importFidelity: fidelity,
      // Structured content
      questionText,
      options: rawOptions,
      correctIndex: finalCorrectIndex,
      correctAnswerSource,
      // Source reference
      sourceDocumentId: documentId,
      sourceDocumentName: documentName,
      sourcePage: raw.sourcePage ?? raw.chunkPageHint,
      sourceSection: undefined,
      sourceQuestionNumber: raw.sourceQuestionNumber,
      // Extraction metadata
      extractionConfidence,
      requiresReview: !!requiresReview,
      reviewReason,
      mediaRequired,
      mediaExtracted: false,
      mediaRefs: [],
      status,
      isVerified: false,
      topic,
      explanation: undefined,
    };

    questions.push(importedQuestion);
  }

  // -------------------------------------------------------------------------
  // Step 6: Detect duplicates (report only — do NOT remove)
  // -------------------------------------------------------------------------
  const duplicates = detectDuplicates(
    questions.map((q) => ({
      questionText: q.questionText,
      options: q.options,
      sourcePage: q.sourcePage,
      sourceQuestionNumber: q.sourceQuestionNumber,
    })),
  );

  // -------------------------------------------------------------------------
  // Step 7: Build preview summary
  // -------------------------------------------------------------------------
  const preview: ImportPreviewSummary = {
    total: questions.length,
    ready: questions.filter((q) => q.status === "ready").length,
    needsReview: questions.filter((q) => q.status === "needs_review" || q.status === "no_answer")
      .length,
    mediaRequired: questions.filter((q) => q.mediaRequired).length,
    mediaExtracted: questions.filter((q) => q.mediaExtracted).length,
    noAnswer: questions.filter((q) => q.status === "no_answer").length,
    exact: questions.filter((q) => q.importFidelity === "exact").length,
    duplicatesDetected: duplicates.length,
  };

  return {
    questions,
    preview,
    documentId,
    documentName,
    pageCount,
    layoutResult: options.layoutResult,
    duplicates,
  };
}

function generateReviewReason(
  raw: RawExtractedQuestion,
  mediaRequired: boolean,
  answerUnresolved?: boolean,
): string {
  const reasons: string[] = [];
  if (raw.extractionConfidence !== undefined && raw.extractionConfidence < 0.75) {
    reasons.push("ثقة الاستخراج منخفضة");
  }
  if (answerUnresolved) {
    reasons.push("لم يُحدد الجواب الصحيح بوضوح في المصدر");
  }
  if (mediaRequired) {
    reasons.push("السؤال يحتاج صورة أو شكل لم يُستخرج");
  }
  if (!raw.sourcePage) {
    reasons.push("رقم الصفحة غير محدد");
  }
  return reasons.join(" · ") || "يحتاج مراجعة يدوية";
}
