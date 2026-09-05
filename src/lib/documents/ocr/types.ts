/**
 * Provider-agnostic OCR interface and types.
 * Allows transparently replacing OCR engines (Vision LLM, Cloud OCR, Tesseract, etc.)
 * without modifying document ingestion logic.
 */

export interface OCRPageRequest {
  pageNumber: number;
  /**
   * Base64 data URL or raw base64 string of the rendered page image
   */
  imageBufferBase64: string;
  mimeType?: string;
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  providerName: string;
  durationMs: number;
  meaningfulWordCount: number;
}

export interface OCRBatchRequest {
  pages: OCRPageRequest[];
  documentName?: string;
}

export interface OCRBatchResult {
  pages: OCRPageResult[];
  totalDurationMs: number;
  providerName: string;
}

export interface OCRProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  recognizePage(req: OCRPageRequest): Promise<OCRPageResult>;
  recognizeBatch(req: OCRBatchRequest): Promise<OCRBatchResult>;
}
