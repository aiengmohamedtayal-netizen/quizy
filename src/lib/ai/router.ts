import { callAiChatCompletion, type ChatCompletionOptions, getHeavyAiConfig } from "./provider.ts";
import { logEvent } from "../observability/logger.ts";
import { latencyTracker } from "../observability/latency-tracker.ts";

export type AiTaskType =
  | "content_analysis"
  | "concept_extraction"
  | "question_generation"
  | "question_validation"
  | "explanation_generation"
  | "tutor"
  | "difficult_reasoning"
  | "evaluation"
  | "exact_source_extraction"
  // Legacy backward-compatibility aliases
  | "document_analysis"
  | "quiz_generation"
  | "question_evaluation"
  | "ai_tutor"
  | "study_planning";

export interface ModelRouteConfig {
  task: AiTaskType;
  model: string;
  fallbackModel: string;
  temperature: number;
  timeoutMs: number;
  maxTokens?: number;
}

/**
 * Task-Aware Model Router.
 * Resolves the optimal model tier and parameters based on task demands and environment configuration.
 */
export function resolveModelRoute(task: AiTaskType): ModelRouteConfig {
  const defaultModel = process.env.AI_MODEL || "gpt-4o-mini";
  const fastModel = process.env.AI_FAST_MODEL || defaultModel;
  const reasoningModel = process.env.AI_REASONING_MODEL || defaultModel;

  // Granular task environment overrides
  const modelAnalysis = process.env.AI_MODEL_ANALYSIS || fastModel;
  const modelGeneration = process.env.AI_MODEL_GENERATION || defaultModel;
  const modelValidation = process.env.AI_MODEL_VALIDATION || fastModel;
  const modelTutor = process.env.AI_MODEL_TUTOR || defaultModel;
  const modelReasoning = process.env.AI_MODEL_REASONING || reasoningModel;
  const modelEvaluation = process.env.AI_MODEL_EVALUATION || defaultModel;

  switch (task) {
    case "content_analysis":
    case "concept_extraction":
    case "document_analysis":
      return {
        task,
        model: modelAnalysis,
        fallbackModel: defaultModel,
        temperature: 0.1,
        timeoutMs: 15000,
      };

    case "question_generation":
    case "quiz_generation":
      return {
        task,
        model: modelGeneration,
        fallbackModel: fastModel,
        temperature: 0.25,
        timeoutMs: 30000,
      };

    case "question_validation":
    case "question_evaluation":
      return {
        task,
        model: modelValidation,
        fallbackModel: defaultModel,
        temperature: 0.1,
        timeoutMs: 12000,
      };

    case "explanation_generation":
      return {
        task,
        model: modelGeneration,
        fallbackModel: fastModel,
        temperature: 0.2,
        timeoutMs: 15000,
      };

    case "tutor":
    case "ai_tutor":
      return {
        task,
        model: modelTutor,
        fallbackModel: fastModel,
        temperature: 0.35,
        timeoutMs: 20000,
      };

    case "difficult_reasoning":
      return {
        task,
        model: modelReasoning,
        fallbackModel: defaultModel,
        temperature: 0.2,
        timeoutMs: 40000,
      };

    case "evaluation":
      return {
        task,
        model: modelEvaluation,
        fallbackModel: fastModel,
        temperature: 0.1,
        timeoutMs: 25000,
      };

    case "study_planning":
      return {
        task,
        model: defaultModel,
        fallbackModel: fastModel,
        temperature: 0.2,
        timeoutMs: 20000,
      };

    case "exact_source_extraction":
      // Temperature MUST be 0.0 for exact source mode — no creativity allowed
      return {
        task,
        model: process.env.AI_MODEL_EXACT_EXTRACTION || defaultModel,
        fallbackModel: defaultModel,
        temperature: 0.0,
        timeoutMs: 45000,
        maxTokens: 8000,
      };
  }
}

/**
 * Executes an AI completion with task-aware routing, fallback handling, timing, and observability.
 *
 * Heavy tasks (difficult_reasoning, exact_source_extraction) are routed to the
 * secondary AI_FALLBACK_API_KEY (gpt-5.6-luna) when configured.
 * All other tasks use the primary AI_API_KEY.
 */
export async function executeRoutedAiCall(
  task: AiTaskType,
  options: Omit<ChatCompletionOptions, "temperature" | "model" | "fallbackModel" | "timeoutMs">,
): Promise<string> {
  const route = resolveModelRoute(task);
  const startTime = Date.now();
  const usedFallback = false;

  // Use secondary key for heavy tasks when configured
  const isHeavyTask = task === "difficult_reasoning" || task === "exact_source_extraction";
  const heavyConfig = isHeavyTask ? getHeavyAiConfig() : null;

  try {
    const result = await callAiChatCompletion({
      ...options,
      model: route.model,
      fallbackModel: route.fallbackModel,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      // Override API key for heavy tasks when secondary key is available
      ...(heavyConfig
        ? { _overrideApiKey: heavyConfig.apiKey, _overrideBaseUrl: heavyConfig.baseUrl }
        : {}),
    });

    const durationMs = Date.now() - startTime;

    latencyTracker.recordMetric({
      task,
      model: route.model,
      provider: "openai-compatible",
      latencyMs: durationMs,
      success: true,
      fallbackUsed: usedFallback,
      validationPassed: true,
    });

    logEvent("info", {
      category: "ai",
      operation: `ai_completion:${task}`,
      durationMs,
      metadata: {
        model: route.model,
        messagesCount: options.messages.length,
        responseLength: result.length,
      },
    });

    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      errorMsg.toLowerCase().includes("timeout") || errorMsg.toLowerCase().includes("aborted");

    latencyTracker.recordMetric({
      task,
      model: route.model,
      provider: "openai-compatible",
      latencyMs: durationMs,
      success: false,
      fallbackUsed: usedFallback,
      validationPassed: false,
      errorCode: isTimeout ? "TIMEOUT" : "ERROR",
    });

    logEvent("error", {
      category: "ai",
      operation: `ai_completion:${task}`,
      durationMs,
      metadata: { model: route.model },
      error: {
        code: isTimeout ? "AI_CALL_TIMEOUT" : "AI_CALL_FAILED",
        message: errorMsg,
      },
    });

    throw err;
  }
}
