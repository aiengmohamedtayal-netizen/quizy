import type { QuizQuestion, Difficulty, BloomLevel } from "../ai/schemas";

export interface QuestionEvidence {
  questionId: string;
  topic: string;
  conceptId?: string;
  isCorrect: boolean;
  difficulty: Difficulty;
  bloomLevel: BloomLevel;
  timestamp: number;
}

export interface ConceptMastery {
  name: string;
  topic: string;
  correctCount: number;
  totalAttempts: number;
  accuracy: number; // 0 - 100
  masteryScore: number; // weighted 0 - 100
  status: "mastered" | "in_progress" | "struggling";
}

export interface QuizAttemptRecord {
  id: string;
  timestamp: number;
  documentName: string;
  totalQuestions: number;
  score: number;
  percentage: number;
  evidences: QuestionEvidence[];
}

const STORAGE_KEY = "quizy_learner_mastery_v1";

/**
 * Calculates weighted mastery score accounting for difficulty levels
 */
export function calculateWeightedScore(
  evidences: Array<{ isCorrect: boolean; difficulty: Difficulty }>,
): number {
  if (evidences.length === 0) return 0;

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const ev of evidences) {
    const weight = ev.difficulty === "hard" ? 2.0 : ev.difficulty === "medium" ? 1.5 : 1.0;
    totalWeight += weight;
    if (ev.isCorrect) {
      earnedWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
}

/**
 * Computes topic and concept breakdown from a quiz attempt
 */
export function analyzeAttemptMastery(
  questions: QuizQuestion[],
  answers: number[],
): {
  topicMastery: Record<string, ConceptMastery>;
  bloomMastery: Record<string, { correct: number; total: number; percentage: number }>;
  weakTopics: string[];
} {
  const topicMap: Record<
    string,
    {
      evidences: Array<{ isCorrect: boolean; difficulty: Difficulty }>;
      correct: number;
      total: number;
    }
  > = {};

  const bloomMap: Record<string, { correct: number; total: number }> = {};

  questions.forEach((q, idx) => {
    const isCorrect = answers[idx] === q.correctIndex;
    const topic = q.topic || "عام";
    const bloom = q.bloomLevel || "understand";

    // Topic aggregation
    if (!topicMap[topic]) {
      topicMap[topic] = { evidences: [], correct: 0, total: 0 };
    }
    topicMap[topic].total += 1;
    if (isCorrect) topicMap[topic].correct += 1;
    topicMap[topic].evidences.push({ isCorrect, difficulty: q.difficulty });

    // Bloom aggregation
    if (!bloomMap[bloom]) {
      bloomMap[bloom] = { correct: 0, total: 0 };
    }
    bloomMap[bloom].total += 1;
    if (isCorrect) bloomMap[bloom].correct += 1;
  });

  const topicMastery: Record<string, ConceptMastery> = {};
  const weakTopics: string[] = [];

  for (const [topic, data] of Object.entries(topicMap)) {
    const accuracy = Math.round((data.correct / data.total) * 100);
    const weighted = calculateWeightedScore(data.evidences);
    const status: ConceptMastery["status"] =
      weighted >= 80 ? "mastered" : weighted >= 60 ? "in_progress" : "struggling";

    if (status === "struggling" || accuracy < 60) {
      weakTopics.push(topic);
    }

    topicMastery[topic] = {
      name: topic,
      topic,
      correctCount: data.correct,
      totalAttempts: data.total,
      accuracy,
      masteryScore: weighted,
      status,
    };
  }

  const bloomMastery: Record<string, { correct: number; total: number; percentage: number }> = {};
  for (const [bloom, data] of Object.entries(bloomMap)) {
    bloomMastery[bloom] = {
      correct: data.correct,
      total: data.total,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    };
  }

  return { topicMastery, bloomMastery, weakTopics };
}

/**
 * Persist an attempt safely to local storage
 */
export function recordAttemptToStorage(record: QuizAttemptRecord): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const history: QuizAttemptRecord[] = raw ? JSON.parse(raw) : [];
    history.unshift(record);
    // Keep last 30 attempts
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
  } catch (err) {
    console.warn("Failed to save learner attempt to localStorage:", err);
  }
}

/**
 * Retrieve learner history
 */
export function getStoredAttempts(): QuizAttemptRecord[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
