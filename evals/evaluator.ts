import { runComprehensiveBenchmark } from "./benchmark-runner.ts";
import { evaluateQuestionQuality } from "../src/lib/learning/quality-evaluator.ts";
import type { QuizQuestion } from "../src/lib/ai/schemas.ts";
import goldenQuestions from "./fixtures/golden-questions.json" with { type: "json" };
import multilingualDataset from "./fixtures/multilingual-dataset.json" with { type: "json" };

export interface EvalSummary {
  totalEvaluated: number;
  validRate: number; // 0 - 100
  avgGroundingScore: number;
  avgClarityScore: number;
  avgDistractorScore: number;
  avgOverallScore: number;
}

export function runEvaluations(questions: QuizQuestion[]): EvalSummary {
  if (questions.length === 0) {
    return {
      totalEvaluated: 0,
      validRate: 0,
      avgGroundingScore: 0,
      avgClarityScore: 0,
      avgDistractorScore: 0,
      avgOverallScore: 0,
    };
  }

  let validCount = 0;
  let totalGrounding = 0;
  let totalClarity = 0;
  let totalDistractor = 0;
  let totalOverall = 0;

  for (const q of questions) {
    const res = evaluateQuestionQuality(q, q.evidenceQuote);
    if (res.isValid) validCount++;
    totalGrounding += res.qualityScore.groundingScore;
    totalClarity += res.qualityScore.clarityScore;
    totalDistractor += res.qualityScore.distractorScore;
    totalOverall += res.qualityScore.overallScore;
  }

  const n = questions.length;
  return {
    totalEvaluated: n,
    validRate: Math.round((validCount / n) * 100),
    avgGroundingScore: Math.round(totalGrounding / n),
    avgClarityScore: Math.round(totalClarity / n),
    avgDistractorScore: Math.round(totalDistractor / n),
    avgOverallScore: Math.round(totalOverall / n),
  };
}

// Self-test with multilingual golden benchmark
if (import.meta.main || process.argv[1]?.includes("evaluator")) {
  const allQuestions = [
    ...(goldenQuestions as unknown as QuizQuestion[]),
    ...(multilingualDataset as unknown as QuizQuestion[]),
  ];

  const summary = runEvaluations(allQuestions);
  console.log("\n=== Quizy AI Evaluation Benchmark ===");
  console.log(`Evaluated: ${summary.totalEvaluated} questions (Arabic, English, Mixed)`);
  console.log(`Validity Rate: ${summary.validRate}%`);
  console.log(`Avg Grounding Score: ${summary.avgGroundingScore}/100`);
  console.log(`Avg Clarity Score: ${summary.avgClarityScore}/100`);
  console.log(`Avg Distractor Quality: ${summary.avgDistractorScore}/100`);
  console.log(`Composite Quality Score: ${summary.avgOverallScore}/100\n`);

  // Also execute comprehensive benchmark runner
  runComprehensiveBenchmark();
}
