/**
 * DOCX document text extraction using mammoth with NormalizedDocument output.
 */

import type { DocumentPage, DocumentSection, NormalizedDocument } from "./normalized-document.ts";
import { analyzeDocumentQuality, analyzePageQuality } from "./quality-analyzer.ts";
import { cleanAndNormalizeText, chunkText } from "./text-parser.ts";

export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

export async function extractDocxDocument(file: File): Promise<NormalizedDocument> {
  const startTime = Date.now();
  const rawText = await extractTextFromDocx(file);
  const cleaned = cleanAndNormalizeText(rawText);
  const chunks = chunkText(cleaned, 4000, 200);

  const pages: DocumentPage[] = chunks.map((chunk, idx) => {
    const quality = analyzePageQuality(idx + 1, chunk.text);
    return {
      pageNumber: idx + 1,
      text: chunk.text,
      source: "native",
      confidence: quality.confidence,
      charCount: chunk.charCount,
      wordCount: chunk.wordCount,
      meaningfulWordCount: quality.meaningfulWordCount,
    };
  });

  const extractionQuality = analyzeDocumentQuality({
    pages,
    extractionMethod: "direct",
  });

  const sections: DocumentSection[] = pages.map((p) => ({
    id: `sec_p${p.pageNumber}`,
    title: `قسم ${p.pageNumber}`,
    startPage: p.pageNumber,
    endPage: p.pageNumber,
    text: p.text,
    wordCount: p.wordCount,
  }));

  return {
    id: "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    filename: file.name,
    type: "docx",
    pages,
    sections,
    text: cleaned,
    extractionQuality,
    extractionMethods: ["native_text"],
    metadata: {
      fileSizeBytes: file.size,
      pageCount: pages.length,
      totalDurationMs: Date.now() - startTime,
    },
  };
}
