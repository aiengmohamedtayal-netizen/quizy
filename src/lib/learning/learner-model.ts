/**
 * Unified Learner Model
 * Synthesizes dynamic learner modeling (Knowledge State, Cognitive Levels,
 * Difficulty Calibration, Goals, Review State, and Session Context).
 */

import {
  type ConfidenceLevel,
  type CalibratedTopicMastery,
  calculateConfidence,
  formatRelativeTimeAr,
  generateCalibratedSummaryAr,
} from "./calibration";
import {
  getStoredAttempts,
  type QuizAttemptRecord,
  calculateWeightedScore,
} from "./mastery-engine";
import { getSpacedReviewQueue, type ReviewCard } from "./spaced-review";
import type { Difficulty, BloomLevel } from "../ai/schemas";

export type LearnerIntent =
  | "scaffolded_learning" // أذاكر وأفهم من الصفر
  | "concept_review" // أراجع وأثبت المفاهيم
  | "self_assessment" // أختبر نفسي وأقيس مستواي
  | "exam_prep" // أستعد لامتحان نهائي
  | "weakness_focus"; // أركز على نقاط ضعفي

export type ChallengePreference = "comfortable" | "balanced" | "stretch";

export interface LearnerGoal {
  intent: LearnerIntent;
  availableTimeMinutes: number | null; // e.g., 10, 20, 30 or null for open
  preferredChallenge: ChallengePreference;
}

export interface CognitiveProfile {
  remember: { correct: number; total: number; percentage: number };
  understand: { correct: number; total: number; percentage: number };
  apply: { correct: number; total: number; percentage: number };
  analyze: { correct: number; total: number; percentage: number };
  evaluate: { correct: number; total: number; percentage: number };
  create: { correct: number; total: number; percentage: number };
}

export interface DifficultyCalibration {
  recommendedDifficulty: Difficulty;
  comfortableWithMedium: boolean;
  readyForHard: boolean;
  needsScaffolding: boolean;
  easyAccuracy: number;
  mediumAccuracy: number;
  hardAccuracy: number;
}

export interface RecurringStruggle {
  topic: string;
  errorCount: number;
  lastMissedTimestamp: number;
  sampleQuestionSnippet?: string;
}

export interface UnifiedLearnerModel {
  lastUpdated: number;
  totalQuizzesTaken: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number;
  calibratedTopics: Record<string, CalibratedTopicMastery>;
  cognitiveProfile: CognitiveProfile;
  difficultyCalibration: DifficultyCalibration;
  recurringStruggles: RecurringStruggle[];
  dueReviews: ReviewCard[];
  activeGoal: LearnerGoal;
  learningStreakDays: number;
}

const LEARNER_GOAL_STORAGE_KEY = "quizy_learner_active_goal_v1";

export function getDefaultLearnerGoal(): LearnerGoal {
  return {
    intent: "concept_review",
    availableTimeMinutes: 15,
    preferredChallenge: "balanced",
  };
}

export function saveLearnerGoal(goal: LearnerGoal): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(LEARNER_GOAL_STORAGE_KEY, JSON.stringify(goal));
  } catch {
    // Ignore storage errors
  }
}

export function getStoredLearnerGoal(): LearnerGoal {
  if (typeof window === "undefined" || !window.localStorage) return getDefaultLearnerGoal();
  try {
    const raw = localStorage.getItem(LEARNER_GOAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultLearnerGoal();
  } catch {
    return getDefaultLearnerGoal();
  }
}

/**
 * Builds the complete unified learner model by aggregating stored attempts,
 * spaced repetition cards, and user goals into a single cohesive state.
 */
export function buildUnifiedLearnerModel(): UnifiedLearnerModel {
  const attempts = getStoredAttempts();
  const activeGoal = getStoredLearnerGoal();
  const dueReviews = getSpacedReviewQueue(true);

  let totalQuestions = 0;
  let totalCorrect = 0;

  // Topic aggregations
  const topicMap: Record<
    string,
    {
      correct: number;
      total: number;
      lastTimestamp: number;
      evidences: Array<{ isCorrect: boolean; difficulty: Difficulty }>;
      cognitive: { remember: number; understand: number; apply: number; analyze: number };
    }
  > = {};

  // Difficulty aggregations
  const diffMap: Record<Difficulty, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  // Bloom aggregations
  const bloomMap: Record<BloomLevel, { correct: number; total: number }> = {
    remember: { correct: 0, total: 0 },
    understand: { correct: 0, total: 0 },
    apply: { correct: 0, total: 0 },
    analyze: { correct: 0, total: 0 },
    evaluate: { correct: 0, total: 0 },
    create: { correct: 0, total: 0 },
  };

  const struggleMap: Record<string, { errorCount: number; lastMissed: number }> = {};

  for (const att of attempts) {
    for (const ev of att.evidences) {
      totalQuestions += 1;
      if (ev.isCorrect) totalCorrect += 1;

      // Topic mapping
      const topic = ev.topic || "عام";
      if (!topicMap[topic]) {
        topicMap[topic] = {
          correct: 0,
          total: 0,
          lastTimestamp: ev.timestamp,
          evidences: [],
          cognitive: { remember: 0, understand: 0, apply: 0, analyze: 0 },
        };
      }
      topicMap[topic].total += 1;
      if (ev.isCorrect) topicMap[topic].correct += 1;
      topicMap[topic].lastTimestamp = Math.max(topicMap[topic].lastTimestamp, ev.timestamp);
      topicMap[topic].evidences.push({ isCorrect: ev.isCorrect, difficulty: ev.difficulty });

      const bloomKey = ev.bloomLevel as keyof (typeof topicMap)[string]["cognitive"];
      if (topicMap[topic].cognitive[bloomKey] !== undefined) {
        topicMap[topic].cognitive[bloomKey] += 1;
      }

      // Difficulty mapping
      if (diffMap[ev.difficulty]) {
        diffMap[ev.difficulty].total += 1;
        if (ev.isCorrect) diffMap[ev.difficulty].correct += 1;
      }

      // Bloom mapping
      if (bloomMap[ev.bloomLevel]) {
        bloomMap[ev.bloomLevel].total += 1;
        if (ev.isCorrect) bloomMap[ev.bloomLevel].correct += 1;
      }

      // Recurring struggle detection
      if (!ev.isCorrect) {
        if (!struggleMap[topic]) {
          struggleMap[topic] = { errorCount: 0, lastMissed: ev.timestamp };
        }
        struggleMap[topic].errorCount += 1;
        struggleMap[topic].lastMissed = Math.max(struggleMap[topic].lastMissed, ev.timestamp);
      }
    }
  }

  // Calibrate topics
  const calibratedTopics: Record<string, CalibratedTopicMastery> = {};
  for (const [topic, data] of Object.entries(topicMap)) {
    const rawWeighted = calculateWeightedScore(data.evidences);
    const conf = calculateConfidence(data.total);
    calibratedTopics[topic] = {
      topic,
      name: topic,
      masteryScore: rawWeighted,
      confidenceLevel: conf.level,
      confidencePercentage: conf.percentage,
      evidenceCount: data.total,
      correctCount: data.correct,
      totalAttempts: data.total,
      lastAssessedTimestamp: data.lastTimestamp,
      lastAssessedFormattedAr: formatRelativeTimeAr(data.lastTimestamp),
      cognitiveCoverage: data.cognitive,
      humanizedAssessmentAr: generateCalibratedSummaryAr(rawWeighted, conf.level, data.total),
    };
  }

  // Difficulty calibration
  const easyAcc =
    diffMap.easy.total > 0 ? Math.round((diffMap.easy.correct / diffMap.easy.total) * 100) : 0;
  const medAcc =
    diffMap.medium.total > 0
      ? Math.round((diffMap.medium.correct / diffMap.medium.total) * 100)
      : 0;
  const hardAcc =
    diffMap.hard.total > 0 ? Math.round((diffMap.hard.correct / diffMap.hard.total) * 100) : 0;

  const comfortableWithMedium = medAcc >= 65 || (diffMap.medium.total === 0 && easyAcc >= 75);
  const readyForHard = hardAcc >= 60 || (diffMap.hard.total === 0 && medAcc >= 80);
  const needsScaffolding = easyAcc > 0 && easyAcc < 50;

  const recommendedDifficulty: Difficulty = readyForHard
    ? "hard"
    : comfortableWithMedium
      ? "medium"
      : "easy";

  // Cognitive profile calculation
  const cognitiveProfile: CognitiveProfile = {
    remember: {
      correct: bloomMap.remember.correct,
      total: bloomMap.remember.total,
      percentage:
        bloomMap.remember.total > 0
          ? Math.round((bloomMap.remember.correct / bloomMap.remember.total) * 100)
          : 0,
    },
    understand: {
      correct: bloomMap.understand.correct,
      total: bloomMap.understand.total,
      percentage:
        bloomMap.understand.total > 0
          ? Math.round((bloomMap.understand.correct / bloomMap.understand.total) * 100)
          : 0,
    },
    apply: {
      correct: bloomMap.apply.correct,
      total: bloomMap.apply.total,
      percentage:
        bloomMap.apply.total > 0
          ? Math.round((bloomMap.apply.correct / bloomMap.apply.total) * 100)
          : 0,
    },
    analyze: {
      correct: bloomMap.analyze.correct,
      total: bloomMap.analyze.total,
      percentage:
        bloomMap.analyze.total > 0
          ? Math.round((bloomMap.analyze.correct / bloomMap.analyze.total) * 100)
          : 0,
    },
    evaluate: {
      correct: bloomMap.evaluate.correct,
      total: bloomMap.evaluate.total,
      percentage:
        bloomMap.evaluate.total > 0
          ? Math.round((bloomMap.evaluate.correct / bloomMap.evaluate.total) * 100)
          : 0,
    },
    create: {
      correct: bloomMap.create.correct,
      total: bloomMap.create.total,
      percentage:
        bloomMap.create.total > 0
          ? Math.round((bloomMap.create.correct / bloomMap.create.total) * 100)
          : 0,
    },
  };

  const recurringStruggles: RecurringStruggle[] = Object.entries(struggleMap)
    .filter(([, data]) => data.errorCount >= 2)
    .map(([topic, data]) => ({
      topic,
      errorCount: data.errorCount,
      lastMissedTimestamp: data.lastMissed,
    }))
    .sort((a, b) => b.errorCount - a.errorCount);

  return {
    lastUpdated: Date.now(),
    totalQuizzesTaken: attempts.length,
    totalQuestionsAnswered: totalQuestions,
    overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    calibratedTopics,
    cognitiveProfile,
    difficultyCalibration: {
      recommendedDifficulty,
      comfortableWithMedium,
      readyForHard,
      needsScaffolding,
      easyAccuracy: easyAcc,
      mediumAccuracy: medAcc,
      hardAccuracy: hardAcc,
    },
    recurringStruggles,
    dueReviews,
    activeGoal,
    learningStreakDays: Math.min(7, Math.max(1, attempts.length > 0 ? 1 : 0)),
  };
}
