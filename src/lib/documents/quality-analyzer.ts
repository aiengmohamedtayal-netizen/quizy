/**
 * Multi-signal extraction quality analyzer for documents and PDF pages.
 * Evaluates text integrity, noise ratios, lexical meaningfulness,
 * and page-level coverage without relying on single arbitrary thresholds.
 */

import type {
  ConfidenceLevel,
  ExtractionMethod,
  ExtractionQuality,
  PageQuality,
} from "./normalized-document.ts";

// Pattern for meaningful words in Arabic, Latin, or STEM terminology (at least 2 characters)
const MEANINGFUL_WORD_REGEX = /[\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9_\u0370-\u03FF]{2,}/g;

// Suspicious/corrupt characters: Unicode replacement characters, unprintable ASCII controls, unassigned PUA blocks
// eslint-disable-next-line no-control-regex
const SUSPICIOUS_CHAR_REGEX = /[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F\uE000-\uF8FF]/g;

export function analyzePageQuality(pageNumber: number, text: string): PageQuality {
  const trimmed = (text || "").trim();
  const charCount = trimmed.length;

  if (charCount === 0) {
    return {
      pageNumber,
      charCount: 0,
      wordCount: 0,
      meaningfulWordCount: 0,
      suspiciousCharacterRatio: 0,
      whitespaceRatio: 1,
      isScanned: true,
      needsOcr: true,
      confidence: "EMPTY",
      reason:
        "الصفحة خالية تماماً من النصوص القابلة للقراءة المباشرة (قد تكون صورة ممسوحة ضوئياً).",
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const meaningfulMatches = trimmed.match(MEANINGFUL_WORD_REGEX) || [];
  const meaningfulWordCount = meaningfulMatches.length;

  const suspiciousMatches = trimmed.match(SUSPICIOUS_CHAR_REGEX) || [];
  const suspiciousCharacterRatio = charCount > 0 ? suspiciousMatches.length / charCount : 0;

  const rawLength = (text || "").length;
  const whitespaceCount = (text || "").match(/\s/g)?.length || 0;
  const whitespaceRatio = rawLength > 0 ? whitespaceCount / rawLength : 0;

  // Evaluate if the page appears scanned or has severe font encoding corruption
  const isScanned = meaningfulWordCount < 10 && (charCount < 40 || suspiciousCharacterRatio > 0.4);
  const needsOcr =
    isScanned ||
    suspiciousCharacterRatio > 0.35 ||
    (charCount < 50 && meaningfulWordCount < 5) ||
    (wordCount > 10 && meaningfulWordCount / wordCount < 0.3);

  let confidence: "EXCELLENT" | "GOOD" | "PARTIAL" | "POOR" | "EMPTY";
  let reason = "";

  if (charCount === 0) {
    confidence = "EMPTY";
    reason = "صفحة فارغة أو صورة فقط.";
  } else if (suspiciousCharacterRatio > 0.35 || (charCount > 0 && meaningfulWordCount < 5)) {
    confidence = "POOR";
    reason = "نص مشوه أو رموز غير واضحة (قد تكون بسبب ترميز خطوط غير قياسي أو مسح ضوئي ضعيف).";
  } else if (meaningfulWordCount < 15 || suspiciousCharacterRatio > 0.2) {
    confidence = "PARTIAL";
    reason = "محتوى نصي جزئي أو قصير.";
  } else if (meaningfulWordCount < 50) {
    confidence = "GOOD";
    reason = "محتوى نصي واضح وجيد.";
  } else {
    confidence = "EXCELLENT";
    reason = "محتوى نصي متكامل وعالي الجودة.";
  }

  return {
    pageNumber,
    charCount,
    wordCount,
    meaningfulWordCount,
    suspiciousCharacterRatio: Number(suspiciousCharacterRatio.toFixed(3)),
    whitespaceRatio: Number(whitespaceRatio.toFixed(3)),
    isScanned,
    needsOcr,
    confidence,
    reason,
  };
}

export interface DocumentQualityInput {
  pages: Array<{
    pageNumber: number;
    text: string;
    source?: "native" | "ocr";
  }>;
  extractionMethod?: ExtractionMethod;
}

export function analyzeDocumentQuality(input: DocumentQualityInput): ExtractionQuality {
  const { pages, extractionMethod = "native_text" } = input;
  const pageCount = pages.length;

  if (pageCount === 0) {
    return {
      pageCount: 0,
      pagesWithText: 0,
      pagesWithoutText: 0,
      characterCount: 0,
      wordCount: 0,
      meaningfulWordCount: 0,
      suspiciousCharacterRatio: 0,
      whitespaceRatio: 0,
      averageCharactersPerPage: 0,
      extractionMethod,
      isScanned: false,
      isPartial: false,
      isUsable: false,
      confidence: "FAILED",
      reason: "المستند فارغ تماماً ولا يحتوي على أي صفحات.",
    };
  }

  let totalChars = 0;
  let totalWords = 0;
  let totalMeaningfulWords = 0;
  let totalSuspiciousChars = 0;
  let totalWhitespace = 0;
  let pagesWithText = 0;
  let pagesWithoutText = 0;
  let scannedPagesCount = 0;

  for (const page of pages) {
    const pageQuality = analyzePageQuality(page.pageNumber, page.text);

    totalChars += pageQuality.charCount;
    totalWords += pageQuality.wordCount;
    totalMeaningfulWords += pageQuality.meaningfulWordCount;
    totalWhitespace += Math.round(pageQuality.whitespaceRatio * (page.text?.length || 0));

    const suspiciousMatches = (page.text || "").match(SUSPICIOUS_CHAR_REGEX) || [];
    totalSuspiciousChars += suspiciousMatches.length;

    if (pageQuality.charCount > 25 && pageQuality.meaningfulWordCount >= 6) {
      pagesWithText++;
    } else {
      pagesWithoutText++;
    }

    if (pageQuality.isScanned || pageQuality.confidence === "EMPTY") {
      scannedPagesCount++;
    }
  }

  const suspiciousCharacterRatio =
    totalChars > 0 ? Number((totalSuspiciousChars / totalChars).toFixed(3)) : 0;
  const rawTotalLen = pages.reduce((acc, p) => acc + (p.text?.length || 0), 0);
  const whitespaceRatio = rawTotalLen > 0 ? Number((totalWhitespace / rawTotalLen).toFixed(3)) : 0;
  const averageCharactersPerPage = pageCount > 0 ? Math.round(totalChars / pageCount) : 0;

  const isAllScanned = scannedPagesCount === pageCount;
  const isPartiallyScanned = scannedPagesCount > 0 && scannedPagesCount < pageCount;
  const textCoverageRatio = pagesWithText / pageCount;

  let confidence: ConfidenceLevel;
  let isUsable = false;
  let reason = "";

  if (totalChars === 0 || totalMeaningfulWords === 0) {
    confidence = "FAILED";
    isUsable = false;
    reason = isAllScanned
      ? "الملف عبارة عن صور ممسوحة ضوئياً بالكامل ولا يحتوي على نصوص مباشرة."
      : "لم يتم العثور على أي نصوص قابلة للقراءة في الملف.";
  } else if (suspiciousCharacterRatio > 0.45 || totalMeaningfulWords < 30) {
    confidence = "FAILED";
    isUsable = false;
    reason =
      "النص المستخرج مشوه بشكل كبير أو قليل جداً (أقل من 30 كلمة مفيدة)، مما يمنع إنشاء كويز موثوق ومؤصل.";
  } else if (textCoverageRatio < 0.4 || (pageCount > 1 && totalMeaningfulWords < 50)) {
    confidence = "POOR";
    isUsable = totalMeaningfulWords >= 30;
    reason = isPartiallyScanned
      ? "تم قراءة جزء صغير فقط من الملف، ومعظم الصفحات عبارة عن صور أو غير واضحة."
      : "كثافة النص المستخرج منخفضة مقارنة بحجم المستند.";
  } else if (
    textCoverageRatio < 0.7 ||
    suspiciousCharacterRatio > 0.15 ||
    (pageCount > 1 && totalMeaningfulWords < 80)
  ) {
    confidence = "PARTIAL";
    isUsable = true;
    reason =
      "تم استخراج محتوى نصي جزئي كافٍ لإنشاء كويز، لكن بعض الصفحات تحتوي على صور أو نصوص مقتضبة.";
  } else if (
    textCoverageRatio < 0.95 ||
    (pageCount === 1 ? totalMeaningfulWords < 50 : totalMeaningfulWords < 150)
  ) {
    confidence = "GOOD";
    isUsable = true;
    reason = "تم استخراج محتوى نصي جيد جداً من غالبية صفحات المستند.";
  } else {
    confidence = "EXCELLENT";
    isUsable = true;
    reason = "تم استخراج محتوى تعليمي متكامل وممتاز وبدقة عالية من كافة الصفحات.";
  }

  return {
    pageCount,
    pagesWithText,
    pagesWithoutText,
    characterCount: totalChars,
    wordCount: totalWords,
    meaningfulWordCount: totalMeaningfulWords,
    suspiciousCharacterRatio,
    whitespaceRatio,
    averageCharactersPerPage,
    extractionMethod,
    isScanned: isAllScanned || isPartiallyScanned,
    isPartial: confidence === "PARTIAL" || (isPartiallyScanned && isUsable),
    isUsable,
    confidence,
    reason,
  };
}
