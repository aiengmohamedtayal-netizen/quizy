import { z } from "zod";

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const BloomLevelSchema = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);
export type BloomLevel = z.infer<typeof BloomLevelSchema>;

export const ConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string(),
  definition: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const QuestionQualityScoreSchema = z.object({
  groundingScore: z.number().min(0).max(100),
  clarityScore: z.number().min(0).max(100),
  distractorScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
});
export type QuestionQualityScore = z.infer<typeof QuestionQualityScoreSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(5, "نص السؤال قصير جداً"),
  options: z
    .array(z.string().min(1))
    .min(2, "يجب وجود خيارين على الأقل")
    .max(6, "الحد الأقصى 6 خيارات"),
  correctIndex: z.number().int().min(0),
  explanation: z.string().min(3, "التفسير مطلوب"),
  topic: z.string().min(2, "الموضوع مطلوب"),
  difficulty: DifficultySchema,
  conceptId: z.string().optional(),
  bloomLevel: BloomLevelSchema.default("understand"),
  evidenceQuote: z.string().optional(),
  qualityScore: QuestionQualityScoreSchema.optional(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizConfigSchema = z.object({
  questionCount: z.number().int().min(3).max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  questionType: z.enum(["mcq", "true-false", "mixed"]).default("mixed"),
  language: z.enum(["ar", "en", "auto"]).default("auto"),
  targetBloomLevel: z.enum(["all", "remember", "understand", "apply", "analyze"]).default("all"),
});

export type QuizConfig = z.infer<typeof QuizConfigSchema>;

export const DocumentAnalysisSchema = z.object({
  hasExistingQuestions: z.boolean(),
  dominantLanguage: z.enum(["ar", "en", "mixed"]),
  topics: z.array(z.string().min(2)),
  concepts: z.array(ConceptSchema).optional().default([]),
  estimatedQuestionsAvailable: z.number().int().min(1),
  summary: z.string(),
});

export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;

export const GeneratedQuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1, "لم يتم توليد أي أسئلة"),
});

export type GeneratedQuizResponse = z.infer<typeof GeneratedQuizResponseSchema>;
