import type { ICacheRepository } from "@e-clat/shared";

/**
 * In-memory cache for development and testing.
 *
 * Production will use a Redis-backed ICacheRepository once the Redis
 * adapter is implemented (Decision #9 — Polyglot Storage).
 */

interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

export class InMemoryCacheRepository implements ICacheRepository {
  private store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    const matches: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matches.push(key);
      }
    }
    return matches;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}
