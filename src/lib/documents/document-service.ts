/**
 * Document Ingestion Service.
 * Implements the complete resilient pipeline:
 * File validation → Format detection → Primary extraction → Extraction quality analysis
 * → OCR fallback when required → Text normalization → Page-aware chunking → NormalizedDocument.
 */

import { extractDocxDocument, extractTextFromDocx } from "./docx-parser.ts";
import { extractPagesFromPdf, extractTextFromPdf } from "./pdf-parser.ts";
import type { PdfExtractionOptions } from "./pdf-parser.ts";
import { parseTextDocument } from "./text-parser.ts";
import { DocumentIngestionError } from "./normalized-document.ts";
import type { NormalizedDocument, DocumentType } from "./normalized-document.ts";

export { DocumentIngestionError };
export type { NormalizedDocument };

export interface ParsedDocument {
  name: string;
  sizeBytes: number;
  extension: DocumentType;
  text: string;
  charCount: number;
  wordCount: number;
  normalizedDoc?: NormalizedDocument;
}

export const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30MB
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

export async function parseAndValidateDocument(
  file: File,
  options?: PdfExtractionOptions,
): Promise<ParsedDocument> {
  if (!file) {
    throw new DocumentIngestionError({
      code: "INSUFFICIENT_CONTENT",
      messageAr: "لم يتم تحديد أي ملف.",
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new DocumentIngestionError({
      code: "FILE_TOO_LARGE",
      messageAr: "حجم الملف يتجاوز الحد الأقصى المسموح به (30 ميجابايت).",
    });
  }

  const name = file.name.toLowerCase();
  let extension: DocumentType;
  let normalizedDoc: NormalizedDocument;

  if (name.endsWith(".txt")) {
    extension = "txt";
    options?.onProgress?.("قراءة محتوى الملف النصي", 1, 1);
    const rawText = await file.text();
    normalizedDoc = parseTextDocument(rawText, file.name, file.size);
  } else if (name.endsWith(".docx")) {
    extension = "docx";
    options?.onProgress?.("قراءة واستخراج محتوى مستند Word", 1, 1);
    normalizedDoc = await extractDocxDocument(file);
  } else if (name.endsWith(".pdf")) {
    extension = "pdf";
    normalizedDoc = await extractPagesFromPdf(file, file.name, options);
  } else {
    throw new DocumentIngestionError({
      code: "UNSUPPORTED_FORMAT",
      messageAr: "صيغة الملف غير مدعومة. الصيغ المدعومة هي: PDF، DOCX، TXT.",
    });
  }

  // Quality check on the extracted NormalizedDocument
  const quality = normalizedDoc.extractionQuality;

  if (!quality.isUsable) {
    if (quality.isScanned) {
      throw new DocumentIngestionError({
        code: "SCANNED_DOCUMENT",
        messageAr: "الملف ده عبارة عن صور ومفيهوش نص قابل للقراءة مباشرة.",
        extractionQuality: quality,
      });
    }

    if (quality.meaningfulWordCount < 30) {
      throw new DocumentIngestionError({
        code: "INSUFFICIENT_CONTENT",
        messageAr: "المحتوى المقروء مش كافي لإنشاء كويز موثوق (أقل من 30 كلمة مفيدة).",
        extractionQuality: quality,
      });
    }

    throw new DocumentIngestionError({
      code: "PARTIAL_EXTRACTION",
      messageAr: quality.reason || "تعذر استخراج محتوى نصي كافٍ ومفهوم من هذا المستند.",
      extractionQuality: quality,
    });
  }

  return {
    name: file.name,
    sizeBytes: file.size,
    extension,
    text: normalizedDoc.text,
    charCount: normalizedDoc.text.length,
    wordCount: normalizedDoc.extractionQuality.wordCount,
    normalizedDoc,
  };
}

export { extractTextFromDocx, extractTextFromPdf };
