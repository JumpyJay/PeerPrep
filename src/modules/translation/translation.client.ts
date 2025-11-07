import { CodeTranslationRequest } from "./translation.types";

export interface TranslationClientResult {
  translatedCode: string;
  provider: string;
}

export interface TranslationClient {
  translate(request: CodeTranslationRequest): Promise<TranslationClientResult>;
}

class OpenAITranslationClient implements TranslationClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiBase: string;

  constructor(apiKey: string, model: string, apiBase?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.apiBase = apiBase ?? "https://api.openai.com/v1";
  }

  async translate(request: CodeTranslationRequest): Promise<TranslationClientResult> {
    const endpoint = `${this.apiBase}/chat/completions`;
    const systemPrompt =
      "You are a code translation assistant. Convert code between languages while preserving logic and idioms. " +
      "Return only the translated code. Do not include explanations.";
    const userPrompt = [
      `Please translate the following ${request.fromLang} code into ${request.toLang}.`,
      request.style === "literal"
        ? "Prefer a literal translation that mirrors the original structure."
        : "Prefer idiomatic patterns appropriate for the target language.",
      "",
      "```",
      request.sourceCode,
      "```",
    ].join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "text" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Translation provider error: ${response.status} ${errorBody}`);
    }

    const payload = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Translation provider returned empty response");
    }

    return {
      translatedCode: content,
      provider: "openai",
    };
  }
}

export function createTranslationClient(): TranslationClient {
  const provider = process.env.TRANSLATION_PROVIDER ?? "openai";
  if (provider !== "openai") {
    throw Object.assign(new Error(`Unsupported translation provider: ${provider}`), { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY not configured for translation"), { status: 500 });
  }

  const model = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini";
  const apiBase = process.env.OPENAI_API_BASE;
  return new OpenAITranslationClient(apiKey, model, apiBase);
}
