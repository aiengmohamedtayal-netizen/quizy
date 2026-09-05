import test from "node:test";
import assert from "node:assert/strict";
import { evaluateQuestionQuality } from "../src/lib/learning/quality-evaluator.ts";
import type { QuizQuestion } from "../src/lib/ai/schemas.ts";

test("Quality Evaluator - rejects question with duplicate options", () => {
  const invalidQuestion: QuizQuestion = {
    question: "ما هي عاصمة فرنسا؟",
    options: ["باريس", "باريس", "روما", "مدريد"],
    correctIndex: 0,
    explanation: "باريس هي العاصمة.",
    topic: "جغرافيا",
    difficulty: "easy",
    bloomLevel: "remember",
  };

  const res = evaluateQuestionQuality(invalidQuestion);
  assert.equal(res.isValid, false);
  assert.match(res.reasons[0], /تكرار/);
});

test("Quality Evaluator - accepts high quality grounded question", () => {
  const validQuestion: QuizQuestion = {
    question: "ما هي الوحدة البنائية الأساسية في الجهاز العصبي؟",
    options: ["الخلية العصبية (العصبون)", "الخلية الكبدية", "كرية الدم الحمراء", "الخلية العضلية"],
    correctIndex: 0,
    explanation: "العصبون هو الوحدة الأساسية المسؤولة عن نقل الإشارات العصبية.",
    topic: "علم الأحياء",
    difficulty: "medium",
    bloomLevel: "remember",
    evidenceQuote: "يعتبر العصبون هو الوحدة البنائية الأساسية في الجهاز العصبي للإنسان.",
  };

  const sourceText =
    "الجهاز العصبي يتكون من مليارات الخلايا. يعتبر العصبون هو الوحدة البنائية الأساسية في الجهاز العصبي للإنسان.";
  const res = evaluateQuestionQuality(validQuestion, sourceText);

  assert.equal(res.isValid, true);
  assert.ok(res.qualityScore.overallScore >= 70);
  assert.ok(res.qualityScore.groundingScore >= 80);
});

test("Quality Evaluator - flags out of bounds correctIndex", () => {
  const outOfBounds: QuizQuestion = {
    question: "أي من اللغات التالية هي لغة مفسرة؟",
    options: ["بايثون", "سي بلس بلس"],
    correctIndex: 5,
    explanation: "بايثون لغة مفسرة.",
    topic: "برمجة",
    difficulty: "easy",
    bloomLevel: "remember",
  };

  const res = evaluateQuestionQuality(outOfBounds);
  assert.equal(res.isValid, false);
});
