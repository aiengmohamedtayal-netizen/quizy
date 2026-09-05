/**
 * Exact Import Types — Shared types for the IMPORT_EXACT_MODE pipeline.
 *
 * ARCHITECTURE CONSTRAINT:
 * These types are COMPLETELY SEPARATE from the AI-generated quiz pipeline.
 * The source document is authoritative. AI may only assist with boundary
 * detection and classification — never with generating or rewriting content.
 *
 * TWO-HASH MODEL:
 *   sourceRawHash         — SHA-256(sourceSnapshot.trim())
 *   canonicalQuestionHash — SHA-256(canonicalizeQuestion({ questionText, options, correctIndex }))
 *
 * These are different hashes serving different purposes and must NEVER be compared to each other.
 * sourceRawHash proves source document integrity.
 * canonicalQuestionHash proves structured question stability at render time.
 */

// ---------------------------------------------------------------------------
// Fidelity & Status
// ---------------------------------------------------------------------------

export type ImportMode = "ai_generated" | "exact_source";

/**
 * Fidelity contract for an imported question.
 *
 * "exact" is ONLY assigned when ALL conditions are met:
 * - Text extracted verbatim from source ✓
 * - All options present and in original order ✓
 * - Correct answer traceable to source ✓
 * - Source page recorded ✓
 * - Required media extracted OR explicitly flagged ✓
 * - No boundary ambiguity ✓
 * - Schema validation passed ✓
 *
 * In all other cases: "review_required" or "failed".
 */
export type ImportFidelity = "exact" | "review_required" | "failed";

export type ExtractionStatus =
  | "ready" // High confidence, fidelity = exact
  | "needs_review" // Low confidence, missing media, or boundary unclear
  | "no_answer" // Could not determine correct answer
  | "failed"; // Extraction failed entirely

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/**
 * A media asset extracted from a source document.
 * Stored ONLY in IndexedDB — never in localStorage.
 * Questions reference media by ID, not by embedding the blob.
 */
export interface MediaAsset {
  id: string;
  sourceDocumentId: string;
  /** 1-based page number */
  sourcePage: number;
  mimeType: string;
  /** Raw image/media blob — stored in IndexedDB */
  blob: Blob;
  width?: number;
  height?: number;
  /** SHA-256 of the blob for integrity checking */
  sourceHash: string;
  createdAt: number;
}

/**
 * A reference from a question to a media asset.
 * Preserves the spatial/semantic relationship detected during layout analysis.
 */
export interface QuestionMediaRef {
  /** References MediaAsset.id in IndexedDB */
  mediaId: string;
  /**
   * The detected relationship between this media and the question:
   * - "question" — image is part of the question stem
   * - "option"   — image belongs to a specific answer option
   * - "answer"   — image illustrates the correct answer
   * - "figure"   — image is a referenced figure/diagram
   * - "unknown"  — spatial proximity detected but relationship unclear → requiresReview
   */
  relation: "question" | "option" | "answer" | "figure" | "unknown";
  /** Confidence of this association (0–1). Below 0.6 → requiresReview */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Document Layout (used during extraction, not persisted)
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: "text";
  pageNumber: number;
  text: string;
  /** Approximate bounding box (normalized 0–1) */
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface ImageBlock {
  type: "image";
  pageNumber: number;
  mediaId?: string; // Set after media is saved to IndexedDB
  bbox?: { x: number; y: number; w: number; h: number };
  extractionConfidence: number;
}

export interface TableBlock {
  type: "table";
  pageNumber: number;
  text: string; // Linearized table text
  bbox?: { x: number; y: number; w: number; h: number };
}

export type DocumentBlock = TextBlock | ImageBlock | TableBlock;

export interface DocumentLayoutPage {
  pageNumber: number;
  blocks: DocumentBlock[];
}

export interface DocumentLayoutResult {
  pages: DocumentLayoutPage[];
  totalPages: number;
  hasImages: boolean;
  imageCount: number;
}

// ---------------------------------------------------------------------------
// Imported Question
// ---------------------------------------------------------------------------

export interface ImportedQuestion {
  /** Unique ID assigned during extraction */
  id: string;

  // ---- SOURCE FIDELITY (immutable after extraction) ----

  /**
   * The question text EXACTLY as found in the source document.
   * This is the immutable source text — ExactQuizRunner MUST render this.
   * NEVER sanitize, rewrite, or modify this field.
   * React renders it safely as a plain text node: <div>{originalText}</div>
   */
  originalText: string;

  /**
   * Full raw source block as it appeared in the document (may include
   * the question number, options, and surrounding context).
   * Used for the "المصدر الأصلي" preview column.
   * IMMUTABLE — never modified after extraction.
   */
  sourceSnapshot: string;

  /**
   * SHA-256 of `sourceSnapshot.trim()`.
   * Proves source document integrity.
   * Independent from canonicalQuestionHash — never compare these two.
   */
  sourceRawHash: string;

  /**
   * SHA-256 of canonicalizeQuestion({ questionText, options, correctIndex }).
   * Proves structured question stability at render time.
   * Verified at render: computeCanonicalHash(stored) === stored.canonicalQuestionHash
   */
  canonicalQuestionHash: string;

  /**
   * When true, ExactQuizRunner MUST render `originalText` exactly as stored.
   * When false (review_required), the UI shows a warning before rendering.
   */
  renderSourceExactly: boolean;

  /** Overall fidelity of this question's extraction */
  importFidelity: ImportFidelity;

  // ---- QUESTION CONTENT ----

  /** The question text (same as originalText for exact imports) */
  questionText: string;

  /** Answer choices in their original source order */
  options: string[];

  /**
   * The correct answer index (0-based).
   * Resolved from inline marking OR answer key section.
   */
  correctIndex: number;

  /**
   * The raw correct answer as it appeared in the source.
   * e.g., "B", "ب", "الخيار الثاني", "(C)", etc.
   * Stored separately from `correctIndex` to preserve source fidelity.
   */
  correctAnswerSource?: string;

  // ---- SOURCE REFERENCE ----

  sourceDocumentId: string;
  sourceDocumentName: string;

  /** 1-based page number in the source */
  sourcePage?: number;

  /** Section title if detectable (e.g., "Chapter 3", "الباب الأول") */
  sourceSection?: string;

  /** Question number as it appeared in the source (e.g., 5, "Q5", "السؤال 5") */
  sourceQuestionNumber?: number;

  // ---- EXTRACTION METADATA ----

  /** Overall extraction confidence (0–1) */
  extractionConfidence: number;

  /** Whether this question needs human review before use */
  requiresReview: boolean;

  /** Human-readable reason shown to the user */
  reviewReason?: string;

  /** True if the question text references an image, figure, chart, etc. */
  mediaRequired: boolean;

  /** True if at least one associated media asset was successfully extracted */
  mediaExtracted: boolean;

  /** References to MediaAsset entries in IndexedDB */
  mediaRefs: QuestionMediaRef[];

  /** Overall extraction status for the preview UI */
  status: ExtractionStatus;

  /** Whether the user has explicitly verified this question in preview */
  isVerified: boolean;

  // ---- OPTIONAL METADATA ----

  topic?: string;
  explanation?: string;
}

// ---------------------------------------------------------------------------
// Import Preview & Result
// ---------------------------------------------------------------------------

export interface ImportPreviewSummary {
  total: number;
  ready: number;
  needsReview: number;
  mediaRequired: number;
  mediaExtracted: number;
  noAnswer: number;
  exact: number;
  /** Number of duplicate question groups detected (non-destructive — not removed) */
  duplicatesDetected: number;
}

import type { DuplicateGroup } from "../learning/question-integrity";

export interface ExactImportResult {
  questions: ImportedQuestion[];
  preview: ImportPreviewSummary;
  documentId: string;
  documentName: string;
  pageCount: number;
  layoutResult?: DocumentLayoutResult;
  /** Detected duplicates reported for user review — not removed */
  duplicates: DuplicateGroup[];
}

export interface ExactImportProgress {
  stage:
    | "uploading"
    | "extracting_layout"
    | "detecting_boundaries"
    | "associating_media"
    | "resolving_answers"
    | "computing_hashes"
    | "validating"
    | "done"
    | "error";
  message: string;
  /** 0–100 */
  progress: number;
}
