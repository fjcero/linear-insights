import type { CacheKind } from "./schema.js";

export interface CacheEntry {
  data: string;
  expiresAt: number;
}

/**
 * Storage adapter interface for the report cache.
 * Implement this to swap SQLite for Redis, Vercel KV, or a JSON file store.
 * All methods are async to accommodate remote KV stores.
 */
export interface CacheAdapter {
  /**
   * Retrieve a cached entry. Returns null if missing or expired.
   * Implementations must compare expiresAt against Date.now().
   */
  get(scope: string, kind: CacheKind, key: string): Promise<CacheEntry | null>;

  /**
   * Upsert a cache entry with an absolute expiry timestamp (milliseconds).
   */
  set(scope: string, kind: CacheKind, key: string, data: string, expiresAt: number): Promise<void>;

  /**
   * Delete all entries for a given scope (e.g. on logout or key rotation).
   */
  clear(scope: string): Promise<void>;

  /**
   * Optional: delete expired rows (maintenance / eviction). No-op by default.
   */
  vacuum?(): Promise<void>;
}
