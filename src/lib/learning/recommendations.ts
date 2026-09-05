import type { ConceptMastery } from "./mastery-engine";

export interface LearningRecommendation {
  id: string;
  type: "review" | "tutor" | "practice" | "advance";
  priority: "high" | "medium" | "low";
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  targetTopic?: string;
  actionPayload?: {
    quizConfigPreset?: {
      difficulty: "easy" | "medium" | "hard" | "mixed";
      questionCount: number;
    };
  };
}

export function generateLearningRecommendations(
  topicMastery: Record<string, ConceptMastery>,
  overallAccuracy: number,
): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];

  const strugglingTopics = Object.values(topicMastery).filter((t) => t.status === "struggling");
  const inProgressTopics = Object.values(topicMastery).filter((t) => t.status === "in_progress");
  const masteredTopics = Object.values(topicMastery).filter((t) => t.status === "mastered");

  // 1. High Priority: Struggling topics
  strugglingTopics.forEach((t) => {
    recommendations.push({
      id: `rec_weak_${t.topic}`,
      type: "practice",
      priority: "high",
      targetTopic: t.topic,
      titleAr: `ترسيخ موضوع: ${t.topic}`,
      titleEn: `Reinforce Topic: ${t.topic}`,
      descriptionAr: `نسبة التمكن الحالية ${t.accuracy}%. نوصي بحل كويز تدريبي قصير موجه لهذا المفهوم.`,
      descriptionEn: `Current mastery is ${t.accuracy}%. We recommend a short targeted quiz for this concept.`,
      actionPayload: {
        quizConfigPreset: { difficulty: "easy", questionCount: 5 },
      },
    });
  });

  // 2. High Priority: AI Tutor guidance if overall accuracy is low
  if (overallAccuracy < 65 && strugglingTopics.length > 0) {
    const firstWeak = strugglingTopics[0];
    recommendations.push({
      id: `rec_tutor_${firstWeak.topic}`,
      type: "tutor",
      priority: "high",
      targetTopic: firstWeak.topic,
      titleAr: `جلسة إرشاد مع المعلم الذكي حول ${firstWeak.topic}`,
      titleEn: `AI Tutor Session on ${firstWeak.topic}`,
      descriptionAr:
        "اطلب من المعلم الذكي تبسيط المفاهيم الصعبة وتقديم أمثلة واقعية لتجاوز العقبات.",
      descriptionEn:
        "Ask the AI Tutor to simplify difficult concepts and provide real-world analogies.",
    });
  }

  // 3. Medium Priority: In-progress topics moving towards mastery
  inProgressTopics.forEach((t) => {
    recommendations.push({
      id: `rec_prog_${t.topic}`,
      type: "review",
      priority: "medium",
      targetTopic: t.topic,
      titleAr: `رفع التمكن في: ${t.topic}`,
      titleEn: `Advance Mastery in: ${t.topic}`,
      descriptionAr: `وصلت لنسبة ${t.accuracy}%. جولة كويز بأسئلة تطبيقية كفيلة بنقلك لمستوى الإتقان.`,
      descriptionEn: `Reached ${t.accuracy}%. Practice application questions to attain full mastery.`,
      actionPayload: {
        quizConfigPreset: { difficulty: "medium", questionCount: 10 },
      },
    });
  });

  // 4. Low Priority: Advanced challenge for mastered topics
  if (masteredTopics.length > 0) {
    const topTopic = masteredTopics[0];
    recommendations.push({
      id: `rec_adv_${topTopic.topic}`,
      type: "advance",
      priority: "low",
      targetTopic: topTopic.topic,
      titleAr: `تحدي الأسئلة المتقدمة في: ${topTopic.topic}`,
      titleEn: `Advanced Challenge: ${topTopic.topic}`,
      descriptionAr: `أحسنت! أتقنت هذا الموضوع بنسبة ${topTopic.accuracy}%. اختبر نفسك بأسئلة صعبة وتحليلية.`,
      descriptionEn: `Great job! Mastered at ${topTopic.accuracy}%. Challenge yourself with hard analytical questions.`,
      actionPayload: {
        quizConfigPreset: { difficulty: "hard", questionCount: 10 },
      },
    });
  }

  return recommendations;
}
