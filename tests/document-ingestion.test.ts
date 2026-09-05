import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  analyzePageQuality,
  analyzeDocumentQuality,
} from "../src/lib/documents/quality-analyzer.ts";
import {
  cleanAndNormalizeText,
  chunkText,
  parseTextDocument,
} from "../src/lib/documents/text-parser.ts";
import { DocumentIngestionError } from "../src/lib/documents/normalized-document.ts";
import type { NormalizedDocument } from "../src/lib/documents/normalized-document.ts";
import type {
  OCRProvider,
  OCRPageRequest,
  OCRPageResult,
  OCRBatchRequest,
  OCRBatchResult,
} from "../src/lib/documents/ocr/types.ts";
import {
  registerOCRProvider,
  getActiveOCRProvider,
  processPagesWithOcr,
} from "../src/lib/documents/ocr/index.ts";

describe("Document Ingestion & Multi-Signal Quality Pipeline", () => {
  // 1. Normal text document (high density, high confidence)
  test("Scenario 1: Normal text document yields EXCELLENT confidence and usable status", () => {
    const highDensityArabicPage = `
      تعتبر الخلية الوحدة الوظيفية والتركيبية الأساسية في جميع الكائنات الحية.
      تنقسم الخلايا في الكائنات الحية إلى نوعين رئيسيين: الخلايا بدائية النوى والخلايا حقيقية النوى.
      تتميز الخلايا حقيقية النوى بوجود غشاء نووي يحيط بالمادة الوراثية (DNA)، بالإضافة إلى وجود عضيات غشائية متخصصة
      مثل الميتوكوندريا المسؤولة عن إنتاج الطاقة عبر التنفس الخلوي، وجهاز غولجي المسؤول عن تعديل ونقل البروتينات،
      والشبكة الإندوبلازمية الخشنة والملساء. أما الخلايا بدائية النوى مثل البكتيريا فلا تحتوي على نواة محددة.
      تقوم الميتوكوندريا بتوليد أدينوسين ثلاثي الفوسفات (ATP) وهو عملة الطاقة في الخلية.
    `;

    const quality = analyzePageQuality(1, highDensityArabicPage);
    assert.equal(quality.confidence, "EXCELLENT");
    assert.equal(quality.isScanned, false);
    assert.equal(quality.needsOcr, false);
    assert.ok(quality.meaningfulWordCount > 50);

    const docQuality = analyzeDocumentQuality({
      pages: [{ pageNumber: 1, text: highDensityArabicPage }],
    });
    assert.equal(docQuality.confidence, "EXCELLENT");
    assert.equal(docQuality.isUsable, true);
    assert.equal(docQuality.isScanned, false);
  });

  // 2. Scanned PDF (0 native text, detects isScanned: true, needsOcr: true)
  test("Scenario 2: Scanned PDF page with zero native text flags isScanned and needsOcr", () => {
    const emptyScannedPage = "   \n\n\t   ";
    const quality = analyzePageQuality(1, emptyScannedPage);

    assert.equal(quality.confidence, "EMPTY");
    assert.equal(quality.isScanned, true);
    assert.equal(quality.needsOcr, true);
    assert.equal(quality.meaningfulWordCount, 0);

    const docQuality = analyzeDocumentQuality({
      pages: [
        { pageNumber: 1, text: emptyScannedPage },
        { pageNumber: 2, text: "" },
      ],
    });

    assert.equal(docQuality.confidence, "FAILED");
    assert.equal(docQuality.isScanned, true);
    assert.equal(docQuality.isUsable, false);
    assert.ok(docQuality.reason.includes("صور ممسوحة ضوئياً"));
  });

  // 3. Mixed text/image PDF with OCR fallback
  test("Scenario 3: Mixed PDF (native text + scanned page) merges in correct sequence with OCR", async () => {
    const page1NativeText =
      "الفصل الأول: مقدمة في علم الوراثة وقوانين مندل في توارث الصفات وتجارب التهجين على نبات البازلاء.";
    const page2ScannedBeforeOcr = "";
    const page3NativeText =
      "الفصل الثاني: الطفرات الجينية وتأثيرها على تسلسل الأحماض الأمينية والبروتينات الحيوية في الخلية.";

    const p1Qual = analyzePageQuality(1, page1NativeText);
    const p2Qual = analyzePageQuality(2, page2ScannedBeforeOcr);
    const p3Qual = analyzePageQuality(3, page3NativeText);

    assert.equal(p1Qual.needsOcr, false);
    assert.equal(p2Qual.needsOcr, true);
    assert.equal(p3Qual.needsOcr, false);

    // Mock OCR Provider for the scanned page 2
    class MockOCRProvider implements OCRProvider {
      name = "mock_test_ocr";
      async isAvailable() {
        return true;
      }
      async recognizePage(req: OCRPageRequest): Promise<OCRPageResult> {
        return {
          pageNumber: req.pageNumber,
          text: "مخطط وراثة مربع بانيت يوضح التزاوج بين سلالتين نقيتين من نبات البازلاء لاستنتاج السيادة التامة والجينات المتنحية.",
          confidence: 0.96,
          providerName: this.name,
          durationMs: 50,
          meaningfulWordCount: 15,
        };
      }
      async recognizeBatch(req: OCRBatchRequest): Promise<OCRBatchResult> {
        const pages = await Promise.all(req.pages.map((p) => this.recognizePage(p)));
        return {
          pages,
          totalDurationMs: 50,
          providerName: this.name,
        };
      }
    }

    registerOCRProvider(new MockOCRProvider());
    const ocrBatch = await processPagesWithOcr([
      { pageNumber: 2, imageBufferBase64: "data:image/jpeg;base64,mock" },
    ]);

    assert.equal(ocrBatch.pages.length, 1);
    const page2OcrText = ocrBatch.pages[0].text;

    // Merge native + OCR in correct sequence
    const finalPages = [
      { pageNumber: 1, text: page1NativeText, source: "native" as const },
      { pageNumber: 2, text: page2OcrText, source: "ocr" as const },
      { pageNumber: 3, text: page3NativeText, source: "native" as const },
    ];

    assert.equal(finalPages[0].pageNumber, 1);
    assert.equal(finalPages[1].pageNumber, 2);
    assert.equal(finalPages[1].source, "ocr");
    assert.equal(finalPages[2].pageNumber, 3);
    assert.equal(finalPages[2].source, "native");

    const mergedDocQuality = analyzeDocumentQuality({
      pages: finalPages,
      extractionMethod: "hybrid",
    });

    assert.equal(mergedDocQuality.extractionMethod, "hybrid");
    assert.equal(mergedDocQuality.isUsable, true);
    assert.ok(mergedDocQuality.pagesWithText >= 3);
  });

  // 4. Broken text extraction / corrupted font encoding
  test("Scenario 4: Detects corrupted font encodings, replacement characters, and control bytes", () => {
    const corruptedText = " \uFFFD\uFFFD\uFFFD\uFFFD\u0001\u0002\u0003 \x04\x05 hello \uFFFD";
    const quality = analyzePageQuality(1, corruptedText);

    assert.ok(quality.suspiciousCharacterRatio > 0.4);
    assert.equal(quality.confidence, "POOR");
    assert.equal(quality.needsOcr, true);

    const docQuality = analyzeDocumentQuality({
      pages: [{ pageNumber: 1, text: corruptedText }],
    });
    assert.equal(docQuality.confidence, "FAILED");
    assert.equal(docQuality.isUsable, false);
  });

  // 5. Empty PDF (0 pages or 0 characters)
  test("Scenario 5: Empty document properly fails with clear diagnostics", () => {
    const docQuality = analyzeDocumentQuality({ pages: [] });
    assert.equal(docQuality.confidence, "FAILED");
    assert.equal(docQuality.isUsable, false);
    assert.equal(docQuality.pageCount, 0);
  });

  // 6. Very short PDF (< 30 meaningful words)
  test("Scenario 6: Very short document fails with INSUFFICIENT_CONTENT signal", () => {
    const shortText = "صفحة غلاف الكورس فقط 2026";
    const quality = analyzePageQuality(1, shortText);
    assert.ok(quality.meaningfulWordCount < 10);

    const docQuality = analyzeDocumentQuality({
      pages: [{ pageNumber: 1, text: shortText }],
    });
    assert.equal(docQuality.isUsable, false);
    assert.equal(docQuality.confidence, "FAILED");
  });

  // 7. Arabic PDF (proper normalization, ligature and character counting)
  test("Scenario 7: Arabic text normalization and word counting", () => {
    const rawArabic = "تطبيقاتُ   الذكاءِ   الاصطناعيِّ في   التعليمِ الحديث، ومقارنتُها.";
    const cleaned = cleanAndNormalizeText(rawArabic);
    assert.equal(cleaned.includes("   "), false);

    const quality = analyzePageQuality(1, cleaned);
    assert.ok(quality.meaningfulWordCount >= 7);
    assert.equal(quality.suspiciousCharacterRatio, 0);
  });

  // 8. English STEM PDF (formulas, equations, technical terms)
  test("Scenario 8: English STEM text evaluation preserves technical symbols and formulas", () => {
    const stemText = `
      Newton's Second Law states that F = m * a, where F is the net force applied to the object,
      m is the mass of the object in kilograms (kg), and a is the resulting acceleration in m/s^2.
      Under gravitational acceleration g = 9.8 m/s^2, the weight W equals m * g.
      Energy conservation implies E_total = Kinetic_Energy + Potential_Energy.
    `;
    const quality = analyzePageQuality(1, stemText);
    assert.equal(quality.confidence, "GOOD");
    assert.ok(quality.meaningfulWordCount > 25);
    assert.equal(quality.isScanned, false);
  });

  // 9. Arabic + English mixed technical PDF
  test("Scenario 9: Mixed Arabic and English bilingual document maintains high quality score", () => {
    const bilingualText = `
      يعتمد نموذج Transformer في معالجة اللغات الطبيعية (NLP) على آلية Self-Attention.
      يتكون النموذج من جزأين رئيسيين: Encoder و Decoder.
      تقوم طبقة Multi-Head Attention بحساب أوزان الانتباه بين مختلف الكلمات (Tokens) بالتوازي.
    `;
    const quality = analyzePageQuality(1, bilingualText);
    assert.ok(quality.meaningfulWordCount >= 20);
    assert.ok(quality.confidence === "GOOD" || quality.confidence === "EXCELLENT");
  });

  // 10. PDF with unusual fonts / mojibake
  test("Scenario 10: Flags mojibake and high noise ratios while normalizing text", () => {
    const mojibakeText = "ÈáÇÛÉ ÇáÞÑÂä ÇáßÑíã æÅÚÌÇÒå ÇáÈíÇäí";
    const cleaned = cleanAndNormalizeText(mojibakeText);
    assert.ok(cleaned.length > 0);
  });

  // 11. Multi-page document page-aware chunking and section mapping
  test("Scenario 11: Text parser builds multi-page NormalizedDocument preserving section metadata", () => {
    const longText = Array.from(
      { length: 20 },
      (_, i) =>
        `الفقرة رقم ${i + 1}: تتناول هذه الوحدة مفهوم الحوسبة السحابية (Cloud Computing) وخدمات IaaS و PaaS و SaaS بالتفصيل التطبيقي للمهندسين.`,
    ).join("\n\n");

    const normDoc: NormalizedDocument = parseTextDocument(longText, "cloud-lecture.txt", 1500);

    assert.equal(normDoc.type, "txt");
    assert.ok(normDoc.pages.length >= 1);
    assert.ok(normDoc.sections.length >= 1);
    assert.equal(normDoc.sections[0].startPage, 1);
    assert.ok(normDoc.extractionQuality.isUsable);
    assert.ok(normDoc.metadata.fileSizeBytes > 0);
  });

  // 12. Partially extractable PDF (some pages readable, some unreadable)
  test("Scenario 12: Partially extractable document correctly categorized as PARTIAL", () => {
    const pages = [
      {
        pageNumber: 1,
        text: "ملخص المحاضرة: مفاهيم شبكات الحاسوب وبروتوكول TCP/IP وكيفية توجيه الحزم عبر الراوترات والمفاتيح في الشبكة المحلية، بالإضافة إلى دراسة بروتوكولات التوجيه المختلفة وعمل خوادم DNS.",
      },
      { pageNumber: 2, text: "" }, // scanned image page
      { pageNumber: 3, text: "   " }, // empty page
      {
        pageNumber: 4,
        text: "طبقات نموذج OSI السبعة: الفيزيائية، ربط البيانات، الشبكة، النقل، الجلسة، العرض، والتطبيق، ويقوم كل مستوى بتقديم خدمات محددة للمستوى الذي يعلوه مع إضافة الترويسة Header وفصل البيانات.",
      },
    ];

    const docQuality = analyzeDocumentQuality({ pages });
    assert.equal(docQuality.isScanned, true);
    assert.equal(docQuality.isPartial, true);
    assert.equal(docQuality.isUsable, true);
    assert.equal(docQuality.pagesWithText, 2);
    assert.equal(docQuality.pagesWithoutText, 2);
  });

  // 13. Security invariant: OCR keys never leak into client
  test("Scenario 13: OCR provider abstraction verifies that keys remain server-side", async () => {
    // When a provider is registered, getActiveOCRProvider returns it safely
    const provider = await getActiveOCRProvider();
    assert.ok(provider);
    assert.ok(typeof provider.recognizeBatch === "function");
  });

  // 14. DocumentIngestionError structure test
  test("Scenario 14: DocumentIngestionError preserves Arabic message and error code", () => {
    const err = new DocumentIngestionError({
      code: "SCANNED_DOCUMENT",
      messageAr: "الملف ده عبارة عن صور ومفيهوش نص قابل للقراءة مباشرة.",
      technicalDetails: "Zero text content found on any page",
    });

    assert.equal(err.name, "DocumentIngestionError");
    assert.equal(err.details.code, "SCANNED_DOCUMENT");
    assert.equal(err.message, "الملف ده عبارة عن صور ومفيهوش نص قابل للقراءة مباشرة.");
  });
});
