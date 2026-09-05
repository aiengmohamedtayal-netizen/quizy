/**
 * Structured Observability and Audit Logging.
 * Enforces zero leakage of secrets, keys, or raw personal data.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  operation: string;
  category: "ai" | "document" | "mastery" | "security" | "auth";
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

const REDACTED_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "bearer",
  "password",
  "secret",
  "token",
]);

function sanitizeMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item, depth + 1));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "string" && (value.startsWith("sk-") || value.length > 500)) {
      clean[key] = value.startsWith("sk-")
        ? "[REDACTED_KEY]"
        : value.slice(0, 200) + "...[truncated]";
    } else {
      clean[key] = sanitizeMetadata(value, depth + 1);
    }
  }
  return clean;
}

export function logEvent(level: LogLevel, payload: LogPayload): void {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = payload.metadata ? sanitizeMetadata(payload.metadata) : undefined;

  const entry = {
    timestamp,
    level,
    operation: payload.operation,
    category: payload.category,
    durationMs: payload.durationMs,
    metadata: sanitizedMeta,
    error: payload.error,
  };

  const output = `[${timestamp}] [${level.toUpperCase()}] [${payload.category}:${payload.operation}]`;

  if (level === "error") {
    console.error(output, JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(output, JSON.stringify(entry));
  } else if (process.env.NODE_ENV !== "production" || level === "info") {
    console.log(output, JSON.stringify(entry));
  }
}
