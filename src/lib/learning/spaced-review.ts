import type { QuizQuestion } from "../ai/schemas";

export interface ReviewCard {
  id: string;
  topic: string;
  conceptName: string;
  nextReviewTimestamp: number;
  intervalHours: number;
  repetitionCount: number;
  easeFactor: number;
}

const REVIEW_STORAGE_KEY = "quizy_spaced_review_queue_v1";

export function getSpacedReviewQueue(onlyDue = false): ReviewCard[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
    const cards: ReviewCard[] = raw ? JSON.parse(raw) : [];
    if (!onlyDue) return cards;
    const now = Date.now();
    return cards.filter((c) => c.nextReviewTimestamp <= now);
  } catch {
    return [];
  }
}

export function saveReviewCard(card: ReviewCard): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const cards = getSpacedReviewQueue(false);
    const existingIdx = cards.findIndex((c) => c.id === card.id);
    if (existingIdx >= 0) {
      cards[existingIdx] = card;
    } else {
      cards.push(card);
    }
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Shuffles options for a question while maintaining the correct index.
 * Prevents rote memorization of option positions during reviews.
 */
export function shuffleQuestionOptions(q: QuizQuestion): QuizQuestion {
  const correctOption = q.options[q.correctIndex];
  // Pair options with their original items
  const indexed = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correctIndex }));

  // Fisher-Yates shuffle
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }

  const newOptions = indexed.map((item) => item.opt);
  const newCorrectIndex = newOptions.indexOf(correctOption);

  return {
    ...q,
    options: newOptions,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
  };
}

/**
 * Creates a focused, targeted review quiz specifically targeting
 * incorrect answers and identified weak topics.
 */
export function createTargetedReviewQuiz(
  originalQuestions: QuizQuestion[],
  answers: number[],
  weakTopics: string[] = [],
): QuizQuestion[] {
  const targeted: QuizQuestion[] = [];
  const seenQuestions = new Set<string>();

  // 1. First priority: Questions the learner answered incorrectly
  originalQuestions.forEach((q, idx) => {
    if (answers[idx] !== q.correctIndex) {
      targeted.push(shuffleQuestionOptions(q));
      seenQuestions.add(q.question);
    }
  });

  // 2. Second priority: Reinforce weak topics if we have fewer than 5 questions
  if (targeted.length < 5 && weakTopics.length > 0) {
    for (const q of originalQuestions) {
      if (!seenQuestions.has(q.question) && weakTopics.includes(q.topic)) {
        targeted.push(shuffleQuestionOptions(q));
        seenQuestions.add(q.question);
        if (targeted.length >= 8) break;
      }
    }
  }

  return targeted;
}

/**
 * Calculates recommended spaced repetition interval based on score
 */
export function calculateNextReviewInterval(percentage: number): {
  intervalHours: number;
  labelAr: string;
  labelEn: string;
} {
  if (percentage < 50) {
    return {
      intervalHours: 4,
      labelAr: "خلال 4 ساعات (مراجعة عاجلة)",
      labelEn: "Within 4 hours (Urgent Review)",
    };
  }
  if (percentage < 75) {
    return {
      intervalHours: 24,
      labelAr: "غداً (بعد 24 ساعة)",
      labelEn: "Tomorrow (after 24 hours)",
    };
  }
  if (percentage < 90) {
    return {
      intervalHours: 72,
      labelAr: "بعد 3 أيام",
      labelEn: "In 3 days",
    };
  }
  return {
    intervalHours: 168,
    labelAr: "بعد أسبوع (تثبيت الحفظ)",
    labelEn: "In 1 week (Retention Check)",
  };
}
