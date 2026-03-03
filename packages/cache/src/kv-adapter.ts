/**
 * CacheAdapter backed by Vercel KV (Redis).
 * Used when process.env.VERCEL is set (deployed on Vercel).
 *
 * Requires KV_REST_API_URL and KV_REST_API_TOKEN env vars (set by Vercel when KV is linked).
 */
import type { CacheAdapter, CacheEntry } from "./adapter.js";
import type { CacheKind } from "./schema.js";

const KEY_PREFIX = "li:";

function kvKey(scope: string, kind: CacheKind, key: string): string {
  return `${KEY_PREFIX}${scope}:${kind}:${key}`;
}

function kvKeyPrefix(scope: string): string {
  return `${KEY_PREFIX}${scope}:*`;
}

/** Stored value: JSON with { data, expiresAt } so we can check expiry on read. */
interface StoredValue {
  data: string;
  expiresAt: number;
}

/** Minimal KV client interface (satisfied by @vercel/kv default export). */
interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  scanIterator(options?: { match?: string }): AsyncIterable<string>;
}

export class VercelKVAdapter implements CacheAdapter {
  constructor(private readonly kv: KVClient) {}

  async get(scope: string, kind: CacheKind, key: string): Promise<CacheEntry | null> {
    const stored = (await this.kv.get<StoredValue>(kvKey(scope, kind, key))) ?? null;
    if (!stored || stored.expiresAt <= Date.now()) return null;
    return { data: stored.data, expiresAt: stored.expiresAt };
  }

  async set(
    scope: string,
    kind: CacheKind,
    key: string,
    data: string,
    expiresAt: number
  ): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    await this.kv.set(kvKey(scope, kind, key), { data, expiresAt }, { ex: ttlSeconds });
  }

  async clear(scope: string): Promise<void> {
    const keys: string[] = [];
    for await (const key of this.kv.scanIterator({ match: kvKeyPrefix(scope) })) {
      keys.push(key);
    }
    if (keys.length > 0) await this.kv.del(...keys);
  }

  // vacuum: no-op — KV entries expire via TTL automatically
}
