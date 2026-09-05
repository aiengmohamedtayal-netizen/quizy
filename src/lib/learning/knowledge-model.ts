/**
 * Educational Knowledge Representation Models
 * Structured concepts, topics, learning objectives, and Bloom's taxonomy.
 */

export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export interface Concept {
  id: string;
  name: string;
  topic: string;
  definition?: string;
  keyPoints?: string[];
  bloomLevels?: BloomLevel[];
}

export interface DocumentKnowledge {
  topics: string[];
  concepts: Concept[];
  summary: string;
  hasExistingQuestions: boolean;
  dominantLanguage: "ar" | "en" | "mixed";
  estimatedQuestionsAvailable: number;
}

export interface QuestionQualityScore {
  groundingScore: number; // 0-100: Degree to which answer is directly proven in text
  clarityScore: number; // 0-100: Unambiguous wording and clean grammar
  distractorScore: number; // 0-100: Quality and distinctiveness of wrong answers
  overallScore: number; // Weighted composite score
}
