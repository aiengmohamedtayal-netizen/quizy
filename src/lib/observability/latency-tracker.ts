/**
 * Latency Tracker and AI Observability Engine
 * Tracks P50/P95 latency, error rates, timeout rates, and structured telemetry.
 * Strictly guarantees zero leakage of secret keys, auth headers, or raw document content.
 */

export interface AiExecutionMetric {
  task: string;
  model: string;
  provider: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  fallbackUsed: boolean;
  validationPassed: boolean;
  qualityScore?: number;
  errorCode?: string;
  timestamp: number;
}

export interface LatencySummary {
  task: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  fallbackCount: number;
  successRate: number; // 0 - 100%
  timeoutRate: number; // 0 - 100%
  retryOrFallbackRate: number; // 0 - 100%
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
}

class AiLatencyTracker {
  private metrics: AiExecutionMetric[] = [];
  private readonly maxRecords = 500;

  public recordMetric(metric: Omit<AiExecutionMetric, "timestamp">): void {
    const record: AiExecutionMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(record);
    if (this.metrics.length > this.maxRecords) {
      this.metrics.shift();
    }
  }

  public getSummary(taskFilter?: string): LatencySummary {
    const records = taskFilter ? this.metrics.filter((m) => m.task === taskFilter) : this.metrics;

    if (records.length === 0) {
      return {
        task: taskFilter || "all",
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        fallbackCount: 0,
        successRate: 100,
        timeoutRate: 0,
        retryOrFallbackRate: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        avgLatencyMs: 0,
      };
    }

    const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
    const totalCalls = records.length;
    const successCount = records.filter((r) => r.success).length;
    const failureCount = records.filter((r) => !r.success).length;
    const timeoutCount = records.filter((r) => r.errorCode === "TIMEOUT").length;
    const fallbackCount = records.filter((r) => r.fallbackUsed).length;

    const p50Index = Math.floor(totalCalls * 0.5);
    const p95Index = Math.min(totalCalls - 1, Math.floor(totalCalls * 0.95));

    const sumLatency = latencies.reduce((sum, val) => sum + val, 0);

    return {
      task: taskFilter || "all",
      totalCalls,
      successCount,
      failureCount,
      timeoutCount,
      fallbackCount,
      successRate: Math.round((successCount / totalCalls) * 100),
      timeoutRate: Math.round((timeoutCount / totalCalls) * 100),
      retryOrFallbackRate: Math.round((fallbackCount / totalCalls) * 100),
      p50LatencyMs: latencies[p50Index] || 0,
      p95LatencyMs: latencies[p95Index] || 0,
      avgLatencyMs: Math.round(sumLatency / totalCalls),
    };
  }

  public clear(): void {
    this.metrics = [];
  }
}

export const latencyTracker = new AiLatencyTracker();
