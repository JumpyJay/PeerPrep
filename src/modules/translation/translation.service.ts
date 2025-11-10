import crypto from "node:crypto";
import { TtlCache } from "../../lib/cache/ttl-cache";
import { instrument } from "../../lib/monitoring/instrumentation";
import { withRetry } from "../../lib/resilience/retry";
import { createTranslationClient } from "./translation.client";
import { CodeTranslationRequest, CodeTranslationResult } from "./translation.types";

interface CacheValue {
  translatedCode: string;
  provider: string;
}

const cacheTtlMs = Number(process.env.TRANSLATION_CACHE_TTL_MS ?? 300_000);
const cacheSize = Number(process.env.TRANSLATION_CACHE_SIZE ?? 256);

export class CodeTranslationService {
  private readonly cache = new TtlCache<string, CacheValue>({ ttlMs: cacheTtlMs, maxEntries: cacheSize });

  async translate(request: CodeTranslationRequest): Promise<CodeTranslationResult> {
    this.assertValidRequest(request);
    const cacheKey = this.computeCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        translatedCode: cached.translatedCode,
        provider: cached.provider,
        cached: true,
      };
    }

    const client = createTranslationClient();
    let result;
    try {
      result = await instrument("translation.translate", () =>
        withRetry(() => client.translate(request), { retries: 1, minDelayMs: 100, maxDelayMs: 400 })
      );
    } catch (error) {
      if (error instanceof Error && !("status" in error)) {
        throw Object.assign(error, { status: 502 });
      }
      throw error;
    }

    this.cache.set(cacheKey, {
      translatedCode: result.translatedCode,
      provider: result.provider,
    });

    return {
      ...result,
      cached: false,
    };
  }

  private computeCacheKey(request: CodeTranslationRequest): string {
    const hash = crypto.createHash("sha256");
    hash.update(request.sourceCode);
    hash.update("|");
    hash.update(request.fromLang.toLowerCase());
    hash.update("|");
    hash.update(request.toLang.toLowerCase());
    hash.update("|");
    hash.update((request.style ?? "idiomatic").toLowerCase());
    return hash.digest("hex");
  }

  private assertValidRequest(request: CodeTranslationRequest): void {
    if (!request.sourceCode || request.sourceCode.trim().length === 0) {
      throw Object.assign(new Error("sourceCode is required"), { status: 400 });
    }
    if (!request.fromLang || !request.toLang) {
      throw Object.assign(new Error("fromLang and toLang are required"), { status: 400 });
    }
    if (request.fromLang.toLowerCase() === request.toLang.toLowerCase()) {
      throw Object.assign(new Error("fromLang and toLang must be different"), { status: 400 });
    }
  }
}

export const codeTranslationService = new CodeTranslationService();
