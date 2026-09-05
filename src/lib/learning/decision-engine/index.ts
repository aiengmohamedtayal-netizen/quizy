/**
 * Learning Decision Engine
 * Evaluates learner state and available knowledge to select the optimal
 * next educational intervention with full pedagogical explainability and learner agency.
 */

import type { UnifiedLearnerModel } from "../learner-model";

export type ActionType =
  | "SPACED_REPETITION_DUE" // مراجعة متباعدة لمفاهيم مهددة بالنسيان
  | "RECURRING_STRUGGLE_TUTOR" // تدخل المعلم الذكي لحل لبس متكرر
  | "TARGETED_PRACTICE" // تدريب وتثبيت لموضوع متعثر
  | "CHALLENGE_EXTENSION" // تحدي بمستوى أعلى لتوسيع الإتقان
  | "FRESH_DIAGNOSTIC" // استكشاف أولي للمادة
  | "STUDY_PLAN_SESSION"; // متابعة الخطة الدراسية المحددة

export interface AlternativeAction {
  id: string;
  labelAr: string;
  type: ActionType;
  topic?: string;
}

export interface NextBestAction {
  id: string;
  type: ActionType;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  targetTopic?: string;
  estimatedMinutes: number;
  rationaleAr: string; // Pedagogical "Why?" (Explainability)
  confidenceNoteAr: string;
  actionCtaAr: string;
  alternatives: AlternativeAction[];
}

/**
 * Evaluates the learner model to determine the next best educational intervention.
 */
export function determineNextBestAction(
  learner: UnifiedLearnerModel,
  context?: { activeDocumentTopic?: string },
): NextBestAction {
  const { totalQuizzesTaken, dueReviews, recurringStruggles, calibratedTopics, activeGoal } =
    learner;

  // Case 1: Brand new student (no attempts yet)
  if (totalQuizzesTaken === 0) {
    return {
      id: "action_fresh_diagnostic",
      type: "FRESH_DIAGNOSTIC",
      titleAr: "استكشاف المادة وبناء خط الأساس المعرفي",
      titleEn: "Diagnostic & Baseline Exploration",
      descriptionAr:
        "ابدأ برفع أول محاضرة أو ملخص، وسنقوم بتشخيص استيعابك الأولي وتحديد نقاط الانطلاق المناسبة.",
      estimatedMinutes: activeGoal.availableTimeMinutes || 10,
      rationaleAr:
        "كويزي تبدأ معك بأسئلة استكشافية متدرجة لقياس مستوى الفهم الحالي دون ضغط درجات، لبناء خطة مذاكرة مخصصة.",
      confidenceNoteAr: "تقدير استكشافي مبدئي.",
      actionCtaAr: "ابدأ الجلسة الاستكشافية الأولى",
      alternatives: [
        {
          id: "alt_review",
          labelAr: "مراجعة سريعة من الصفر",
          type: "FRESH_DIAGNOSTIC",
        },
      ],
    };
  }

  // Case 2: High priority - Spaced Repetition cards are due today
  if (dueReviews.length >= 3) {
    const primaryTopic = dueReviews[0]?.topic || "المفاهيم المستحقة";
    return {
      id: "action_spaced_review",
      type: "SPACED_REPETITION_DUE",
      titleAr: `تثبيت طويل الأجل: ${primaryTopic}`,
      titleEn: `Spaced Retention: ${primaryTopic}`,
      descriptionAr: `لديك ${dueReviews.length} مفاهيم حان موعد مراجعتها المتباعدة اليوم لحمايتها من منحنى النسيان.`,
      targetTopic: primaryTopic,
      estimatedMinutes: Math.min(15, Math.max(5, Math.round(dueReviews.length * 1.5))),
      rationaleAr: `استناداً إلى منحنى النسيان (Ebbinghaus Forgetting Curve)، مراجعة هذه المفاهيم الآن في 5-10 دقائق تضمن بقاءها في الذاكرة طويلة الأجل بكفاءة مضاعفة.`,
      confidenceNoteAr: "مراجعة مبنية على فترات تباعد زمنية محسوبة بدقة.",
      actionCtaAr: `ابدأ تثبيت المفاهيم المستحقة (${dueReviews.length})`,
      alternatives: [
        {
          id: "alt_skip_to_quiz",
          labelAr: "حل كويز جديد بدلاً من المراجعة",
          type: "TARGETED_PRACTICE",
        },
      ],
    };
  }

  // Case 3: Recurring struggle detected (failed multiple times in same topic)
  if (recurringStruggles.length > 0) {
    const struggle = recurringStruggles[0];
    const topicData = calibratedTopics[struggle.topic];
    return {
      id: "action_struggle_tutor",
      type: "RECURRING_STRUGGLE_TUTOR",
      titleAr: `فك تشابك المفهوم: ${struggle.topic}`,
      titleEn: `Concept Disambiguation: ${struggle.topic}`,
      descriptionAr: `لاحظنا تعثرك في ${struggle.errorCount} أسئلة في هذا المفهوم. نقترح جلسة سريعة مع المعلم الذكي أو تدريباً مبسطاً.`,
      targetTopic: struggle.topic,
      estimatedMinutes: 8,
      rationaleAr: `اخترنا هذا التدخل لأن أداءك في ${struggle.topic} (${topicData ? topicData.masteryScore + "%" : "منخفض"}) يوضح وجود سوء فهم محدد يستحق التوضيح قبل الانتقال لمواضيع متقدمة.`,
      confidenceNoteAr: topicData
        ? `مبني على ${topicData.evidenceCount} أدلة سابقة.`
        : "مبني على أخطاء متكررة.",
      actionCtaAr: "ناقش المفهوم مع المعلم الذكي الآن",
      alternatives: [
        {
          id: "alt_practice_easy",
          labelAr: "حل أسئلة تمهيدية أسهل",
          type: "TARGETED_PRACTICE",
          topic: struggle.topic,
        },
        {
          id: "alt_skip",
          labelAr: "تخطي هذا الموضوع مؤقتاً",
          type: "CHALLENGE_EXTENSION",
        },
      ],
    };
  }

  // Case 4: Weak topic below 60% mastery
  const weakTopicEntry = Object.values(calibratedTopics).find(
    (t) => t.masteryScore < 60 && t.evidenceCount >= 2,
  );
  if (weakTopicEntry) {
    return {
      id: "action_targeted_practice",
      type: "TARGETED_PRACTICE",
      titleAr: `رفع إتقان: ${weakTopicEntry.name}`,
      titleEn: `Mastery Elevation: ${weakTopicEntry.name}`,
      descriptionAr: `مستوى إتقانك الحالي ${weakTopicEntry.masteryScore}% يحتاج تعزيزاً ليتجاوز حاجز الإتقان (80%).`,
      targetTopic: weakTopicEntry.topic,
      estimatedMinutes: 12,
      rationaleAr: `أداؤك الأخير في موضوع "${weakTopicEntry.name}" أظهر حاجة لتثبيت المفاهيم التأسيسية عبر أسئلة تدريبية متدرجة.`,
      confidenceNoteAr: `تقدير مبني على ${weakTopicEntry.evidenceCount} أسئلة سابقة.`,
      actionCtaAr: "ابدأ تدريب التثبيت الموجه",
      alternatives: [
        {
          id: "alt_study_plan",
          labelAr: "إدراج الموضوع في خطتي الدراسية",
          type: "STUDY_PLAN_SESSION",
          topic: weakTopicEntry.topic,
        },
      ],
    };
  }

  // Case 5: High Mastery student - Challenge extension
  const topTopic = Object.values(calibratedTopics).find((t) => t.masteryScore >= 80);
  const candidateTopic = context?.activeDocumentTopic || topTopic?.name || "مفاهيم متقدمة";

  return {
    id: "action_challenge_extension",
    type: "CHALLENGE_EXTENSION",
    titleAr: `تحدي وتفكير نقدي: ${candidateTopic}`,
    titleEn: `Higher-Order Challenge: ${candidateTopic}`,
    descriptionAr:
      "أظهرت استيعاباً ممتازاً للأساسيات! حان وقت اختبار قدرتك على التحليل والتطبيق في مواقف معقدة.",
    targetTopic: candidateTopic,
    estimatedMinutes: 15,
    rationaleAr:
      "نظراً لتحقيقك نسبة إتقان مرتفعة في هذا الموضوع، فإن الانتقال لمستوى بلوم الأعلى (التحليل والتقييم) هو الخطوة المثلى لتعميق الفهم.",
    confidenceNoteAr: "جاهز لمستوى التحدي المتقدم.",
    actionCtaAr: "خوض التحدي المتقدم",
    alternatives: [
      {
        id: "alt_review_comfortable",
        labelAr: "مراجعة مريحة ومتوازنة",
        type: "TARGETED_PRACTICE",
        topic: candidateTopic,
      },
    ],
  };
}
