import test from "node:test";
import assert from "node:assert/strict";
import {
  shuffleQuestionOptions,
  createTargetedReviewQuiz,
  calculateNextReviewInterval,
} from "../src/lib/learning/spaced-review.ts";
import type { QuizQuestion } from "../src/lib/ai/schemas.ts";

const sampleQuestions: QuizQuestion[] = [
  {
    question: "السؤال الأول؟",
    options: ["أ", "ب", "ج", "د"],
    correctIndex: 0, // Option 'أ'
    explanation: "الشرح 1",
    topic: "موضوع 1",
    difficulty: "easy",
    bloomLevel: "remember",
  },
  {
    question: "السؤال الثاني؟",
    options: ["س", "ص", "ع", "ل"],
    correctIndex: 2, // Option 'ع'
    explanation: "الشرح 2",
    topic: "موضوع 2",
    difficulty: "medium",
    bloomLevel: "understand",
  },
];

test("Spaced Review - shuffle preserves the correct answer value", () => {
  const original = sampleQuestions[0];
  const shuffled = shuffleQuestionOptions(original);

  assert.equal(shuffled.options.length, original.options.length);
  // The option at shuffled.correctIndex must equal 'أ'
  assert.equal(shuffled.options[shuffled.correctIndex], "أ");
});

test("Spaced Review - targets incorrect answers first", () => {
  // Student answered question 0 incorrectly (selected index 1) and question 1 correctly (selected index 2)
  const answers = [1, 2];
  const targeted = createTargetedReviewQuiz(sampleQuestions, answers, ["موضوع 1"]);

  assert.equal(targeted.length, 1);
  assert.equal(targeted[0].question, "السؤال الأول؟");
});

test("Spaced Review - computes correct interval based on performance", () => {
  const lowScoreInterval = calculateNextReviewInterval(40);
  assert.equal(lowScoreInterval.intervalHours, 4);

  const mediumScoreInterval = calculateNextReviewInterval(70);
  assert.equal(mediumScoreInterval.intervalHours, 24);

  const highScoreInterval = calculateNextReviewInterval(95);
  assert.equal(highScoreInterval.intervalHours, 168);
});
