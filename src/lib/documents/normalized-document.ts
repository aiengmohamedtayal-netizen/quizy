/**
 * Common representation for all ingested documents in Quizy.
 * Unifies PDF, DOCX, and TXT inputs with page-level tracking,
 * extraction quality metrics, and source annotations.
 */

export type ConfidenceLevel = "EXCELLENT" | "GOOD" | "PARTIAL" | "POOR" | "FAILED";

export type ExtractionMethod = "native_text" | "ocr" | "hybrid" | "direct";

export type DocumentType = "pdf" | "docx" | "txt";

export interface PageQuality {
  pageNumber: number;
  charCount: number;
  wordCount: number;
  meaningfulWordCount: number;
  suspiciousCharacterRatio: number;
  whitespaceRatio: number;
  isScanned: boolean;
  needsOcr: boolean;
  confidence: "EXCELLENT" | "GOOD" | "PARTIAL" | "POOR" | "EMPTY";
  reason?: string;
}

export interface ExtractionQuality {
  pageCount: number;
  pagesWithText: number;
  pagesWithoutText: number;
  characterCount: number;
  wordCount: number;
  meaningfulWordCount: number;
  suspiciousCharacterRatio: number;
  whitespaceRatio: number;
  averageCharactersPerPage: number;
  extractionMethod: ExtractionMethod;
  isScanned: boolean;
  isPartial: boolean;
  isUsable: boolean;
  confidence: ConfidenceLevel;
  reason: string;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
  source: "native" | "ocr";
  confidence: "EXCELLENT" | "GOOD" | "PARTIAL" | "POOR" | "EMPTY";
  charCount: number;
  wordCount: number;
  meaningfulWordCount: number;
}

export interface DocumentSection {
  id: string;
  title?: string;
  startPage: number;
  endPage: number;
  text: string;
  wordCount: number;
}

export interface NormalizedDocument {
  id: string;
  filename: string;
  type: DocumentType;
  pages: DocumentPage[];
  sections: DocumentSection[];
  text: string;
  extractionQuality: ExtractionQuality;
  extractionMethods: ("native_text" | "ocr")[];
  metadata: {
    fileSizeBytes: number;
    pageCount: number;
    detectedLanguage?: "ar" | "en" | "mixed";
    extractionDurationMs?: number;
    ocrDurationMs?: number;
    totalDurationMs?: number;
    ocrPageNumbers?: number[];
    [key: string]: unknown;
  };
}

export interface DocumentIngestionErrorDetails {
  code:
    | "SCANNED_DOCUMENT"
    | "PARTIAL_EXTRACTION"
    | "OCR_PROCESSING"
    | "OCR_FAILED"
    | "INSUFFICIENT_CONTENT"
    | "GENERATION_FAILED"
    | "UNSUPPORTED_FORMAT"
    | "FILE_TOO_LARGE";
  messageAr: string;
  technicalDetails?: string;
  extractionQuality?: ExtractionQuality;
  canProceedWithPartial?: boolean;
}

export class DocumentIngestionError extends Error {
  public details: DocumentIngestionErrorDetails;

  constructor(details: DocumentIngestionErrorDetails) {
    super(details.messageAr);
    this.name = "DocumentIngestionError";
    this.details = details;
  }
}
