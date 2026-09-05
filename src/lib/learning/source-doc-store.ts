/**
 * Source Document Store — IndexedDB storage for original uploaded files.
 *
 * This enables "فتح المصدر" to open the actual original page from the PDF,
 * not just the extracted text snapshot.
 *
 * Architecture:
 * - OriginalDocument stores the file blob, name, mime type, size, and hash.
 * - Each ImportedQuestion references sourceDocumentId.
 * - The store is separate from MediaAsset store to keep concerns isolated.
 *
 * Cloudflare R2 persistent storage via uploadSourceDocumentServerFn.
 */

const DB_NAME = "quizy_source_docs_v1";
const DB_VERSION = 1;
const STORE_NAME = "source_documents";

let dbPromise: Promise<IDBDatabase> | null = null;

export interface StoredSourceDocument {
  /** Unique ID — used as sourceDocumentId in questions */
  id: string;
  /** Original filename as uploaded */
  fileName: string;
  /** MIME type (e.g. "application/pdf") */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 hash of the file blob for integrity checking */
  fileHash: string;
  /** Number of pages (for PDF) */
  pageCount: number;
  /** The original file blob */
  blob: Blob;
  /** When this document was stored */
  storedAt: number;
}

function openSourceDocDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

/**
 * Store an original source document in IndexedDB.
 * Returns the document ID (same as sourceDocumentId used in questions).
 */
export async function saveSourceDocument(doc: StoredSourceDocument): Promise<string> {
  const db = await openSourceDocDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(doc);
    req.onsuccess = () => resolve(doc.id);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve an original source document by ID.
 * Returns null if not found (file may have been cleared).
 */
export async function getSourceDocument(id: string): Promise<StoredSourceDocument | null> {
  const db = await openSourceDocDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as StoredSourceDocument) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete an original source document by ID.
 * Call when the user removes a question bank import.
 */
export async function deleteSourceDocument(id: string): Promise<void> {
  const db = await openSourceDocDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * List all stored source documents (for the "من الملفات" tab).
 */
export async function listSourceDocuments(): Promise<StoredSourceDocument[]> {
  const db = await openSourceDocDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredSourceDocument[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Check if a source document exists for the given ID.
 */
export async function hasSourceDocument(id: string): Promise<boolean> {
  const doc = await getSourceDocument(id).catch(() => null);
  return doc !== null;
}

/**
 * Open a source document page in a new browser tab (PDF).
 * For non-PDF types, downloads the file.
 */
export function openSourceDocumentPage(blob: Blob, fileName: string, page?: number): void {
  const url = URL.createObjectURL(blob);

  if (blob.type === "application/pdf" && page) {
    // PDF.js viewer supports #page= fragment
    window.open(`${url}#page=${page}`, "_blank", "noopener,noreferrer");
  } else {
    // For DOCX / TXT, trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  // Revoke after short delay to allow browser to start loading
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Compute SHA-256 of a File or Blob for integrity checking.
 */
export async function computeFileHash(blob: Blob): Promise<string> {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    return `file_hash_fallback_${blob.size}`;
  }
  const buf = await blob.arrayBuffer();
  const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Guard: is the source document store available?
 */
export function isSourceDocStoreAvailable(): boolean {
  return typeof window !== "undefined" && !!window.indexedDB;
}
