type Primitive = string | number;

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries?: number;
}

/**
 * A tiny in-memory cache with TTL and optional max size.
 * Intended for per-instance caching inside the service layer to
 * cut repeated DB lookups and provide a fallback when the database
 * is briefly unavailable.
 */
export class TtlCache<K extends Primitive, V> {
  private readonly store = new Map<K, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 100;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Evict the oldest entry (FIFO) to keep memory bounded.
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey as K);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
