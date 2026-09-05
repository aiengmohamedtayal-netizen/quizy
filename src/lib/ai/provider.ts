/**
 * Provider-agnostic OpenAI-compatible AI Client.
 * Works with SovereignEG, OpenAI, Qwen, OpenRouter, Google Gemini (OpenAI compat), etc.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  fallbackModel?: string;
  temperature?: number;
  timeoutMs?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  toolChoice?: unknown;
  jsonMode?: boolean;
  /** Override credentials for secondary provider (used for heavy tasks). */
  _overrideApiKey?: string;
  _overrideBaseUrl?: string;
}

export function getAiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي غير مهيأ. يرجى إضافة AI_API_KEY في ملف .env بالخادم.");
  }

  const rawBaseUrl =
    process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://backend.sovereigneg.com/v1";

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  return { apiKey, baseUrl, model };
}

/**
 * Config for heavy/reasoning tasks.
 * Uses AI_FALLBACK_API_KEY + AI_FALLBACK_BASE_URL when set,
 * otherwise falls back to primary config.
 */
export function getHeavyAiConfig() {
  const fallbackKey = process.env.AI_FALLBACK_API_KEY;
  if (fallbackKey) {
    const rawBaseUrl = process.env.AI_FALLBACK_BASE_URL || "https://backend.sovereigneg.com/v1";
    return {
      apiKey: fallbackKey,
      baseUrl: rawBaseUrl.replace(/\/+$/, ""),
    };
  }
  // Fall through to primary config if no secondary key is configured
  const primary = getAiConfig();
  return { apiKey: primary.apiKey, baseUrl: primary.baseUrl };
}

async function sendChatRequest(
  endpoint: string,
  apiKey: string,
  model: string,
  options: ChatCompletionOptions,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    }
  } else if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const timeoutMs = options.timeoutMs ?? 25000;

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function callAiChatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { apiKey: defaultApiKey, baseUrl: defaultBaseUrl, model: defaultModel } = getAiConfig();

  // Use override credentials for secondary provider (heavy tasks)
  const apiKey = options._overrideApiKey || defaultApiKey;
  const baseUrl = (options._overrideBaseUrl || defaultBaseUrl).replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  const primaryModel = options.model || defaultModel;

  let res: Response;
  let usedFallback = false;

  try {
    res = await sendChatRequest(endpoint, apiKey, primaryModel, options);
    if (!res.ok && options.fallbackModel && options.fallbackModel !== primaryModel) {
      console.warn(
        `[AI Router] Primary model ${primaryModel} returned status ${res.status}. Falling back to ${options.fallbackModel}...`,
      );
      res = await sendChatRequest(endpoint, apiKey, options.fallbackModel, options);
      usedFallback = true;
    }
  } catch (netErr) {
    if (options.fallbackModel && options.fallbackModel !== primaryModel) {
      console.warn(
        `[AI Router] Primary model ${primaryModel} failed with network/timeout error. Trying fallback ${options.fallbackModel}...`,
      );
      res = await sendChatRequest(endpoint, apiKey, options.fallbackModel, options);
      usedFallback = true;
    } else {
      throw netErr;
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error(`[AI Provider Error] Status: ${res.status}`, errorText.slice(0, 300));

    if (res.status === 401 || res.status === 403) {
      throw new Error("خطأ في التحقق من صحة مفتاح الذكاء الاصطناعي (Unauthorized/Forbidden)");
    }
    if (res.status === 429) {
      throw new Error(
        "تم تجاوز حد الطلبات المسموح به لمزود الذكاء الاصطناعي. يرجى المحاولة لاحقاً.",
      );
    }
    if (res.status === 402) {
      throw new Error("رصيد مفتاح الذكاء الاصطناعي غير كافٍ. يرجى شحن الرصيد.");
    }

    throw new Error("تعذر إتمام الاتصال بنموذج الذكاء الاصطناعي. يرجى التحقق من إعدادات الاتصال.");
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          function?: {
            name: string;
            arguments: string;
          };
        }>;
      };
    }>;
  };

  const choice = json.choices?.[0]?.message;
  if (!choice) {
    throw new Error("استجابة غير متوقعة من نموذج الذكاء الاصطناعي.");
  }

  // 1. Check for tool_calls arguments first
  const toolCall = choice.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return toolCall.function.arguments;
  }

  // 2. Otherwise return message content
  if (typeof choice.content === "string") {
    return choice.content;
  }

  throw new Error("لم يتم استلام محتوى صالح من الذكاء الاصطناعي.");
}

/**
 * Safely parse JSON from LLM response whether wrapped in markdown or raw
 */
export function extractJsonFromResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  // If response is enclosed in ```json ... ``` code blocks, extract inner content
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt to locate first { and last }
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx > startIdx) {
      const candidate = cleaned.slice(startIdx, endIdx + 1);
      return JSON.parse(candidate) as T;
    }
    throw new Error("فشل فك ترميز استجابة الـ JSON الواردة من الذكاء الاصطناعي");
  }
}
