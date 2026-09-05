/**
 * Server-side Vision LLM OCR Provider.
 * Uses the configured OpenAI-compatible multimodal endpoint (SovereignEG, OpenAI, Qwen-VL, etc.)
 * to accurately transcribe Arabic calligraphy, English technical notes, mathematical equations,
 * and scanned educational pages.
 */

import { getAiConfig } from "../../ai/provider.ts";
import type {
  OCRBatchRequest,
  OCRBatchResult,
  OCRPageRequest,
  OCRPageResult,
  OCRProvider,
} from "./types.ts";

export class VisionLlmOCRProvider implements OCRProvider {
  public name = "vision_llm_ocr";

  async isAvailable(): Promise<boolean> {
    try {
      const { apiKey } = getAiConfig();
      return Boolean(apiKey && apiKey.trim().length > 0);
    } catch {
      return false;
    }
  }

  async recognizePage(req: OCRPageRequest): Promise<OCRPageResult> {
    const startTime = Date.now();
    const { apiKey, baseUrl, model: defaultModel } = getAiConfig();

    // Use vision-capable model (defaulting to gpt-4o-mini or configured AI_MODEL)
    const visionModel = process.env.AI_VISION_MODEL || defaultModel || "gpt-4o-mini";
    const endpoint = `${baseUrl}/chat/completions`;

    const imageUrl = req.imageBufferBase64.startsWith("data:")
      ? req.imageBufferBase64
      : `data:${req.mimeType || "image/jpeg"};base64,${req.imageBufferBase64}`;

    const body = {
      model: visionModel,
      messages: [
        {
          role: "system",
          content:
            "You are an expert educational document OCR engine. Transcribe every piece of text from the provided page image with exact fidelity, preserving original Arabic and English scripts, equations, lists, and headings. Return ONLY the transcribed text without conversational filler or markdown code blocks.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract and transcribe all educational text from this page image:",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `فشل استخراج النصوص عبر OCR البصري (Status ${res.status}): ${errText.slice(0, 150)}`,
      );
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const extractedText = (json.choices?.[0]?.message?.content || "").trim();
    const durationMs = Date.now() - startTime;
    const meaningfulWords =
      extractedText.match(/[\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9_\u0370-\u03FF]{2,}/g) || [];

    return {
      pageNumber: req.pageNumber,
      text: extractedText,
      confidence: meaningfulWords.length > 20 ? 0.95 : meaningfulWords.length > 5 ? 0.8 : 0.5,
      providerName: this.name,
      durationMs,
      meaningfulWordCount: meaningfulWords.length,
    };
  }

  async recognizeBatch(req: OCRBatchRequest): Promise<OCRBatchResult> {
    const startTime = Date.now();
    const results: OCRPageResult[] = [];

    // Process up to 3 pages in parallel to balance speed and provider rate limits
    const concurrencyLimit = 3;
    const pages = [...req.pages];

    for (let i = 0; i < pages.length; i += concurrencyLimit) {
      const slice = pages.slice(i, i + concurrencyLimit);
      const batchPromises = slice.map((pageReq) => this.recognizePage(pageReq));
      const settled = await Promise.allSettled(batchPromises);

      for (let j = 0; j < settled.length; j++) {
        const item = settled[j];
        if (item.status === "fulfilled") {
          results.push(item.value);
        } else {
          // If a page fails, record a fallback empty page with poor confidence
          const failedPageNum = slice[j].pageNumber;
          console.warn(`[OCR Error] Failed page ${failedPageNum}:`, item.reason);
          results.push({
            pageNumber: failedPageNum,
            text: "",
            confidence: 0,
            providerName: this.name,
            durationMs: 0,
            meaningfulWordCount: 0,
          });
        }
      }
    }

    results.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      pages: results,
      totalDurationMs: Date.now() - startTime,
      providerName: this.name,
    };
  }
}
