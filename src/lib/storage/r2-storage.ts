/**
 * Cloudflare R2 Storage Service
 *
 * Provides persistent object storage for:
 * - Original uploaded source documents (PDF, DOCX, TXT)
 * - Extracted page images and figures
 * - Media assets referenced by Exact Source questions
 *
 * Never stores large binary/base64 payloads directly in Neon PostgreSQL.
 * Only the generated `storageKey` is recorded in Neon.
 */

export interface StorageUploadResult {
  key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageDownloadResult {
  data: ArrayBuffer;
  mimeType?: string;
  sizeBytes: number;
}

// In-memory fallback for local development & unit testing environments
const localFallbackStore = new Map<string, { data: ArrayBuffer; mimeType?: string }>();

export interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
    size: number;
  } | null>;
  delete(key: string | string[]): Promise<void>;
}

/**
 * Resolves the active Cloudflare R2 bucket binding if present in the runtime context.
 */
export function getR2Bucket(): R2BucketBinding | null {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as Record<string, unknown>;
    if (g.QUIZY_BUCKET) return g.QUIZY_BUCKET as R2BucketBinding;
    const env = g.__env__ as Record<string, unknown> | undefined;
    if (env?.QUIZY_BUCKET) return env.QUIZY_BUCKET as R2BucketBinding;
  }
  if (typeof process !== "undefined") {
    const pEnv = process.env as Record<string, unknown>;
    if (pEnv?.QUIZY_BUCKET) return pEnv.QUIZY_BUCKET as R2BucketBinding;
  }
  return null;
}

/**
 * Upload a file to Cloudflare R2 (or fallback storage).
 *
 * @param key Unique storage key (e.g., `docs/abc-123.pdf` or `media/fig-1.png`)
 * @param data ArrayBuffer, Uint8Array, Blob, or string
 * @param mimeType MIME content type
 */
export async function uploadFile(
  key: string,
  data: ArrayBuffer | Uint8Array | Blob | string,
  mimeType = "application/octet-stream",
): Promise<StorageUploadResult> {
  let arrayBuffer: ArrayBuffer;

  if (typeof data === "string") {
    arrayBuffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Blob) {
    arrayBuffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    arrayBuffer = (data.buffer as ArrayBuffer).slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
  } else {
    arrayBuffer = data as ArrayBuffer;
  }

  const bucket = getR2Bucket();
  if (bucket && typeof bucket.put === "function") {
    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: mimeType },
    });
  } else {
    // Local memory fallback
    localFallbackStore.set(key, { data: arrayBuffer, mimeType });
  }

  return {
    key,
    url: getFileUrl(key),
    sizeBytes: arrayBuffer.byteLength,
    mimeType,
  };
}

/**
 * Download a file from Cloudflare R2 (or fallback storage).
 *
 * @param key The object storage key
 */
export async function downloadFile(key: string): Promise<StorageDownloadResult | null> {
  const bucket = getR2Bucket();
  if (bucket && typeof bucket.get === "function") {
    const object = await bucket.get(key);
    if (!object) return null;
    const data = await object.arrayBuffer();
    return {
      data,
      mimeType: object.httpMetadata?.contentType,
      sizeBytes: object.size,
    };
  }

  const fallback = localFallbackStore.get(key);
  if (!fallback) return null;

  return {
    data: fallback.data,
    mimeType: fallback.mimeType,
    sizeBytes: fallback.data.byteLength,
  };
}

/**
 * Delete a file from Cloudflare R2 (or fallback storage).
 *
 * @param key The object storage key
 */
export async function deleteFile(key: string): Promise<void> {
  const bucket = getR2Bucket();
  if (bucket && typeof bucket.delete === "function") {
    await bucket.delete(key);
    return;
  }

  localFallbackStore.delete(key);
}

/**
 * Generate a reference URL for the stored file.
 *
 * @param key The object storage key
 */
export function getFileUrl(key: string): string {
  return `/api/storage/${encodeURIComponent(key)}`;
}

/**
 * Test helper to clear memory storage between unit tests.
 */
export function clearLocalFallbackStore(): void {
  localFallbackStore.clear();
}
