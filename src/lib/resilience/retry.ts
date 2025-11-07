export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  retries: 2,
  minDelayMs: 25,
  maxDelayMs: 150,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries the supplied async function with exponential backoff + jitter.
 * Keeps retry counts small to avoid hammering the database while still
 * providing resilience for transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries, minDelayMs, maxDelayMs } = { ...DEFAULT_RETRY, ...options };

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const backoff = Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
      const jitter = Math.random() * backoff * 0.4;
      await sleep(backoff + jitter);
    }
  }
}
