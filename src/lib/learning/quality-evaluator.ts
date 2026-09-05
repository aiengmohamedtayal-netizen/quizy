import type { QuizQuestion, QuestionQualityScore } from "../ai/schemas";

/**
 * Question Quality Engine
 * Evaluates candidates for factual grounding, clarity, distractor plausibility,
 * ambiguity avoidance, explanation depth, and single-answer determinism.
 */

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/[؟?.,!،:؛\-—_()[\]{}"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Jaccard token overlap between two strings (0.0 to 1.0)
 */
export function computeTokenOverlap(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(" ").filter((w) => w.length >= 1));
  const wordsB = new Set(normB.split(" ").filter((w) => w.length >= 1));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

export function evaluateQuestionQuality(
  q: QuizQuestion,
  sourceText?: string,
): { isValid: boolean; qualityScore: QuestionQualityScore; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Determinism and Option Validity
  if (!q.options || q.options.length < 2) {
    return {
      isValid: false,
      qualityScore: { groundingScore: 0, clarityScore: 0, distractorScore: 0, overallScore: 0 },
      reasons: ["عدد الخيارات أقل من 2"],
    };
  }

  if (q.options.length > 6) {
    return {
      isValid: false,
      qualityScore: { groundingScore: 0, clarityScore: 0, distractorScore: 0, overallScore: 0 },
      reasons: ["عدد الخيارات يتجاوز الحد الأقصى (6 خيارات)"],
    };
  }

  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    return {
      isValid: false,
      qualityScore: { groundingScore: 0, clarityScore: 0, distractorScore: 0, overallScore: 0 },
      reasons: ["مؤشر الإجابة الصحيحة خارج نطاق الخيارات المتاحة"],
    };
  }

  // Check for duplicate options (exact)
  const normalizedOptions = q.options.map(normalizeString);
  const uniqueOptions = new Set(normalizedOptions);
  if (uniqueOptions.size !== q.options.length) {
    return {
      isValid: false,
      qualityScore: { groundingScore: 0, clarityScore: 0, distractorScore: 0, overallScore: 0 },
      reasons: ["تكرار أحد الخيارات في السؤال نفسه"],
    };
  }

  // Check pairwise option similarity for long sentences to catch duplicate distractors
  for (let i = 0; i < q.options.length; i++) {
    for (let j = i + 1; j < q.options.length; j++) {
      const optA = q.options[i];
      const optB = q.options[j];
      if (optA.length > 25 && optB.length > 25) {
        const overlap = computeTokenOverlap(optA, optB);
        if (overlap > 0.9) {
          return {
            isValid: false,
            qualityScore: {
              groundingScore: 0,
              clarityScore: 0,
              distractorScore: 0,
              overallScore: 0,
            },
            reasons: ["خيارات متطابقة أو متقاربة جداً مما يسبب لبساً في التمييز"],
          };
        }
      }
    }
  }

  // 2. Clarity & Ambiguity Evaluation (0 - 100)
  let clarityScore = 80;
  const qText = q.question.trim();

  if (qText.length >= 15) clarityScore += 10;
  if (/[؟?]/.test(qText)) clarityScore += 5;
  if (qText.length > 350) {
    clarityScore -= 20; // Overly verbose or confusing stem
    reasons.push("نص السؤال طويل جداً ومعقد صياغياً");
  }

  // Check for ambiguous negative stems without emphasis (e.g. "which of these is NOT")
  const hasNegativeStem = /(ليس|غير|لا يعتبر|not|except|which of the following is false)/i.test(
    qText,
  );
  if (
    hasNegativeStem &&
    !qText.includes("ليس") &&
    !qText.includes("NOT") &&
    !qText.includes("غير")
  ) {
    clarityScore -= 10;
  }

  // 3. Distractor Quality & Balance (0 - 100)
  let distractorScore = 70;
  const optionLengths = q.options.map((o) => o.trim().length);
  const minLen = Math.min(...optionLengths);
  const maxLen = Math.max(...optionLengths);

  // If option lengths are reasonably balanced, distractors are higher quality
  if (maxLen > 0 && minLen / maxLen > 0.3) {
    distractorScore += 15;
  } else if (maxLen > 0 && minLen / maxLen < 0.15) {
    distractorScore -= 15; // Obvious giveaway where one option is 8x longer than others
    reasons.push("تفاوت كبير جداً في طول الخيارات مما يكشف الإجابة بديهياً");
  }

  if (minLen < 2) {
    distractorScore -= 30;
    reasons.push("أحد الخيارات قصير جداً أو فارغ");
  }

  if (q.options.length >= 3) {
    distractorScore += 15;
  }
  distractorScore = Math.min(100, Math.max(0, distractorScore));

  // 4. Grounding & Explanation Depth (0 - 100)
  let groundingScore = 70;
  if (q.explanation && q.explanation.length >= 15) {
    groundingScore += 10;
    // Penalize trivial circular explanations
    const normExp = normalizeString(q.explanation);
    if (normExp.includes("لانها الصحيحة") || normExp.includes("because it is correct")) {
      groundingScore -= 25;
      reasons.push("الشرح المقدم غير تعليمي ومجرد تكرار بديهي");
    }
  } else {
    groundingScore -= 15;
    reasons.push("الشرح قصير جداً أو مفقود");
  }

  if (q.evidenceQuote && q.evidenceQuote.trim().length >= 10) {
    groundingScore += 10;
    if (sourceText) {
      const normSource = normalizeString(sourceText);
      const normQuote = normalizeString(q.evidenceQuote);
      const searchSnippet = normQuote.slice(0, 30);
      if (normSource.includes(searchSnippet)) {
        groundingScore += 10;
      } else {
        reasons.push("الاقتباس المذكور كدليل غير موجود في نص المستند الأصلي");
        groundingScore -= 15;
      }
    }
  }
  groundingScore = Math.min(100, Math.max(0, groundingScore));

  // Overall Composite Score
  const overallScore = Math.round(
    groundingScore * 0.45 + distractorScore * 0.3 + clarityScore * 0.25,
  );

  const isValid = overallScore >= 55 && reasons.length === 0;

  return {
    isValid,
    qualityScore: {
      groundingScore,
      clarityScore,
      distractorScore,
      overallScore,
    },
    reasons,
  };
}
