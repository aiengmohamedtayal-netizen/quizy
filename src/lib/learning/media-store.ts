/**
 * Media Store — IndexedDB-backed storage for media assets extracted
 * from question bank documents.
 *
 * IMPORTANT: MediaAsset blobs are NEVER stored in localStorage.
 * Only media IDs are stored alongside question metadata.
 *
 * Questions reference media by ID via QuestionMediaRef[].
 * Call getObjectUrl(id) to get a temporary URL for rendering.
 * Object URLs are revoked when no longer needed.
 */

import type { MediaAsset } from "./exact-import-types";

const DB_NAME = "quizy_media_v1";
const DB_VERSION = 1;
const STORE_NAME = "media_assets";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("sourceDocumentId", "sourceDocumentId", { unique: false });
        store.createIndex("sourcePage", "sourcePage", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/**
 * Save a media asset to IndexedDB.
 * Returns the saved asset ID.
 */
export async function saveMediaAsset(asset: MediaAsset): Promise<string> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(asset);
    request.onsuccess = () => resolve(asset.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a media asset from IndexedDB by ID.
 * Returns null if not found.
 */
export async function getMediaAsset(id: string): Promise<MediaAsset | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as MediaAsset) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all media assets for a specific source document.
 */
export async function getMediaAssetsByDocument(documentId: string): Promise<MediaAsset[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sourceDocumentId");
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve(request.result as MediaAsset[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a media asset from IndexedDB by ID.
 */
export async function deleteMediaAsset(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all media assets for a specific source document.
 * Called when a question bank import is removed.
 */
export async function deleteMediaByDocument(documentId: string): Promise<void> {
  const assets = await getMediaAssetsByDocument(documentId);
  await Promise.all(assets.map((a) => deleteMediaAsset(a.id)));
}

// ---------------------------------------------------------------------------
// Object URL cache — tracks URLs created for a session
// ---------------------------------------------------------------------------

const objectUrlCache = new Map<string, string>();

/**
 * Get a temporary object URL for a media asset.
 * Creates a new URL if not cached. The URL is valid for the current session.
 *
 * Usage: `<img src={await getObjectUrl(mediaId)} />`
 */
export async function getObjectUrl(mediaId: string): Promise<string | null> {
  if (objectUrlCache.has(mediaId)) {
    return objectUrlCache.get(mediaId)!;
  }

  const asset = await getMediaAsset(mediaId);
  if (!asset) return null;

  const url = URL.createObjectURL(asset.blob);
  objectUrlCache.set(mediaId, url);
  return url;
}

/**
 * Revoke and clear a cached object URL to free memory.
 */
export function revokeObjectUrl(mediaId: string): void {
  const url = objectUrlCache.get(mediaId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(mediaId);
  }
}

/**
 * Revoke all cached object URLs. Call on unmount of major components.
 */
export function revokeAllObjectUrls(): void {
  for (const [id, url] of objectUrlCache.entries()) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(id);
  }
}

/**
 * Check if IndexedDB is available (server-side rendering guard).
 */
export function isMediaStoreAvailable(): boolean {
  return typeof window !== "undefined" && !!window.indexedDB;
}
