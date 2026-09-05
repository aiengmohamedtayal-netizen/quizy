export type SupportedLocale = "ar" | "en";

export const translations = {
  ar: {
    appTitle: "كويزي",
    appSubtitle: "منصة التعلّم الذكي والتأصيل الأكاديمي",
    uploadTitle: "حوّل ملفاتك ومحاضراتك إلى تجربة تعلّم تفاعلية",
    uploadSubtitle:
      "يدعم ملفات PDF و DOCX و TXT بحجم يصل إلى 30 ميجابايت مع الحفاظ الكامل على خصوصيتك",
    dragDropText: "اسحب الملف وأفلته هنا، أو",
    browseFiles: "تصفح من جهازك",
    readingDoc: "قراءة المستند",
    extractingContent: "استخراج المحتوى والبيانات",
    understandingMaterial: "فهم واستيعاب المادة العلمية",
    generatingQuestions: "توليد وتدقيق الأسئلة",
    validatingQuiz: "التحقق من صحة الإجابات ومطابقتها",
    quizReady: "الكويز جاهز للبدء!",
    startQuiz: "ابدأ الكويز الآن",
    question: "السؤال",
    of: "من",
    checkAnswer: "تحقق من الإجابة",
    nextQuestion: "السؤال التالي",
    viewResults: "عرض النتيجة والتحليل",
    quizCompleted: "اكتمل الاختبار والتقييم!",
    topicPerformance: "مستوى الأداء والتمكّن حسب المواضيع (Topic Mastery)",
    difficultyPerformance: "مستوى الأداء حسب الصعوبة",
    cognitivePerformance: "التحليل المعرفي وفق هرم بلوم (Bloom's Taxonomy)",
    weakTopicsAlert: "توصيات الذكاء الاصطناعي للمذاكرة (المفاهيم التي تحتاج إلى تركيز)",
    retakeQuiz: "إعادة نفس الكويز",
    smartReview: "مراجعة ذكية للمفاهيم المتعثرة",
    newFile: "ملف جديد",
    askTutor: "اسأل المعلم الذكي",
    evidenceQuote: "شاهد الدليل من المستند",
    bloomLevels: {
      remember: "تذكر واسترجاع",
      understand: "فهم واستيعاب",
      apply: "تطبيق عملي",
      analyze: "تحليل ومقارنة",
      evaluate: "تقويم ونقد",
      create: "ابتكار وتركيب",
    },
    difficulties: {
      easy: "سهل",
      medium: "متوسط",
      hard: "صعب",
    },
  },
  en: {
    appTitle: "Quizy",
    appSubtitle: "AI-Powered Adaptive Learning & Assessment Platform",
    uploadTitle: "Transform your documents and lectures into interactive learning",
    uploadSubtitle: "Supports PDF, DOCX, and TXT up to 30MB with full privacy",
    dragDropText: "Drag and drop your file here, or",
    browseFiles: "Browse files",
    readingDoc: "Reading document",
    extractingContent: "Extracting content",
    understandingMaterial: "Understanding material",
    generatingQuestions: "Generating questions",
    validatingQuiz: "Validating quiz",
    quizReady: "Quiz ready to begin!",
    startQuiz: "Start Quiz Now",
    question: "Question",
    of: "of",
    checkAnswer: "Check Answer",
    nextQuestion: "Next Question",
    viewResults: "View Results & Analytics",
    quizCompleted: "Quiz Completed!",
    topicPerformance: "Topic Mastery Breakdown",
    difficultyPerformance: "Performance by Difficulty",
    cognitivePerformance: "Cognitive Performance (Bloom's Taxonomy)",
    weakTopicsAlert: "AI Recommended Focus Areas (Struggling Concepts)",
    retakeQuiz: "Retake Quiz",
    smartReview: "Smart Targeted Review",
    newFile: "New File",
    askTutor: "Ask AI Tutor",
    evidenceQuote: "Source Evidence",
    bloomLevels: {
      remember: "Remembering",
      understand: "Understanding",
      apply: "Applying",
      analyze: "Analyzing",
      evaluate: "Evaluating",
      create: "Creating",
    },
    difficulties: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
    },
  },
} as const;

export function getBloomBadgeLabel(level?: string, locale: SupportedLocale = "ar"): string {
  const t = translations[locale].bloomLevels;
  switch (level) {
    case "remember":
      return t.remember;
    case "apply":
      return t.apply;
    case "analyze":
      return t.analyze;
    case "evaluate":
      return t.evaluate;
    case "create":
      return t.create;
    case "understand":
    default:
      return t.understand;
  }
}
