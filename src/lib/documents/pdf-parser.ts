/**
 * Resilient PDF Ingestion Engine.
 * Extracts text page-by-page, analyzes extraction quality per page,
 * renders problematic/scanned pages for server-side OCR fallback,
 * and merges native and OCR text in exact sequence into a NormalizedDocument.
 */

import type {
  DocumentPage,
  DocumentSection,
  NormalizedDocument,
  ExtractionQuality,
} from "./normalized-document.ts";
import { DocumentIngestionError } from "./normalized-document.ts";
import { analyzePageQuality, analyzeDocumentQuality } from "./quality-analyzer.ts";
import { cleanAndNormalizeText } from "./text-parser.ts";
import type { OCRBatchResult, OCRPageRequest } from "./ocr/types.ts";

interface PdfPage {
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> };
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
  getDocument: (opts: { data: ArrayBuffer }) => {
    promise: Promise<PdfDocument>;
  };
}

export interface PdfExtractionOptions {
  onProgress?: (stage: string, current: number, total: number) => void;
  ocrPageFetcher?: (pages: OCRPageRequest[]) => Promise<OCRBatchResult>;
  forceOcr?: boolean;
}

export async function extractPagesFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  filename = "document.pdf",
  options?: PdfExtractionOptions,
): Promise<NormalizedDocument> {
  const startTime = Date.now();
  const pdfjs = (await import("pdfjs-dist/build/pdf.mjs")) as unknown as PdfJsLib;

  // Use matching version CDN worker
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const fileSizeBytes = arrayBuffer.byteLength;

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  if (numPages === 0) {
    throw new DocumentIngestionError({
      code: "INSUFFICIENT_CONTENT",
      messageAr: "ملف الـ PDF فارغ ولا يحتوي على أي صفحات.",
      technicalDetails: "PDF contains 0 pages",
    });
  }

  options?.onProgress?.("فحص صفحات الملف", 0, numPages);

  // Phase 1: Native Text Extraction & Per-Page Quality Assessment
  const rawPages: Array<{
    pageNumber: number;
    text: string;
    pdfPage: PdfPage;
    needsOcr: boolean;
  }> = [];

  const pagesNeedingOcr: number[] = [];

  for (let i = 1; i <= numPages; i++) {
    options?.onProgress?.("استخراج النصوص من الصفحات", i, numPages);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageRawText = content.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");

    const cleanedText = cleanAndNormalizeText(pageRawText);
    const quality = analyzePageQuality(i, cleanedText);

    const needsOcr = options?.forceOcr || quality.needsOcr;
    if (needsOcr) {
      pagesNeedingOcr.push(i);
    }

    rawPages.push({
      pageNumber: i,
      text: cleanedText,
      pdfPage: page,
      needsOcr,
    });
  }

  // Phase 2: Targeted Smart OCR for pages that require it
  let ocrDurationMs = 0;
  const ocrResultsMap = new Map<number, string>();
  const ocrPageNumbers: number[] = [];

  if (pagesNeedingOcr.length > 0 && options?.ocrPageFetcher && typeof document !== "undefined") {
    options?.onProgress?.("قراءة الصفحات المصورة (OCR)", 0, pagesNeedingOcr.length);
    const ocrRequests: OCRPageRequest[] = [];

    for (let idx = 0; idx < pagesNeedingOcr.length; idx++) {
      const pageNum = pagesNeedingOcr[idx];
      const rawPageObj = rawPages[pageNum - 1];

      options?.onProgress?.("تجهيز الصفحات المصورة للقراءة", idx + 1, pagesNeedingOcr.length);

      try {
        const viewport = rawPageObj.pdfPage.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await rawPageObj.pdfPage.render({ canvasContext: ctx, viewport }).promise;
          const base64Data = canvas.toDataURL("image/jpeg", 0.85);
          ocrRequests.push({
            pageNumber: pageNum,
            imageBufferBase64: base64Data,
            mimeType: "image/jpeg",
          });
          ocrPageNumbers.push(pageNum);
        }
      } catch (renderErr) {
        console.warn(`[PDF Parser] Canvas render failed for page ${pageNum}:`, renderErr);
      }
    }

    if (ocrRequests.length > 0) {
      options?.onProgress?.("قراءة النصوص البصرية عبر الذكاء الاصطناعي", 0, ocrRequests.length);
      const ocrBatch = await options.ocrPageFetcher(ocrRequests);
      ocrDurationMs = ocrBatch.totalDurationMs;

      for (const pageRes of ocrBatch.pages) {
        if (pageRes.text && pageRes.text.trim().length > 0) {
          ocrResultsMap.set(pageRes.pageNumber, cleanAndNormalizeText(pageRes.text));
        }
      }
    }
  }

  // Phase 3: Construct DocumentPages merging native + OCR in correct sequence
  const finalPages: DocumentPage[] = [];
  const extractionMethodsUsed = new Set<"native_text" | "ocr">();

  for (const rawPage of rawPages) {
    const ocrText = ocrResultsMap.get(rawPage.pageNumber);
    const hasOcr = typeof ocrText === "string" && ocrText.trim().length > 0;

    const finalText = hasOcr ? ocrText : rawPage.text;
    const source: "native" | "ocr" = hasOcr ? "ocr" : "native";
    extractionMethodsUsed.add(hasOcr ? "ocr" : "native_text");

    const quality = analyzePageQuality(rawPage.pageNumber, finalText);
    const words = finalText.split(/\s+/).filter(Boolean);

    finalPages.push({
      pageNumber: rawPage.pageNumber,
      text: finalText,
      source,
      confidence: quality.confidence,
      charCount: finalText.length,
      wordCount: words.length,
      meaningfulWordCount: quality.meaningfulWordCount,
    });
  }

  // Phase 4: Overall Quality Evaluation
  const overallQuality: ExtractionQuality = analyzeDocumentQuality({
    pages: finalPages,
    extractionMethod:
      extractionMethodsUsed.size > 1
        ? "hybrid"
        : extractionMethodsUsed.has("ocr")
          ? "ocr"
          : "native_text",
  });

  // If the document is totally scanned and no OCR was executed or usable
  if (overallQuality.confidence === "FAILED") {
    if (overallQuality.isScanned) {
      throw new DocumentIngestionError({
        code: "SCANNED_DOCUMENT",
        messageAr:
          "الملف ده عبارة عن صور ممسوحة ضوئياً ومفيهوش نص قابل للقراءة مباشرة. يمكنك تفعيل القراءة البصرية (OCR) أو رفع نسخة رقمية.",
        extractionQuality: overallQuality,
        canProceedWithPartial: false,
      });
    }

    throw new DocumentIngestionError({
      code: "INSUFFICIENT_CONTENT",
      messageAr:
        "المحتوى المقروء غير كافٍ لإنشاء كويز موثوق (أقل من 25 كلمة مفيدة). يرجى التأكد من وضوح نصوص الملف.",
      extractionQuality: overallQuality,
      canProceedWithPartial: false,
    });
  }

  // Assemble full merged text
  const fullText = finalPages
    .map((p) => (p.text ? `--- صفحة ${p.pageNumber} ---\n${p.text}` : ""))
    .filter(Boolean)
    .join("\n\n");

  // Build page-aware sections
  const sections: DocumentSection[] = finalPages.map((p) => ({
    id: `sec_p${p.pageNumber}`,
    title: `صفحة ${p.pageNumber}`,
    startPage: p.pageNumber,
    endPage: p.pageNumber,
    text: p.text,
    wordCount: p.wordCount,
  }));

  const totalDurationMs = Date.now() - startTime;

  return {
    id: "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    filename,
    type: "pdf",
    pages: finalPages,
    sections,
    text: fullText,
    extractionQuality: overallQuality,
    extractionMethods: Array.from(extractionMethodsUsed),
    metadata: {
      fileSizeBytes,
      pageCount: numPages,
      extractionDurationMs: totalDurationMs - ocrDurationMs,
      ocrDurationMs,
      totalDurationMs,
      ocrPageNumbers,
    },
  };
}

/**
 * Legacy backwards-compatible export
 */
export async function extractTextFromPdf(
  file: File,
  options?: PdfExtractionOptions,
): Promise<string> {
  const normDoc = await extractPagesFromPdf(file, file.name, options);
  return normDoc.text;
}
