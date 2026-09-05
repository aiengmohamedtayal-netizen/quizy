import { chunkText } from "../documents/text-parser.ts";
import { extractJsonFromResponse } from "./provider.ts";
import { executeRoutedAiCall } from "./router.ts";
import {
  getQuizGenerationPrompt,
  QUIZ_FUNCTION_TOOL,
  wrapUntrustedDocumentText,
} from "./prompts.ts";
import { QuizQuestionSchema, type QuizConfig, type QuizQuestion } from "./schemas.ts";
import { evaluateQuestionQuality } from "../learning/quality-evaluator.ts";

function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/[؟?.,!،:؛\-—_()[\]{}"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deduplicate questions based on question text similarity.
 */
export function deduplicateQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>();
  const unique: QuizQuestion[] = [];

  for (const q of questions) {
    const key = normalizeForComparison(q.question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(q);
  }

  return unique;
}

/**
 * Validates, sanitizes, and evaluates a single raw candidate question.
 */
function sanitizeAndEvaluateQuestion(raw: unknown, chunkTextContent: string): QuizQuestion | null {
  const parsed = QuizQuestionSchema.safeParse(raw);
  let candidate: QuizQuestion | null = null;

  if (parsed.success) {
    const q = parsed.data;
    const validCorrectIndex = Math.max(0, Math.min(q.options.length - 1, q.correctIndex));
    candidate = {
      ...q,
      correctIndex: validCorrectIndex,
      bloomLevel: q.bloomLevel || "understand",
    };
  } else if (typeof raw === "object" && raw !== null) {
    // Attempt graceful recovery if object is partially valid
    const obj = raw as Record<string, unknown>;
    const question = typeof obj.question === "string" ? obj.question.trim() : "";
    const rawOptions = Array.isArray(obj.options) ? obj.options.map(String) : [];
    const options = rawOptions.map((o) => o.trim()).filter(Boolean);

    if (question.length >= 5 && options.length >= 2) {
      let correctIndex = Number(obj.correctIndex);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }

      const explanation =
        typeof obj.explanation === "string" && obj.explanation.trim()
          ? obj.explanation.trim()
          : "الإجابة الصحيحة مستندة إلى محتوى المادة الدراسية.";

      const topic =
        typeof obj.topic === "string" && obj.topic.trim() ? obj.topic.trim() : "مفاهيم عامة";

      const rawDiff = String(obj.difficulty || "").toLowerCase();
      const difficulty: "easy" | "medium" | "hard" =
        rawDiff === "hard" ? "hard" : rawDiff === "medium" ? "medium" : "easy";

      const rawBloom = String(obj.bloomLevel || "").toLowerCase();
      const validBloom = ["remember", "understand", "apply", "analyze", "evaluate"].includes(
        rawBloom,
      )
        ? (rawBloom as QuizQuestion["bloomLevel"])
        : "understand";

      const evidenceQuote =
        typeof obj.evidenceQuote === "string" && obj.evidenceQuote.trim()
          ? obj.evidenceQuote.trim()
          : undefined;

      candidate = {
        question,
        options: options.slice(0, 6),
        correctIndex,
        explanation,
        topic,
        difficulty,
        bloomLevel: validBloom,
        evidenceQuote,
      };
    }
  }

  if (!candidate) return null;

  // Run Question Quality Engine
  const evaluation = evaluateQuestionQuality(candidate, chunkTextContent);
  if (!evaluation.isValid) {
    return null;
  }

  return {
    ...candidate,
    qualityScore: evaluation.qualityScore,
  };
}

export async function generateQuizFromContent(
  text: string,
  config: QuizConfig,
  contextTopics?: string[],
): Promise<QuizQuestion[]> {
  const chunks = chunkText(text, 18000, 1000);
  if (chunks.length === 0) {
    throw new Error("لا يوجد محتوى نصي كافٍ لتوليد الأسئلة");
  }

  // Calculate proportional questions per chunk
  const questionsPerChunk =
    chunks.length === 1
      ? config.questionCount
      : Math.max(3, Math.ceil((config.questionCount * 1.3) / chunks.length));

  // Parallel Execution: process up to 3 chunks concurrently to avoid rate-limit spikes
  const chunkPromises = chunks.slice(0, 4).map(async (chunk) => {
    const chunkConfig: QuizConfig = {
      ...config,
      questionCount: questionsPerChunk,
    };

    const systemPrompt = getQuizGenerationPrompt(chunkConfig, contextTopics);
    const userPrompt = `المستند التعليمي:\n\n${wrapUntrustedDocumentText(chunk.text)}`;

    try {
      const raw = await executeRoutedAiCall("question_generation", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [QUIZ_FUNCTION_TOOL],
        toolChoice: { type: "function", function: { name: "return_quiz" } },
      });

      const extracted = extractJsonFromResponse<{ questions?: unknown[] }>(raw);
      const rawQuestions = Array.isArray(extracted.questions)
        ? extracted.questions
        : Array.isArray(extracted)
          ? extracted
          : [];

      const verifiedQuestions: QuizQuestion[] = [];
      for (const rawQ of rawQuestions) {
        const sanitized = sanitizeAndEvaluateQuestion(rawQ, chunk.text);
        if (sanitized) {
          verifiedQuestions.push(sanitized);
        }
      }
      return verifiedQuestions;
    } catch (err) {
      console.error(`Error generating questions for chunk ${chunk.id}:`, err);
      return [];
    }
  });

  const settledResults = await Promise.allSettled(chunkPromises);
  const allCandidates: QuizQuestion[] = [];

  for (const res of settledResults) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allCandidates.push(...res.value);
    }
  }

  const deduplicated = deduplicateQuestions(allCandidates);

  if (deduplicated.length === 0) {
    throw new Error("تعذر استخراج أو توليد أسئلة صالحة ومؤصلة من هذا المستند. يرجى تجربة ملف آخر.");
  }

  // Return the requested question count
  return deduplicated.slice(0, config.questionCount);
}
