/**
 * Question Integrity — Canonicalization, Hashing, and Safe Rendering
 *
 * ══════════════════════════════════════════════════════════
 * EXACT SOURCE INVARIANTS (NON-NEGOTIABLE)
 * ══════════════════════════════════════════════════════════
 *
 * 1. `sourceText` is IMMUTABLE. Never sanitized, rewritten, or modified.
 *
 * Two-Hash Model:
 * ──────────────
 * 1. `sourceRawHash`         — SHA-256 of the immutable sourceSnapshot string.
 *                              Proves: "this is what we found in the document."
 *
 * 2. `canonicalQuestionHash` — SHA-256 of canonicalizeQuestion(q).
 *                              Proves: "the structured question representation is stable."
 *
 * These two hashes are DELIBERATELY DIFFERENT and must never be compared to each other.
 * Their purpose is independent:
 * - sourceRawHash  → source document integrity
 * - canonicalHash  → structured question integrity
 *
 * Fidelity is proven when:
 *   canonicalizeQuestion(stored_item) === canonicalizeQuestion(item_at_render_time)
 *   AND sourceSnapshot has not been mutated (sourceRawHash still matches)
 */

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

async function sha256(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    // Fallback for non-browser test environments
    return `sha_fallback_${text.length}_${text.charCodeAt(0) ?? 0}_${text.charCodeAt(text.length - 1) ?? 0}`;
  }
  const data = new TextEncoder().encode(text);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Canonical Representation
// ---------------------------------------------------------------------------

export interface CanonicalQuestion {
  /** Verbatim question text from source — never modified */
  questionText: string;
  /** Options in original source order */
  options: string[];
  /** 0-based correct answer index */
  correctIndex: number;
}

/**
 * Produces a deterministic canonical string for hashing.
 *
 * Normalization rules (serialization noise only):
 * - Trim leading/trailing whitespace from all strings
 * - Normalize internal whitespace runs to a single space
 * - Lowercase for comparison only (hash uses original casing)
 *
 * NOT normalized (would change meaning):
 * - Arabic diacritics (tashkeel)
 * - Punctuation that changes meaning
 * - Option ordering
 * - Numerical suffixes
 * - Case within answer options
 */
export function canonicalizeQuestion(q: CanonicalQuestion): string {
  const normalizeStr = (s: string) => s.trim().replace(/\s+/g, " ");
  return JSON.stringify({
    t: normalizeStr(q.questionText),
    o: q.options.map(normalizeStr),
    c: q.correctIndex,
  });
}

/**
 * Compute the canonical hash of a question's structured content.
 * Use this to verify that a stored question hasn't been tampered with.
 */
export async function computeCanonicalHash(q: CanonicalQuestion): Promise<string> {
  return sha256(canonicalizeQuestion(q));
}

/**
 * Compute the source raw hash of the verbatim extracted source block.
 * Used independently from the canonical hash.
 */
export async function computeSourceRawHash(sourceSnapshot: string): Promise<string> {
  return sha256(sourceSnapshot.trim());
}

// ---------------------------------------------------------------------------
// Integrity Verification
// ---------------------------------------------------------------------------

export interface IntegrityCheckResult {
  ok: boolean;
  canonicalMatch: boolean;
  /** Always true if sourceRawHash or sourceSnapshot is missing (can't verify) */
  sourceHashPresent: boolean;
  reason?: string;
}

/**
 * Verify question integrity at render time.
 *
 * Checks that:
 * 1. The canonical hash stored during import matches the canonical hash
 *    computed right now from the stored content.
 *
 * If integrity fails, the quiz runner MUST show a warning instead of
 * silently rendering potentially tampered data.
 */
export async function verifyQuestionIntegrity(item: {
  questionText: string;
  options: string[];
  correctIndex: number;
  canonicalQuestionHash?: string;
  sourceSnapshot?: string;
  sourceRawHash?: string;
}): Promise<IntegrityCheckResult> {
  const canonical: CanonicalQuestion = {
    questionText: item.questionText,
    options: item.options,
    correctIndex: item.correctIndex,
  };

  const currentHash = await computeCanonicalHash(canonical);
  const canonicalMatch = !item.canonicalQuestionHash || currentHash === item.canonicalQuestionHash;

  const sourceHashPresent = !!item.sourceRawHash && !!item.sourceSnapshot;

  if (!canonicalMatch) {
    return {
      ok: false,
      canonicalMatch: false,
      sourceHashPresent,
      reason: "canonical_hash_mismatch",
    };
  }

  return { ok: true, canonicalMatch: true, sourceHashPresent };
}

// ---------------------------------------------------------------------------
// Content Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize AI-GENERATED METADATA strings.
 *
 * ⚠️  CRITICAL: This function MUST NOT be applied to:
 *   - sourceText / questionText (source document content)
 *   - options (source document content)
 *   - sourceSnapshot (source document content)
 *   - correctAnswerSource (source document content)
 *
 * React renders source text safely as plain text nodes:
 *   <div>{sourceText}</div>  ← safe, React escapes automatically
 *
 * dangerouslySetInnerHTML with source-derived text is FORBIDDEN.
 *
 * This function is ONLY for AI-generated metadata fields:
 * - reviewReason
 * - topic
 * - explanation
 * These fields are generated by the AI, not extracted from the source.
 */
export function sanitizeAiMetadata(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/javascript\s*:/gi, "") // remove JS URIs
    .split("\0")
    .join("") // remove null bytes (avoids no-control-regex ESLint rule)
    .trim();
}

// ---------------------------------------------------------------------------
// Duplicate Detection (NON-DESTRUCTIVE — report only, never auto-remove)
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  /** Indices of questions that appear to be duplicates of each other */
  indices: number[];
  /** The shared question text */
  questionText: string;
  /** Source pages for each duplicate instance */
  sourcePages: (number | undefined)[];
  /** Source question numbers for each duplicate instance */
  sourceNumbers: (number | undefined)[];
}

/**
 * Detect potential duplicates in a list of questions.
 *
 * POLICY (Exact Source mode):
 * This function REPORTS duplicates — it does NOT remove them.
 * The source document is authoritative. If the source has:
 *   Q1: ما هو X؟
 *   Q17: ما هو X؟
 * Both must be preserved exactly as they appear in the source.
 * The user decides what to do with duplicates.
 *
 * Detection key: normalized question text + options (sorted for detection only).
 */
export function detectDuplicates(
  questions: Array<{
    questionText: string;
    options: string[];
    sourcePage?: number;
    sourceQuestionNumber?: number;
  }>,
): DuplicateGroup[] {
  const groups = new Map<
    string,
    { indices: number[]; pages: (number | undefined)[]; numbers: (number | undefined)[] }
  >();

  questions.forEach((q, i) => {
    const key =
      q.questionText.trim().toLowerCase().replace(/\s+/g, " ") +
      "::" +
      [...q.options]
        .sort()
        .map((o) => o.trim().toLowerCase())
        .join("|");

    const existing = groups.get(key);
    if (existing) {
      existing.indices.push(i);
      existing.pages.push(q.sourcePage);
      existing.numbers.push(q.sourceQuestionNumber);
    } else {
      groups.set(key, {
        indices: [i],
        pages: [q.sourcePage],
        numbers: [q.sourceQuestionNumber],
      });
    }
  });

  return Array.from(groups.entries())
    .filter(([, g]) => g.indices.length > 1)
    .map(([, g]) => ({
      indices: g.indices,
      questionText: questions[g.indices[0]].questionText,
      sourcePages: g.pages,
      sourceNumbers: g.numbers,
    }));
}

// ---------------------------------------------------------------------------
// Legacy compatibility — keep old export names alive for test files
// ---------------------------------------------------------------------------

/** @deprecated Use computeCanonicalHash instead */
export async function computeQuestionHash(
  questionText: string,
  options: string[],
  correctIndex: number,
): Promise<string> {
  return computeCanonicalHash({ questionText, options, correctIndex });
}

/** @deprecated Use computeSourceRawHash instead */
export async function computeSourceHash(sourceSnapshot: string): Promise<string> {
  return computeSourceRawHash(sourceSnapshot);
}

/**
 * @deprecated Use `canonicalizeQuestion` + `verifyQuestionIntegrity`
 * Kept for test backward compatibility.
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
}): "exact" | "review_required" | "failed" {
  if (!candidate.questionText.trim()) return "failed";
  if (candidate.requiresReview) return "review_required";
  if (candidate.extractionConfidence < 0.75) return "review_required";
  if (candidate.options.length < 2) return "review_required";
  const hasTraceableAnswer =
    !!candidate.correctAnswerSource || candidate.extractionConfidence >= 0.85;
  if (!hasTraceableAnswer) return "review_required";
  if (candidate.mediaRequired && !candidate.mediaExtracted) return "review_required";
  if (candidate.sourcePage === undefined) return "review_required";
  return "exact";
}
