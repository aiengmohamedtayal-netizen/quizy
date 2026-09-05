import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveModelRoute } from "../src/lib/ai/router.ts";
import { latencyTracker } from "../src/lib/observability/latency-tracker.ts";

describe("AI Model Router & Latency Tracking", () => {
  test("resolves fast model for content_analysis and document_analysis", () => {
    const route = resolveModelRoute("content_analysis");
    assert.equal(route.task, "content_analysis");
    assert.ok(route.model.length > 0);
    assert.equal(route.temperature, 0.1);
    assert.equal(route.timeoutMs, 15000);
  });

  test("resolves appropriate model and parameters for question_generation", () => {
    const route = resolveModelRoute("question_generation");
    assert.equal(route.task, "question_generation");
    assert.ok(route.model.length > 0);
    assert.equal(route.temperature, 0.25);
    assert.equal(route.timeoutMs, 30000);
  });

  test("resolves reasoning model for difficult_reasoning task", () => {
    const route = resolveModelRoute("difficult_reasoning");
    assert.equal(route.task, "difficult_reasoning");
    assert.equal(route.timeoutMs, 40000);
  });

  test("resolves validation model for question_validation", () => {
    const route = resolveModelRoute("question_validation");
    assert.equal(route.task, "question_validation");
    assert.equal(route.temperature, 0.1);
    assert.equal(route.timeoutMs, 12000);
  });

  test("latency tracker accurately computes P50, P95, and error rates", () => {
    latencyTracker.clear();

    // Record sample metrics
    latencyTracker.recordMetric({
      task: "question_generation",
      model: "gpt-4o-mini",
      provider: "openai-compatible",
      latencyMs: 1500,
      success: true,
      fallbackUsed: false,
      validationPassed: true,
    });

    latencyTracker.recordMetric({
      task: "question_generation",
      model: "gpt-4o-mini",
      provider: "openai-compatible",
      latencyMs: 2200,
      success: true,
      fallbackUsed: false,
      validationPassed: true,
    });

    latencyTracker.recordMetric({
      task: "question_generation",
      model: "gpt-4o-mini",
      provider: "openai-compatible",
      latencyMs: 3500,
      success: true,
      fallbackUsed: false,
      validationPassed: true,
    });

    const summary = latencyTracker.getSummary("question_generation");
    assert.equal(summary.totalCalls, 3);
    assert.equal(summary.successRate, 100);
    assert.equal(summary.timeoutRate, 0);
    assert.ok(summary.p50LatencyMs >= 1500 && summary.p50LatencyMs <= 2200);
    assert.ok(summary.p95LatencyMs >= 2200 && summary.p95LatencyMs <= 3500);
  });
});
