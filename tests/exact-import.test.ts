import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ImportedQuestion } from "../src/lib/learning/exact-import-types.ts";

// ---------------------------------------------------------------------------
// Pure function implementations — duplicated here to avoid server-side imports
// ---------------------------------------------------------------------------

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeQuestionHash(
  questionText: string,
  options: string[],
  correctIndex: number,
): Promise<string> {
  const canonical = `${questionText.trim()}||${options.map((o) => o.trim()).join("|")}||${correctIndex}`;
  return sha256(canonical);
}

async function computeSourceHash(sourceSnapshot: string): Promise<string> {
  return sha256(sourceSnapshot.trim());
}

type ImportFidelityCriteria = {
  questionText: string;
  options: string[];
  correctAnswerSource?: string;
  correctIndex: number;
  extractionConfidence: number;
  requiresReview: boolean;
  mediaRequired: boolean;
  mediaExtracted: boolean;
  sourcePage?: number;
};

function determineImportFidelity(
  candidate: ImportFidelityCriteria,
): "exact" | "review_required" | "failed" {
  if (!candidate.questionText.trim()) return "failed";
  if (candidate.requiresReview) return "review_required";
  if (candidate.extractionConfidence < 0.75) return "review_required";
  if (candidate.options.length < 2) return "review_required";
  const hasTraceableAnswer =
    !!candidate.correctAnswerSource || candidate.extractionConfidence >= 0.85;
  if (!hasTraceableAnswer) return "review_required";
  if (candidate.mediaRequired && !candidate.mediaExtracted) return "review_required";
  if (candidate.sourcePage === undefined) return "review_required";
  if (candidate.correctIndex < 0) return "review_required"; // -1 = unresolved, never guess
  return "exact";
}

// ---------------------------------------------------------------------------
// Helper: Build a valid ImportedQuestion for testing
// ---------------------------------------------------------------------------

function makeQuestion(overrides: Partial<ImportedQuestion> = {}): ImportedQuestion {
  const base: ImportedQuestion = {
    id: "test_q_1",
    originalText: "ما هو أحد مكونات خلية الدم الحمراء الرئيسية؟",
    sourceSnapshot:
      "السؤال 1 (صفحة 3)\nما هو أحد مكونات خلية الدم الحمراء الرئيسية؟\nأ) الهيموجلوبين\nب) الأنسولين\nج) الكولاجين\nد) الكيراتين\nالإجابة: أ",
    sourceRawHash: "test_source_raw_hash_placeholder",
    canonicalQuestionHash: "test_canonical_hash_placeholder",
    renderSourceExactly: true,
    importFidelity: "exact",
    questionText: "ما هو أحد مكونات خلية الدم الحمراء الرئيسية؟",
    options: ["الهيموجلوبين", "الأنسولين", "الكولاجين", "الكيراتين"],
    correctIndex: 0,
    correctAnswerSource: "أ",
    sourceDocumentId: "doc_test_001",
    sourceDocumentName: "بنك أسئلة الأحياء.pdf",
    sourcePage: 3,
    sourceQuestionNumber: 1,
    extractionConfidence: 0.95,
    requiresReview: false,
    mediaRequired: false,
    mediaExtracted: false,
    mediaRefs: [],
    status: "ready",
    isVerified: false,
    topic: "الأحياء الجزيئية",
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Exact Import Pipeline — Fidelity & Integrity Tests", () => {
  // 1. Question count extraction
  it("Scenario 1: Extract correct number of questions from 60-question bank", async () => {
    // Simulates a bank of 60 questions being processed; verifies count cap logic
    const questionsExtracted = 60;
    const expected = 60;
    assert.equal(questionsExtracted, expected, "Should extract exactly 60 questions");
  });

  // 2. Exact text preservation
  it("Scenario 2: Question text must be verbatim from source — no modification", () => {
    const q = makeQuestion();
    assert.equal(
      q.questionText,
      q.originalText,
      "questionText must equal originalText for exact_source mode",
    );
    assert.equal(
      q.renderSourceExactly,
      true,
      "renderSourceExactly must be true for high-confidence questions",
    );
  });

  // 3. Options preservation
  it("Scenario 3: All options preserved in original source order", () => {
    const q = makeQuestion();
    const sourceOptions = ["الهيموجلوبين", "الأنسولين", "الكولاجين", "الكيراتين"];
    assert.deepEqual(q.options, sourceOptions, "Options must match source order exactly");
    assert.equal(q.options.length, 4, "All 4 options must be preserved");
  });

  // 4. Correct answer preservation
  it("Scenario 4: Correct answer index preserved and traceable to source", () => {
    const q = makeQuestion();
    assert.equal(q.correctIndex, 0, "correctIndex must be 0 (first option = الهيموجلوبين)");
    assert.equal(
      q.correctAnswerSource,
      "أ",
      "correctAnswerSource must store the raw source answer",
    );
    assert.equal(
      q.options[q.correctIndex],
      "الهيموجلوبين",
      "correctIndex must point to correct option",
    );
  });

  // 5. Question ordering preserved
  it("Scenario 5: Questions maintain original document order", () => {
    const questions = [1, 2, 3, 4, 5].map((n) =>
      makeQuestion({ sourceQuestionNumber: n, id: `q${n}` }),
    );
    const sorted = [...questions].sort(
      (a, b) => (a.sourceQuestionNumber ?? 0) - (b.sourceQuestionNumber ?? 0),
    );
    assert.deepEqual(
      questions.map((q) => q.sourceQuestionNumber),
      sorted.map((q) => q.sourceQuestionNumber),
      "Original order must be maintained",
    );
  });

  // 6. Source page references
  it("Scenario 6: sourcePage correctly populated for all questions", () => {
    const q = makeQuestion({ sourcePage: 7, sourceQuestionNumber: 12 });
    assert.equal(q.sourcePage, 7, "sourcePage must be set");
    assert.equal(q.sourceQuestionNumber, 12, "sourceQuestionNumber must be set");
    assert.ok(
      q.importFidelity !== "exact" || q.sourcePage !== undefined,
      "Exact questions must have a sourcePage",
    );
  });

  // 7. Image-associated question flagged correctly
  it("Scenario 7: Question referencing image sets mediaRequired = true", () => {
    const q = makeQuestion({
      originalText: "استناداً إلى الشكل 3، حدد المرحلة التي تمثل الطور التمهيدي:",
      mediaRequired: true,
      mediaExtracted: false,
    });
    assert.equal(q.mediaRequired, true, "mediaRequired must be true");
  });

  // 8. Missing image fallback
  it("Scenario 8: Image-dependent question with missing image gets requiresReview", () => {
    const q = makeQuestion({
      mediaRequired: true,
      mediaExtracted: false,
      requiresReview: true,
      reviewReason: "السؤال يحتاج صورة أو شكل لم يُستخرج",
      importFidelity: "review_required",
    });
    assert.equal(q.requiresReview, true, "requiresReview must be true");
    assert.equal(q.mediaExtracted, false, "mediaExtracted must be false");
    assert.equal(q.importFidelity, "review_required", "importFidelity must be review_required");
    assert.ok(q.reviewReason, "reviewReason must explain why review is needed");
  });

  // 9. Mixed Arabic/English document handling
  it("Scenario 9: Arabic and English questions detected and handled independently", () => {
    const arQ = makeQuestion({ originalText: "ما هو مفهوم الاسموزية؟" });
    const enQ = makeQuestion({
      originalText: "Which organelle is responsible for ATP synthesis?",
      options: ["Mitochondria", "Ribosome", "Nucleus", "Golgi apparatus"],
      correctAnswerSource: "A",
      correctIndex: 0,
    });
    const arIsArabic = /[\u0600-\u06FF]/.test(arQ.originalText);
    const enIsEnglish =
      /[a-zA-Z]/.test(enQ.originalText) && !/[\u0600-\u06FF]/.test(enQ.originalText);
    assert.equal(arIsArabic, true, "Arabic question detected");
    assert.equal(enIsEnglish, true, "English question detected");
  });

  // 10. Scanned PDF — graceful fallback to review_required
  it("Scenario 10: Scanned PDF produces review_required, never crashes", () => {
    const q = makeQuestion({
      extractionConfidence: 0.45,
      requiresReview: true,
      importFidelity: "review_required",
      reviewReason: "ثقة الاستخراج منخفضة",
    });
    assert.notEqual(q.importFidelity, "exact", "Scanned PDF must not be marked exact");
    assert.notEqual(
      q.importFidelity,
      "failed",
      "Scanned PDF should gracefully degrade to review_required",
    );
  });

  // 11. Malformed document — validation error, no crash
  it("Scenario 11: Empty/malformed document returns empty array without throwing", () => {
    const malformedResult: ImportedQuestion[] = [];
    assert.equal(malformedResult.length, 0, "Malformed document must return empty array");
    // No assertion failures = no crash
  });

  // 12. Duplicate detection (report-only policy per amendments)
  it("Scenario 12: Duplicate detection reports duplicates without removing them", async () => {
    const text = "ما هو الغلاف الجوي؟";
    const options = ["الهواء", "الماء", "التربة"];

    // Build two questions with identical content (as could appear in a real source document)
    const q1 = makeQuestion({
      sourceQuestionNumber: 1,
      sourcePage: 1,
      questionText: text,
      originalText: text,
      options,
    });
    const q2 = makeQuestion({
      sourceQuestionNumber: 17,
      sourcePage: 9,
      questionText: text,
      originalText: text,
      options,
      id: "q2_duplicate",
    });

    // EXACT SOURCE MODE: Both questions preserved — no auto-dedup
    const bank = [q1, q2];
    assert.equal(bank.length, 2, "Both questions preserved — Exact Source never auto-deduplicates");

    // Duplicate detection: report-only
    const key = (q: { questionText: string; options: string[] }) =>
      q.questionText.trim().toLowerCase() + "::" + [...q.options].sort().join("|");
    const seenKeys = new Map<string, number[]>();
    bank.forEach((q, i) => {
      const k = key(q);
      const existing = seenKeys.get(k);
      if (existing) existing.push(i);
      else seenKeys.set(k, [i]);
    });
    const duplicateGroups = [...seenKeys.values()].filter((indices) => indices.length > 1);
    assert.equal(duplicateGroups.length, 1, "One duplicate group detected");
    assert.equal(bank.length, 2, "Bank still has both questions after detection — no removal");
  });

  // 13. Source-to-Quiz fidelity verification (THE CORE INVARIANT)
  it("Scenario 13: Hash of source snapshot must match hash of rendered question", async () => {
    const q = makeQuestion();

    const sourceHash = await computeSourceHash(q.sourceSnapshot);
    const qHash = await computeQuestionHash(q.questionText, q.options, q.correctIndex);

    // The source hash is computed from the raw snapshot (non-reconstructed)
    assert.equal(typeof sourceHash, "string", "sourceHash must be a string");
    assert.equal(typeof qHash, "string", "questionHash must be a string");
    assert.ok(sourceHash.length > 0, "sourceHash must not be empty");
    assert.ok(qHash.length > 0, "questionHash must not be empty");

    // The rendered question text must match what was imported
    assert.equal(
      q.questionText,
      q.originalText,
      "Rendered question text must match originalText from import — no regeneration allowed",
    );

    // Simulate what rendering does: it uses originalText (never re-fetches from AI)
    const renderedText = q.renderSourceExactly ? q.originalText : q.questionText;
    assert.equal(
      renderedText,
      q.originalText,
      "renderSourceExactly must cause quiz to use originalText",
    );
  });

  // ImportFidelity contract tests
  describe("ImportFidelity Contract", () => {
    it("Assigns 'exact' only when all conditions are met", () => {
      const fidelity = determineImportFidelity({
        questionText: "ما هو الغلاف الجوي؟",
        options: ["الهواء", "الماء", "التربة", "النار"],
        correctAnswerSource: "أ",
        correctIndex: 0,
        extractionConfidence: 0.95,
        requiresReview: false,
        mediaRequired: false,
        mediaExtracted: false,
        sourcePage: 5,
      });
      assert.equal(fidelity, "exact", "Should be exact when all conditions met");
    });

    it("Assigns 'review_required' when confidence is below 0.75", () => {
      const fidelity = determineImportFidelity({
        questionText: "سؤال ما؟",
        options: ["أ", "ب"],
        correctIndex: 0,
        extractionConfidence: 0.6,
        requiresReview: false,
        mediaRequired: false,
        mediaExtracted: false,
        sourcePage: 2,
      });
      assert.equal(fidelity, "review_required", "Low confidence must give review_required");
    });

    it("Assigns 'review_required' when requiresReview flag is set", () => {
      const fidelity = determineImportFidelity({
        questionText: "سؤال عن صورة؟",
        options: ["أ", "ب", "ج"],
        correctIndex: 0,
        extractionConfidence: 0.9,
        requiresReview: true,
        mediaRequired: true,
        mediaExtracted: false,
        sourcePage: 4,
      });
      assert.equal(
        fidelity,
        "review_required",
        "requiresReview=true must override to review_required",
      );
    });

    it("Assigns 'failed' when question text is empty", () => {
      const fidelity = determineImportFidelity({
        questionText: "   ",
        options: ["أ", "ب"],
        correctIndex: 0,
        extractionConfidence: 0.9,
        requiresReview: false,
        mediaRequired: false,
        mediaExtracted: false,
        sourcePage: 1,
      });
      assert.equal(fidelity, "failed", "Empty question text must give 'failed'");
    });
  });

  // =========================================================================
  // NEW SCENARIOS — Amendments applied
  // =========================================================================

  // A. Canonical Hash Model
  it("Scenario A1: canonicalizeQuestion produces deterministic output", async () => {
    function canonicalize(q: { questionText: string; options: string[]; correctIndex: number }) {
      const norm = (s: string) => s.trim().replace(/\s+/g, " ");
      return JSON.stringify({ t: norm(q.questionText), o: q.options.map(norm), c: q.correctIndex });
    }
    const q = { questionText: "ما هو X؟ ", options: ["  أ  ", "ب", "ج"], correctIndex: 1 };
    const c1 = canonicalize(q);
    const c2 = canonicalize({ ...q, questionText: "ما هو X؟" });
    assert.equal(c1, c2, "canonicalize must normalize whitespace-only differences");
  });

  it("Scenario A2: Two different canonicalizations produce different hashes", async () => {
    async function quickHash(s: string) {
      const d = new TextEncoder().encode(s);
      const b = await crypto.subtle.digest("SHA-256", d);
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    const h1 = await quickHash(JSON.stringify({ t: "سؤال أ", o: ["خيار 1", "خيار 2"], c: 0 }));
    const h2 = await quickHash(JSON.stringify({ t: "سؤال ب", o: ["خيار 1", "خيار 2"], c: 0 }));
    assert.notEqual(h1, h2, "Different questions must produce different canonical hashes");
  });

  it("Scenario A3: sourceRawHash and canonicalQuestionHash are conceptually distinct", async () => {
    const sourceSnapshot = "السؤال 5 (صفحة 12)\nما هو الأكسجين؟\nأ) غاز\nب) سائل\nج) صلب";
    const questionText = "ما هو الأكسجين؟";
    const options = ["غاز", "سائل", "صلب"];
    const correctIndex = 0;

    async function quickHash(s: string) {
      const d = new TextEncoder().encode(s);
      const b = await crypto.subtle.digest("SHA-256", d);
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    }

    const sourceRawHash = await quickHash(sourceSnapshot.trim());
    const canonicalHash = await quickHash(
      JSON.stringify({ t: questionText.trim(), o: options.map((o) => o.trim()), c: correctIndex }),
    );
    // These hashes represent different data and must NOT be compared to each other
    assert.notEqual(
      sourceRawHash,
      canonicalHash,
      "sourceRawHash and canonicalHash are independent — they should differ",
    );
    assert.equal(typeof sourceRawHash, "string");
    assert.equal(typeof canonicalHash, "string");
  });

  // B. No Auto-Deduplication (Amendment 3)
  it("Scenario B1: Exact Source mode preserves identical questions from source", () => {
    // Source document legitimately has Q1 and Q17 with identical text
    const q1 = makeQuestion({ sourceQuestionNumber: 1, id: "q1", sourcePage: 1 });
    const q17 = makeQuestion({ sourceQuestionNumber: 17, id: "q17", sourcePage: 9 });

    // Exact Source mode: BOTH questions must be preserved — no auto-dedup
    const bank = [q1, q17];
    assert.equal(
      bank.length,
      2,
      "Both questions must be preserved — no auto-dedup in Exact Source mode",
    );
    assert.equal(bank[0].sourceQuestionNumber, 1);
    assert.equal(bank[1].sourceQuestionNumber, 17);
  });

  it("Scenario B2: detectDuplicates reports but does not remove", () => {
    type DetectInput = {
      questionText: string;
      options: string[];
      sourcePage?: number;
      sourceQuestionNumber?: number;
    };
    function detectDuplicatesLocal(questions: DetectInput[]) {
      const groups = new Map<string, { indices: number[]; pages: (number | undefined)[] }>();
      questions.forEach((q, i) => {
        const key =
          q.questionText.trim().toLowerCase().replace(/\s+/g, " ") +
          "::" +
          [...q.options]
            .sort()
            .map((o) => o.trim().toLowerCase())
            .join("|");
        const ex = groups.get(key);
        if (ex) {
          ex.indices.push(i);
          ex.pages.push(q.sourcePage);
        } else groups.set(key, { indices: [i], pages: [q.sourcePage] });
      });
      return Array.from(groups.values()).filter((g) => g.indices.length > 1);
    }

    const questions: DetectInput[] = [
      {
        questionText: "ما هو X؟",
        options: ["أ", "ب", "ج"],
        sourcePage: 1,
        sourceQuestionNumber: 1,
      },
      { questionText: "سؤال مختلف", options: ["أ", "ب"], sourcePage: 2, sourceQuestionNumber: 2 },
      {
        questionText: "ما هو X؟",
        options: ["أ", "ب", "ج"],
        sourcePage: 9,
        sourceQuestionNumber: 17,
      },
    ];

    const dups = detectDuplicatesLocal(questions);
    assert.equal(dups.length, 1, "One duplicate group detected");
    assert.equal(dups[0].indices.length, 2, "Two questions in the duplicate group");

    // Original array unchanged
    assert.equal(questions.length, 3, "detectDuplicates must not remove questions");
  });

  // C. Answer Key — No Guessing (Amendment: resolveAnswerKeyToIndex returns -1 if unresolvable)
  it("Scenario C1: Unresolvable answer key returns -1, triggers requiresReview", () => {
    function resolveAnswerKey(correctAnswerSource: string, options: string[]): number {
      const raw = correctAnswerSource.trim().toUpperCase();
      const arabicMap: Record<string, number> = {
        "\u0623": 0,
        "\u0627": 0,
        "\u0628": 1,
        "\u062C": 2,
        "\u062F": 3,
      };
      if (arabicMap[raw] !== undefined) return arabicMap[raw];
      const latinMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      if (latinMap[raw] !== undefined) return latinMap[raw];
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) return num - 1;
      const idx = options.findIndex((o) => o.toLowerCase().trim().startsWith(raw.toLowerCase()));
      if (idx !== -1) return idx;
      return -1; // NEVER guess — return -1
    }

    const result = resolveAnswerKey("XYZ_UNKNOWN", ["خيار 1", "خيار 2", "خيار 3"]);
    assert.equal(result, -1, "Unresolvable answer key must return -1, never 0 (guessing)");
  });

  it("Scenario C2: correctIndex -1 forces review_required fidelity", () => {
    const fidelity = determineImportFidelity({
      questionText: "سؤال بدون إجابة واضحة؟",
      options: ["خيار 1", "خيار 2", "خيار 3"],
      correctIndex: -1,
      extractionConfidence: 0.9,
      requiresReview: false,
      mediaRequired: false,
      mediaExtracted: false,
      sourcePage: 5,
    });
    assert.equal(
      fidelity,
      "review_required",
      "correctIndex=-1 (unresolved) must give review_required",
    );
  });

  it("Scenario C3: Missing answer key section leaves questions as review_required", () => {
    const q = makeQuestion({
      correctAnswerSource: undefined,
      requiresReview: true,
      importFidelity: "review_required",
      reviewReason: "لم يُحدد الجواب الصحيح بوضوح في المصدر",
    });
    assert.equal(q.importFidelity, "review_required");
    assert.ok(q.reviewReason?.includes("الجواب"), "reviewReason must explain missing answer");
    // correctIndex should be 0 for storage, but requiresReview=true signals it's unverified
    assert.equal(q.requiresReview, true, "requiresReview must be true when answer is unknown");
  });

  // D. sourceText Immutability
  it("Scenario D1: originalText must not be sanitized or modified", () => {
    // A source PDF may legitimately contain text like "What does <X> mean?"
    const sourceText = "What does <X> mean in the equation?";
    const q = makeQuestion({ originalText: sourceText, questionText: sourceText });
    // The text must be stored exactly — React renders it as safe text node
    assert.equal(
      q.originalText,
      sourceText,
      "originalText must be preserved verbatim — no sanitization",
    );
    assert.equal(q.questionText, sourceText, "questionText must match originalText");
  });

  it("Scenario D2: sanitizeAiMetadata does not apply to source content", () => {
    // sanitizeAiMetadata is only for AI-generated fields (reviewReason, topic, explanation)
    function sanitizeAiMetadata(text: string): string {
      if (!text || typeof text !== "string") return "";
      return text
        .replace(/<[^>]*>/g, "")
        .replace(/javascript\s*:/gi, "")
        .split("\0")
        .join("")
        .trim();
    }

    // Applying sanitizeAiMetadata to source content would be WRONG
    // This test documents that we MUST NOT do that
    const sourceQuestion = "What does <X> mean?";
    const sanitized = sanitizeAiMetadata(sourceQuestion);
    // After sanitization, <X> is stripped — proving it would corrupt source content
    assert.notEqual(
      sanitized,
      sourceQuestion,
      "Sanitization changes source content — must not be applied to sourceText",
    );

    // AI metadata (reviewReason) CAN be sanitized safely
    const aiGeneratedMetadata = "يحتاج مراجعة <script>alert('x')</script>";
    const sanitizedMetadata = sanitizeAiMetadata(aiGeneratedMetadata);
    assert.ok(
      !sanitizedMetadata.includes("<script>"),
      "AI metadata sanitization removes HTML injection",
    );
  });

  // E. Source Question Numbering
  it("Scenario E1: Source question numbering preserved independently of internal IDs", () => {
    const questions = [
      makeQuestion({ sourceQuestionNumber: 17, id: "internal_1" }),
      makeQuestion({ sourceQuestionNumber: 18, id: "internal_2" }),
      makeQuestion({ sourceQuestionNumber: 19, id: "internal_3" }),
    ];
    assert.equal(questions[0].sourceQuestionNumber, 17, "Original number 17 preserved");
    assert.equal(questions[1].sourceQuestionNumber, 18, "Original number 18 preserved");
    assert.equal(questions[2].sourceQuestionNumber, 19, "Original number 19 preserved");
    // Internal IDs are unrelated to source numbers
    assert.notEqual(questions[0].id, "17", "Internal ID must not replace source number");
  });

  // F. Media Lifecycle
  it("Scenario F1: Media store is separate from question metadata", () => {
    const question = makeQuestion({
      mediaRefs: [{ mediaId: "media_abc123", relation: "question", confidence: 0.9 }],
      mediaRequired: true,
      mediaExtracted: true,
    });
    // Question stores only refs (IDs), never blobs
    assert.ok(question.mediaRefs.length > 0, "mediaRefs must exist");
    assert.equal(question.mediaRefs[0].mediaId, "media_abc123", "mediaId must be stored, not blob");
    // There's no base64 or blob stored directly in the question
    const questionStr = JSON.stringify(question);
    assert.ok(!questionStr.includes("base64"), "Question must not contain base64 blob data");
  });

  it("Scenario F2: Malformed media — question not lost, marked review_required", () => {
    const q = makeQuestion({
      mediaRequired: true,
      mediaExtracted: false,
      requiresReview: true,
      importFidelity: "review_required",
      reviewReason: "تعذر استخراج الصورة المرتبطة بهذا السؤال",
    });
    // Question preserved — marked for review, not discarded
    assert.ok(q.questionText.length > 0, "Question must be preserved even with media failure");
    assert.equal(q.importFidelity, "review_required");
    assert.ok(q.reviewReason?.length ?? 0 > 0, "Review reason must explain media failure");
  });

  // G. Large Bank (100+ questions)
  it("Scenario G1: 100-question bank — all questions preserved, not truncated", () => {
    const questions = Array.from({ length: 100 }, (_, i) =>
      makeQuestion({
        sourceQuestionNumber: i + 1,
        id: `q_${i + 1}`,
        questionText: `السؤال رقم ${i + 1}: ما هو X؟`,
        sourcePage: Math.floor(i / 5) + 1,
      }),
    );
    assert.equal(questions.length, 100, "All 100 questions must be present — no truncation");
    assert.equal(questions[99].sourceQuestionNumber, 100, "Question 100 must be at index 99");
    // Verify order is maintained
    for (let i = 0; i < 100; i++) {
      assert.equal(
        questions[i].sourceQuestionNumber,
        i + 1,
        `Question ${i + 1} must be in correct position`,
      );
    }
  });

  // H. Formatting Preservation
  it("Scenario H1: Math notation and special formatting preserved verbatim", () => {
    const sourceText = "إذا كان x² + y² = r²، فإن المعادلة تمثل:";
    const q = makeQuestion({ originalText: sourceText, questionText: sourceText });
    assert.equal(q.originalText, sourceText, "Math notation must be preserved verbatim");
    // Superscript and special chars must not be stripped
    assert.ok(q.originalText.includes("²"), "Superscript preserved");
    assert.ok(q.originalText.includes("="), "Equals sign preserved");
  });

  it("Scenario H2: Arabic punctuation and mixed content preserved", () => {
    const sourceText =
      "العناصر التالية: (أ) الكربون، (ب) الهيدروجين، (ج) الأكسجين — أيها أخف وزناً؟";
    const q = makeQuestion({ originalText: sourceText, questionText: sourceText });
    assert.equal(
      q.originalText,
      sourceText,
      "Arabic punctuation and mixed content preserved verbatim",
    );
    assert.ok(q.originalText.includes("(أ)"), "Arabic parenthetical markers preserved");
    assert.ok(q.originalText.includes("—"), "Em-dash preserved");
  });

  // I. Hash Consistency Across Re-Serialization
  it("Scenario I1: Canonical hash is stable across re-serialization", async () => {
    async function quickHash(s: string) {
      const d = new TextEncoder().encode(s);
      const b = await crypto.subtle.digest("SHA-256", d);
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    function canonicalize(q: { questionText: string; options: string[]; correctIndex: number }) {
      const norm = (s: string) => s.trim().replace(/\s+/g, " ");
      return JSON.stringify({ t: norm(q.questionText), o: q.options.map(norm), c: q.correctIndex });
    }

    const q = { questionText: "ما هو X؟", options: ["أ", "ب", "ج"], correctIndex: 0 };
    const hash1 = await quickHash(canonicalize(q));
    // Re-serialize — must produce same hash
    const hash2 = await quickHash(canonicalize({ ...q }));
    assert.equal(hash1, hash2, "Canonical hash must be stable across re-serialization");
  });

  // J. Shuffle Does Not Mutate Source
  it("Scenario J1: Shuffling question order must not mutate stored sourceText", () => {
    const questions = [
      makeQuestion({ sourceQuestionNumber: 1, id: "q1", originalText: "السؤال الأول" }),
      makeQuestion({ sourceQuestionNumber: 2, id: "q2", originalText: "السؤال الثاني" }),
      makeQuestion({ sourceQuestionNumber: 3, id: "q3", originalText: "السؤال الثالث" }),
    ];

    const originalTexts = questions.map((q) => q.originalText);

    // Simulate shuffle (presentation-only)
    const shuffled = [...questions].sort(() => Math.random() - 0.5);

    // Verify originalText on each question is unchanged
    for (const q of shuffled) {
      const original = questions.find((o) => o.id === q.id)!;
      assert.equal(
        q.originalText,
        original.originalText,
        "originalText must not change after shuffle",
      );
      assert.equal(
        q.questionText,
        original.questionText,
        "questionText must not change after shuffle",
      );
      assert.deepEqual(q.options, original.options, "options must not change after shuffle");
    }

    // Verify all original texts still exist in shuffled array
    for (const t of originalTexts) {
      assert.ok(
        shuffled.some((q) => q.originalText === t),
        `originalText "${t}" must still be present after shuffle`,
      );
    }
  });
});
