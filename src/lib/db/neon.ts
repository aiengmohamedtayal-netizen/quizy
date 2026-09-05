/**
 * Neon PostgreSQL Client & Connection Manager
 *
 * Server-only database connection using @neondatabase/serverless.
 * Communicates with Neon over HTTP/WebSocket connection pooling.
 * Never expose credentials to client-side bundles.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY ERROR: Database client imported in browser environment!");
}

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Please configure it in your environment or secrets.",
    );
  }
  return url;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
}

/**
 * Returns a Neon SQL tagged-template function.
 * Caches the client instance for reuse across server invocations.
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;
  const url = getDatabaseUrl();
  cachedSql = neon(url);
  return cachedSql;
}
