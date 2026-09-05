/**
 * Text normalization, chunking, and NormalizedDocument generation for raw text and TXT files.
 */

import type { DocumentPage, DocumentSection, NormalizedDocument } from "./normalized-document.ts";
import { analyzeDocumentQuality, analyzePageQuality } from "./quality-analyzer.ts";

export interface TextChunk {
  id: number;
  text: string;
  charCount: number;
  wordCount: number;
}

export function cleanAndNormalizeText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // Replace common non-printable or replacement characters
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFD]/g, " ");

  // Normalize Unicode
  text = text.normalize("NFKC");

  // Normalize various quotation marks and dashes
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");

  // Replace excessive spaces and tabs with single space while preserving intentional newlines
  text = text.replace(/[ \t]+/g, " ");

  // Collapse 3 or more consecutive linebreaks into 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Split large text into semantic chunks (by paragraphs or sections)
 * so we do not exceed model context budgets or dilute question quality.
 */
export function chunkText(text: string, maxChunkChars = 12000, overlapChars = 800): TextChunk[] {
  const cleaned = cleanAndNormalizeText(text);
  if (!cleaned) return [];

  if (cleaned.length <= maxChunkChars) {
    return [
      {
        id: 1,
        text: cleaned,
        charCount: cleaned.length,
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  const paragraphs = cleaned.split(/\n\s*\n/);
  let currentChunk = "";
  let chunkId = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 > maxChunkChars) {
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: chunkId++,
          text: currentChunk.trim(),
          charCount: currentChunk.trim().length,
          wordCount: currentChunk.trim().split(/\s+/).filter(Boolean).length,
        });
      }

      // Start new chunk with overlap from the tail of currentChunk if possible
      const tail = currentChunk.slice(-overlapChars).trim();
      currentChunk = (tail ? tail + "\n\n" : "") + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmed : trimmed;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: chunkId++,
      text: currentChunk.trim(),
      charCount: currentChunk.trim().length,
      wordCount: currentChunk.trim().split(/\s+/).filter(Boolean).length,
    });
  }

  return chunks;
}

/**
 * Parse plain text file into a unified NormalizedDocument.
 */
export function parseTextDocument(
  rawText: string,
  filename = "document.txt",
  fileSizeBytes = 0,
): NormalizedDocument {
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
    filename,
    type: "txt",
    pages,
    sections,
    text: cleaned,
    extractionQuality,
    extractionMethods: ["native_text"],
    metadata: {
      fileSizeBytes: fileSizeBytes || cleaned.length,
      pageCount: pages.length,
      totalDurationMs: 5,
    },
  };
}
