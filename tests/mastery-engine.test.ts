import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightedScore,
  analyzeAttemptMastery,
} from "../src/lib/learning/mastery-engine.ts";
import type { QuizQuestion } from "../src/lib/ai/schemas.ts";

test("Mastery Engine - weights hard questions higher than easy questions", () => {
  // Candidate A: 1 hard question correct (weight 2.0 / 2.0 = 100%)
  const scoreHard = calculateWeightedScore([{ isCorrect: true, difficulty: "hard" }]);
  assert.equal(scoreHard, 100);

  // Candidate B: 1 easy question correct, 1 hard question wrong (weight 1.0 / 3.0 = 33%)
  const scoreMixed = calculateWeightedScore([
    { isCorrect: true, difficulty: "easy" },
    { isCorrect: false, difficulty: "hard" },
  ]);
  assert.equal(scoreMixed, 33);
});

test("Mastery Engine - accurately detects weak topics (<60% accuracy)", () => {
  const questions: QuizQuestion[] = [
    {
      question: "س1",
      options: ["1", "2"],
      correctIndex: 0,
      explanation: "exp",
      topic: "الموضوع القوي",
      difficulty: "easy",
      bloomLevel: "remember",
    },
    {
      question: "س2",
      options: ["1", "2"],
      correctIndex: 0,
      explanation: "exp",
      topic: "الموضوع القوي",
      difficulty: "easy",
      bloomLevel: "remember",
    },
    {
      question: "س3",
      options: ["1", "2"],
      correctIndex: 0,
      explanation: "exp",
      topic: "الموضوع الضعيف",
      difficulty: "medium",
      bloomLevel: "understand",
    },
  ];

  // Student got Q1, Q2 right (الموضوع القوي = 100%), Q3 wrong (الموضوع الضعيف = 0%)
  const answers = [0, 0, 1];
  const { topicMastery, weakTopics } = analyzeAttemptMastery(questions, answers);

  assert.deepEqual(weakTopics, ["الموضوع الضعيف"]);
  assert.equal(topicMastery["الموضوع القوي"].status, "mastered");
  assert.equal(topicMastery["الموضوع الضعيف"].status, "struggling");
});
