export interface StudyPlanSession {
  dayNumber: number;
  date: string;
  focusTopic: string;
  goal: string;
  recommendedActivities: string[];
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
}

export interface StudyPlan {
  id: string;
  generatedAt: number;
  targetExamDate: string;
  daysRemaining: number;
  totalEstimatedMinutes: number;
  sessions: StudyPlanSession[];
}

export interface StudyPlanParams {
  examDate: string;
  dailyHours: number;
  weakTopics: string[];
  allTopics: string[];
  topicMastery?: Record<string, number>;
}

export function generatePersonalizedStudyPlan(params: StudyPlanParams): StudyPlan {
  const now = new Date();
  const exam = new Date(params.examDate);
  const diffTime = exam.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const dailyMinutes = Math.round(params.dailyHours * 60);
  const sessions: StudyPlanSession[] = [];

  // Prioritize weak topics first, then remaining topics
  const prioritizedTopics: Array<{ topic: string; priority: "high" | "medium" | "low" }> = [];

  params.weakTopics.forEach((topic) => {
    prioritizedTopics.push({ topic, priority: "high" });
  });

  params.allTopics.forEach((topic) => {
    if (!params.weakTopics.includes(topic)) {
      prioritizedTopics.push({ topic, priority: "medium" });
    }
  });

  if (prioritizedTopics.length === 0) {
    prioritizedTopics.push({ topic: "مراجعة شاملة للمادة", priority: "medium" });
  }

  const sessionCount = Math.min(daysRemaining, Math.max(3, prioritizedTopics.length * 2));

  for (let day = 1; day <= sessionCount; day++) {
    const sessionDate = new Date();
    sessionDate.setDate(now.getDate() + (day - 1));

    const topicIndex = (day - 1) % prioritizedTopics.length;
    const currentItem = prioritizedTopics[topicIndex];
    const isFinalDays = day >= sessionCount - 1;

    let goal = `التركيز على فهم وإتقان موضوع «${currentItem.topic}» وتجاوز نقاط الضعف`;
    let activities = [
      "مراجعة المفاهيم والتعريفات الأساسية",
      "حل كويز تدريبي تفاعلي (10 أسئلة)",
      "استشارة المعلم الذكي حول الأسئلة غير الواضحة",
    ];

    if (isFinalDays) {
      goal = "محاكاة شاملة ومراجعة سريعة لجميع المفاهيم استعداداً للاختبار";
      activities = [
        "إجراء كويز شامل لمستوى الصعوبة العالي (20-30 سؤالاً)",
        "مراجعة ملخصات التعاريف الهامة",
        "تثبيت المفاهيم ذات الأولوية العالية",
      ];
    }

    sessions.push({
      dayNumber: day,
      date: sessionDate.toLocaleDateString("ar-EG", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      focusTopic: isFinalDays ? "مراجعة شاملة نهائية" : currentItem.topic,
      goal,
      recommendedActivities: activities,
      estimatedMinutes: Math.min(dailyMinutes, isFinalDays ? 60 : 45),
      priority: isFinalDays ? "high" : currentItem.priority,
    });
  }

  const totalEstimatedMinutes = sessions.reduce((acc, s) => acc + s.estimatedMinutes, 0);

  return {
    id: `plan_${Date.now()}`,
    generatedAt: Date.now(),
    targetExamDate: params.examDate,
    daysRemaining,
    totalEstimatedMinutes,
    sessions,
  };
}
