import { logger } from "../utils";

export interface JwksKey {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
}

interface CacheEntry {
  keys: JwksKey[];
  cachedAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * TTL-based JWKS key cache. Fetches keys from provider JWKS URI
 * and caches them for the configured TTL.
 */
export class JwksCache {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  async getKeys(jwksUri: string): Promise<JwksKey[]> {
    const cached = this.cache.get(jwksUri);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.ttlMs) {
      return cached.keys;
    }

    const keys = await this.fetchKeys(jwksUri);
    this.cache.set(jwksUri, { keys, cachedAt: now });
    return keys;
  }

  getKeyById(keys: JwksKey[], kid: string): JwksKey | undefined {
    return keys.find((k) => k.kid === kid);
  }

  invalidate(jwksUri: string): void {
    this.cache.delete(jwksUri);
  }

  clear(): void {
    this.cache.clear();
  }

  private async fetchKeys(jwksUri: string): Promise<JwksKey[]> {
    try {
      const response = await fetch(jwksUri);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as { keys: JwksKey[] };
      if (!Array.isArray(data.keys)) {
        throw new Error("Invalid JWKS response: missing keys array");
      }
      logger.debug("JWKS keys fetched", { jwksUri, keyCount: data.keys.length });
      return data.keys;
    } catch (error) {
      logger.error("Failed to fetch JWKS keys", {
        jwksUri,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return stale cache if available on fetch error
      const stale = this.cache.get(jwksUri);
      if (stale) {
        logger.warn("Returning stale JWKS keys after fetch failure", { jwksUri });
        return stale.keys;
      }
      throw error;
    }
  }
}

export const jwksCache = new JwksCache();
