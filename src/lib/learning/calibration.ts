/**
 * Calibration and Evidence-Based Confidence Engine
 * Implements 2026 cognitive science & adaptive assessment principles (Stanford/ETS).
 * Avoids single-number illusion by providing Mastery + Confidence + Evidence Count + Recency.
 */

export type ConfidenceLevel = "early" | "moderate" | "high";

export interface CalibratedTopicMastery {
  topic: string;
  name: string;
  masteryScore: number; // 0 - 100
  confidenceLevel: ConfidenceLevel;
  confidencePercentage: number; // 0 - 100%
  evidenceCount: number; // Number of questions answered
  correctCount: number;
  totalAttempts: number;
  lastAssessedTimestamp: number;
  lastAssessedFormattedAr: string;
  cognitiveCoverage: {
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
  };
  humanizedAssessmentAr: string;
}

/**
 * Calculates evidence-calibrated confidence level.
 * In adaptive learning science:
 * - 1 to 3 items: Early / Exploratory (low statistical confidence)
 * - 4 to 9 items: Moderate confidence
 * - 10+ items across multiple sessions: High confidence
 */
export function calculateConfidence(
  evidenceCount: number,
  consistencyFactor = 1.0,
): {
  level: ConfidenceLevel;
  percentage: number;
} {
  if (evidenceCount === 0) {
    return { level: "early", percentage: 0 };
  }

  // Base confidence score scaling logarithmically
  let rawConfidence = Math.min(100, Math.round(Math.log2(evidenceCount + 1) * 28));
  rawConfidence = Math.round(rawConfidence * consistencyFactor);

  if (evidenceCount < 4) {
    return { level: "early", percentage: Math.min(40, rawConfidence) };
  }
  if (evidenceCount < 10) {
    return { level: "moderate", percentage: Math.min(75, Math.max(45, rawConfidence)) };
  }
  return { level: "high", percentage: Math.min(98, Math.max(76, rawConfidence)) };
}

/**
 * Calculates recency decay for mastery confidence.
 * Knowledge slightly degrades in estimation confidence if not tested for > 14 days.
 */
export function calculateRecencyWeight(lastAssessedTimestamp: number): number {
  if (!lastAssessedTimestamp) return 0.5;
  const now = Date.now();
  const daysDiff = (now - lastAssessedTimestamp) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 3) return 1.0;
  if (daysDiff <= 7) return 0.95;
  if (daysDiff <= 14) return 0.88;
  if (daysDiff <= 30) return 0.78;
  return 0.65;
}

/**
 * Formats relative time in Arabic (e.g., اليوم، أمس، منذ يومين)
 */
export function formatRelativeTimeAr(timestamp: number): string {
  if (!timestamp) return "لم يُقيّم بعد";
  const now = Date.now();
  const diffHours = (now - timestamp) / (1000 * 60 * 60);

  if (diffHours < 1) return "منذ لحظات";
  if (diffHours < 24) return "اليوم";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "أمس";
  if (diffDays === 2) return "منذ يومين";
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوماً`;
}

/**
 * Generates an honest, human-centered summary statement for a concept or topic.
 * Follows ethical AI principle: "Quizy تقدّر مستوى إتقانك بناءً على أدائك الحالي"
 */
export function generateCalibratedSummaryAr(
  masteryScore: number,
  confidenceLevel: ConfidenceLevel,
  evidenceCount: number,
): string {
  const confidenceLabels = {
    early: "تقدير استكشافي مبكر",
    moderate: "ثقة متوسطة في التقدير",
    high: "ثقة عالية ومعايرة دقيقة",
  };

  if (evidenceCount === 0) {
    return "لم يتم حل أسئلة كافية بعد لتقدير مستوى الإتقان بدقة.";
  }

  return `تقدير إتقان ${masteryScore}% مبني على ${evidenceCount} أسئلة (${confidenceLabels[confidenceLevel]}).`;
}
