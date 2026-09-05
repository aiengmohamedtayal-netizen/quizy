import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuestionQuality } from "../src/lib/learning/quality-evaluator.ts";
import { deduplicateQuestions } from "../src/lib/ai/quiz-generator.ts";
import type { QuizQuestion } from "../src/lib/ai/schemas.ts";

describe("Multilingual Quiz Quality & Deduplication", () => {
  test("validates high quality Arabic question with proper grounding", () => {
    const q: QuizQuestion = {
      id: "ar_test_1",
      question: "ما هي العضية المسؤولة عن إنتاج الطاقة في الخلية؟",
      options: ["الميتوكوندريا", "جهاز جولجي", "الريبوسوم", "الفجوة العصارية"],
      correctIndex: 0,
      explanation: "الميتوكوندريا هي المسؤولة عن التنفس الخلوي وإنتاج ATP في الخلية.",
      topic: "علم الأحياء",
      difficulty: "easy",
      bloomLevel: "remember",
      evidenceQuote: "الميتوكوندريا هي المسؤولة عن إنتاج الطاقة",
    };

    const source = "تعد الميتوكوندريا هي المسؤولة عن إنتاج الطاقة وتوليد جزيئات ATP.";
    const result = evaluateQuestionQuality(q, source);

    assert.equal(result.isValid, true);
    assert.ok(result.qualityScore.groundingScore >= 80);
    assert.ok(result.qualityScore.overallScore >= 70);
  });

  test("validates high quality English STEM question", () => {
    const q: QuizQuestion = {
      id: "en_test_1",
      question: "What is the time complexity of searching a balanced binary search tree?",
      options: ["O(log n)", "O(n)", "O(n^2)", "O(1)"],
      correctIndex: 0,
      explanation:
        "Searching an AVL or red-black tree takes logarithmic time because height is bounded by log2(n).",
      topic: "Algorithms",
      difficulty: "medium",
      bloomLevel: "understand",
      evidenceQuote: "searching a balanced tree takes O(log n) time",
    };

    const source =
      "As established, searching a balanced tree takes O(log n) time in the worst case.";
    const result = evaluateQuestionQuality(q, source);

    assert.equal(result.isValid, true);
    assert.ok(result.qualityScore.overallScore >= 70);
  });

  test("validates Mixed Arabic-English technical questions (Medical / Engineering)", () => {
    const q: QuizQuestion = {
      id: "mixed_test_1",
      question: "ما هو التأثير الرئيسي لأدوية الـ Beta-blockers على الـ Heart Rate؟",
      options: [
        "تقليل معدل ضربات القلب",
        "مضاعفة معدل ضربات القلب",
        "تثبيط إنتاج الإنسولين",
        "زيادة ضغط الدم الشرياني",
      ],
      correctIndex: 0,
      explanation: "تعمل حاصرات بيتا على خفض معدل ضربات القلب وتخفيف العبء عن عضلة القلب.",
      topic: "علم الأدوية",
      difficulty: "medium",
      bloomLevel: "apply",
      evidenceQuote: "Beta-blockers act to reduce heart rate",
    };

    const source =
      "Clinical guidelines note that Beta-blockers act to reduce heart rate and cardiac workload.";
    const result = evaluateQuestionQuality(q, source);

    assert.equal(result.isValid, true);
  });

  test("rejects question with duplicate options or invalid correctIndex", () => {
    const qBadIndex: QuizQuestion = {
      id: "bad_idx",
      question: "What is the capital of Egypt?",
      options: ["Cairo", "Alexandria"],
      correctIndex: 5, // Out of bounds
      explanation: "Cairo is the capital.",
      topic: "Geography",
      difficulty: "easy",
      bloomLevel: "remember",
    };
    assert.equal(evaluateQuestionQuality(qBadIndex).isValid, false);

    const qDuplicateOptions: QuizQuestion = {
      id: "dup_opts",
      question: "ما هي عاصمة مصر؟",
      options: ["القاهرة", "القاهرة", "الإسكندرية", "أسوان"],
      correctIndex: 0,
      explanation: "القاهرة هي العاصمة.",
      topic: "جغرافيا",
      difficulty: "easy",
      bloomLevel: "remember",
    };
    assert.equal(evaluateQuestionQuality(qDuplicateOptions).isValid, false);
  });

  test("rejects question with circular non-educational explanation", () => {
    const qCircular: QuizQuestion = {
      id: "circular",
      question: "Why does water boil at 100 degrees Celsius at sea level?",
      options: [
        "Vapor pressure equals atmospheric pressure",
        "Molecules stop moving",
        "Hydrogen atoms vanish",
        "Zero gravity",
      ],
      correctIndex: 0,
      explanation: "Option A is right because it is correct.",
      topic: "Physics",
      difficulty: "medium",
      bloomLevel: "understand",
    };
    const result = evaluateQuestionQuality(qCircular);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.some((r) => r.includes("الشرح")));
  });

  test("deduplicates identical and near-identical questions", () => {
    const questions: QuizQuestion[] = [
      {
        id: "q1",
        question: "ما هي وظيفة الميتوكوندريا؟",
        options: ["إنتاج الطاقة", "تخزين الدهون"],
        correctIndex: 0,
        explanation: "إنتاج ATP.",
        topic: "أحياء",
        difficulty: "easy",
        bloomLevel: "remember",
      },
      {
        id: "q2",
        question: "ما هي وظيفة الميتوكوندريا؟", // Exact duplicate
        options: ["إنتاج الطاقة", "تخزين الدهون"],
        correctIndex: 0,
        explanation: "إنتاج ATP.",
        topic: "أحياء",
        difficulty: "easy",
        bloomLevel: "remember",
      },
      {
        id: "q3",
        question: "ما هي وظيفة الريبوسومات؟", // Distinct
        options: ["تصنيع البروتين", "تخزين الماء"],
        correctIndex: 0,
        explanation: "بناء البروتينات.",
        topic: "أحياء",
        difficulty: "easy",
        bloomLevel: "remember",
      },
    ];

    const deduplicated = deduplicateQuestions(questions);
    assert.equal(deduplicated.length, 2);
    assert.equal(deduplicated[0].question, "ما هي وظيفة الميتوكوندريا؟");
    assert.equal(deduplicated[1].question, "ما هي وظيفة الريبوسومات؟");
  });
});
