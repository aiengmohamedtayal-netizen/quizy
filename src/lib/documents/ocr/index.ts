/**
 * OCR Router and orchestrator.
 * Dynamically resolves the best available OCR provider with failover support.
 */

import type {
  OCRBatchRequest,
  OCRBatchResult,
  OCRPageRequest,
  OCRPageResult,
  OCRProvider,
} from "./types.ts";
import { VisionLlmOCRProvider } from "./vision-llm-provider.ts";

export type * from "./types.ts";
export * from "./vision-llm-provider.ts";

const providers: OCRProvider[] = [new VisionLlmOCRProvider()];

export function registerOCRProvider(provider: OCRProvider): void {
  providers.unshift(provider);
}

export async function getActiveOCRProvider(): Promise<OCRProvider> {
  for (const provider of providers) {
    if (await provider.isAvailable()) {
      return provider;
    }
  }
  throw new Error("لا يوجد مزود OCR متاح حالياً. يرجى التحقق من إعدادات مزود الذكاء الاصطناعي.");
}

export async function processPagesWithOcr(
  pages: OCRPageRequest[],
  documentName?: string,
): Promise<OCRBatchResult> {
  if (pages.length === 0) {
    return {
      pages: [],
      totalDurationMs: 0,
      providerName: "none",
    };
  }

  const provider = await getActiveOCRProvider();
  return await provider.recognizeBatch({ pages, documentName });
}
