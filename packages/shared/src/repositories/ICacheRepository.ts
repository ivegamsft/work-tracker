/**
 * Cache repository — key/value store with TTL support.
 *
 * Backed by Redis (primary) or an in-memory Map (dev/test).
 * Used for hot-path caching (templates, employee lookups, etc.).
 *
 * @see docs/specs/data-layer-api.md — Section 3.2 (Cache Repository)
 */

export interface ICacheRepository {
  /** Retrieve a cached value by key, returning null on miss */
  get<T>(key: string): Promise<T | null>;

  /** Store a value with an optional TTL (seconds) */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Delete a single key */
  del(key: string): Promise<void>;

  /** Delete all keys matching a glob pattern (e.g. "templates:*") */
  delByPattern(pattern: string): Promise<number>;

  /** List keys matching a glob pattern */
  keys(pattern: string): Promise<string[]>;

  /** Check if a key exists */
  has(key: string): Promise<boolean>;

  /** Flush all keys (use with care — primarily for testing) */
  flush(): Promise<void>;
}
