/**
 * Neon PostgreSQL & R2 Storage Persistence Integration Tests
 *
 * Verifies:
 * 1. Database connectivity & repository CRUD operations
 * 2. Exact Source fidelity, two-hash integrity, and media preservation
 * 3. R2 object storage abstraction (upload, download, delete, url)
 * 4. Quiz attempt recording and answer relationship integrity
 * 5. Learner mastery aggregation and retention
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch {
    // Ignore env loading error
  }
}
import { documentsRepo } from "../src/lib/db/repositories/documents.repo.ts";
import { questionsRepo } from "../src/lib/db/repositories/questions.repo.ts";
import { quizzesRepo } from "../src/lib/db/repositories/quizzes.repo.ts";
import { masteryRepo } from "../src/lib/db/repositories/mastery.repo.ts";
import { profilesRepo } from "../src/lib/db/repositories/profiles.repo.ts";
import { uploadFile, downloadFile, deleteFile, getFileUrl } from "../src/lib/storage/r2-storage.ts";
import type { QuestionBankItem } from "../src/lib/learning/question-bank.ts";

// Test session ID (UUID v4)
const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
const TEST_DOC_ID = "00000000-0000-4000-8000-000000000002";

describe("Neon PostgreSQL & R2 Storage Persistence", () => {
  before(async () => {
    // Ensure test user profile exists
    await profilesRepo.ensureProfile(TEST_USER_ID, "مستخدم الاختبار");
  });

  after(async () => {
    // Cleanup created test records
    try {
      await documentsRepo.deleteDocument(TEST_DOC_ID);
    } catch {
      // Ignore cleanup errors
    }
  });

  test("R2 Storage: uploadFile, downloadFile, getFileUrl, and deleteFile", async () => {
    const testKey = `test/sample_${Date.now()}.txt`;
    const payload = "Quizy persistent document test payload in R2 storage";
    const mimeType = "text/plain";

    // 1. Upload
    const uploadRes = await uploadFile(testKey, payload, mimeType);
    assert.equal(uploadRes.key, testKey);
    assert.equal(uploadRes.mimeType, mimeType);
    assert.ok(uploadRes.sizeBytes > 0);

    // 2. URL
    const url = getFileUrl(testKey);
    assert.ok(url.includes(encodeURIComponent(testKey)));

    // 3. Download
    const downloadRes = await downloadFile(testKey);
    assert.ok(downloadRes !== null);
    const text = new TextDecoder().decode(downloadRes!.data);
    assert.equal(text, payload);
    assert.equal(downloadRes!.mimeType, mimeType);

    // 4. Delete
    await deleteFile(testKey);
    const afterDelete = await downloadFile(testKey);
    assert.equal(afterDelete, null);
  });

  test("Documents Repository: create, read, and delete document record", async () => {
    const doc = await documentsRepo.createDocument({
      id: TEST_DOC_ID,
      userId: TEST_USER_ID,
      title: "وثيقة اختبار كويزي",
      fileName: "test-lecture.pdf",
      fileSizeBytes: 10240,
      fileType: "application/pdf",
      storageKey: "documents/test-lecture.pdf",
      pageCount: 5,
      extractedText: "محتوى تعليمي للاختبار",
      summary: "ملخص وثيقة الاختبار",
      dominantLanguage: "ar",
    });

    assert.equal(doc.id, TEST_DOC_ID);
    assert.equal(doc.title, "وثيقة اختبار كويزي");
    assert.equal(doc.storage_key, "documents/test-lecture.pdf");
    assert.equal(doc.page_count, 5);

    const fetched = await documentsRepo.getDocumentById(TEST_DOC_ID);
    assert.ok(fetched !== null);
    assert.equal(fetched!.title, "وثيقة اختبار كويزي");
    assert.equal(fetched!.file_name, "test-lecture.pdf");
  });

  test("Exact Source Questions: full fidelity and two-hash preservation", async () => {
    const exactQuestion: QuestionBankItem = {
      id: "qb_exact_test_12345",
      question: "ما هو المبدأ الأساسي للتعلم المتباعد؟",
      options: [
        "تكرار المراجعة على فترات متباعدة تدريجياً",
        "حفظ المادة في ليلة الامتحان",
        "القراءة السريعة دون تلخيص",
        "تجنب حل التمارين",
      ],
      correctIndex: 0,
      explanation: "التعلم المتباعد يعزز استرجاع الذاكرة طويلة المدى وفق منحنى النسيان.",
      topic: "علم النفس المعرفي",
      difficulty: "medium",
      bloomLevel: "remember",
      sourceDocumentName: "علم_النفس.pdf",
      sourceDocumentId: TEST_DOC_ID,
      sourcePage: 14,
      sourceSection: "الفصل الثاني: الذاكرة",
      sourceQuestionNumber: 7,
      importMode: "exact_source",
      importFidelity: "exact",
      originalText: "س7: ما هو المبدأ الأساسي للتعلم المتباعد؟ أ) تكرار المراجعة...",
      sourceSnapshot: "س7: ما هو المبدأ الأساسي للتعلم المتباعد؟\nأ) تكرار المراجعة\nب) حفظ المادة",
      sourceRawHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      canonicalQuestionHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      renderSourceExactly: true,
      correctAnswerSource: "أ",
      requiresReview: false,
      mediaRefs: [
        {
          mediaId: "media_img_001",
          sourcePage: 14,
          label: "مخطط منحنى النسيان",
          placement: "above",
        },
      ],
      status: "approved",
      createdAt: Date.now(),
      tags: ["علم النفس المعرفي", "exact_source"],
    };

    // 1. Save to Neon
    const saved = await questionsRepo.saveQuestion(exactQuestion);
    assert.ok(saved.id);
    assert.equal(saved.question, exactQuestion.question);
    assert.equal(saved.importMode, "exact_source");
    assert.equal(saved.importFidelity, "exact");
    assert.equal(saved.originalText, exactQuestion.originalText);
    assert.equal(saved.sourceSnapshot, exactQuestion.sourceSnapshot);
    assert.equal(saved.sourceRawHash, exactQuestion.sourceRawHash);
    assert.equal(saved.canonicalQuestionHash, exactQuestion.canonicalQuestionHash);
    assert.equal(saved.renderSourceExactly, true);
    assert.equal(saved.correctAnswerSource, "أ");
    assert.equal(saved.sourcePage, 14);
    assert.equal(saved.sourceQuestionNumber, 7);
    assert.equal(saved.mediaRefs?.length, 1);
    assert.equal(saved.mediaRefs?.[0].mediaId, "media_img_001");

    // 2. Fetch by canonical hash
    const byHash = await questionsRepo.findByCanonicalHash(exactQuestion.canonicalQuestionHash!);
    assert.ok(byHash !== null);
    assert.equal(byHash!.canonicalQuestionHash, exactQuestion.canonicalQuestionHash);
    assert.equal(byHash!.sourceRawHash, exactQuestion.sourceRawHash);

    // 3. Cleanup test question
    await questionsRepo.deleteQuestion(saved.id);
  });

  test("Quiz Attempts Repository: records attempt and answers", async () => {
    // First save a question to attach to answer
    const q = await questionsRepo.saveQuestion({
      id: "qb_temp_test_quiz_attempt",
      question: "سؤال تجريبي لاختبار المحاولات",
      options: ["خيار 1", "خيار 2"],
      correctIndex: 0,
      explanation: "شرح",
      topic: "تجريبي",
      difficulty: "easy",
      bloomLevel: "remember",
      sourceDocumentName: "اختبار.pdf",
      importMode: "ai_generated",
      status: "validated",
      createdAt: Date.now(),
      tags: ["تجريبي"],
    });

    const result = await quizzesRepo.recordAttempt({
      userId: TEST_USER_ID,
      documentId: TEST_DOC_ID,
      totalQuestions: 1,
      score: 1,
      percentage: 100,
      answers: [
        {
          questionId: q.id,
          selectedIndex: 0,
          isCorrect: true,
          timeTakenSeconds: 15,
        },
      ],
    });

    assert.ok(result.id);

    const attempts = await quizzesRepo.getAttempts(TEST_USER_ID);
    assert.ok(attempts.length > 0);
    const lastAttempt = attempts.find((a) => a.id === result.id);
    assert.ok(lastAttempt);
    assert.equal(lastAttempt.score, 1);
    assert.equal(lastAttempt.percentage, 100);

    // Cleanup
    await questionsRepo.deleteQuestion(q.id);
  });

  test("Learner Mastery Repository: records topic mastery and retains progress", async () => {
    await masteryRepo.upsertTopicMastery(
      TEST_USER_ID,
      "البرمجة بلغة تايب سكريبت",
      8,
      10,
      80,
      "mastered",
    );

    const mastery = await masteryRepo.getLearnerMastery(TEST_USER_ID);
    assert.ok(mastery["البرمجة بلغة تايب سكريبت"]);
    assert.equal(mastery["البرمجة بلغة تايب سكريبت"].correctCount, 8);
    assert.equal(mastery["البرمجة بلغة تايب سكريبت"].totalAttempts, 10);
    assert.equal(mastery["البرمجة بلغة تايب سكريبت"].masteryScore, 80);
    assert.equal(mastery["البرمجة بلغة تايب سكريبت"].status, "mastered");
  });
});
