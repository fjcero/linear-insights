import { join } from "node:path";
import { homedir } from "node:os";
import { CREATE_TABLE, CREATE_INDEX, type CacheKind } from "./schema.js";
import type { CacheAdapter, CacheEntry } from "./adapter.js";

export type { CacheAdapter, CacheEntry } from "./adapter.js";

const CACHE_DISABLED_ENV = "LINEAR_INSIGHTS_CACHE";

function isCacheDisabled(): boolean {
  const v = process.env[CACHE_DISABLED_ENV];
  if (v === undefined || v === "") return false;
  return v === "0" || v.toLowerCase() === "false" || v.toLowerCase() === "no";
}

export interface ReportCacheOptions {
  /** Database path. Default: LINEAR_INSIGHTS_CACHE_DB or ~/.cache/linear-insights/report.db */
  dbPath?: string;
  /** Skip cache reads (always fetch fresh) but still write results back. */
  forceRefresh?: boolean;
}

function defaultDbPath(): string {
  const env = process.env.LINEAR_INSIGHTS_CACHE_DB;
  if (env?.trim()) return env.trim();
  return join(homedir(), ".cache", "linear-insights", "report.db");
}

// ---------------------------------------------------------------------------
// SQLite low-level helpers
// ---------------------------------------------------------------------------

type BunDb = {
  getRow: (sql: string, ...params: (string | number)[]) => { data: string } | undefined;
  run: (sql: string, ...params: (string | number)[]) => void;
  close: () => void;
};

async function createBunDb(path: string): Promise<BunDb> {
  const { Database } = await import("bun:sqlite");
  const database = new Database(path, { create: true });
  database.run("PRAGMA journal_mode = WAL;");
  database.run(CREATE_TABLE);
  database.run(CREATE_INDEX);
  return {
    getRow(sql: string, ...params: (string | number)[]) {
      return database.query(sql).get(...params) as { data: string } | undefined;
    },
    run(sql: string, ...params: (string | number)[]) {
      database.query(sql).run(...params);
    },
    close() {
      database.close();
    },
  };
}

// ---------------------------------------------------------------------------
// SQLiteCacheAdapter — the default CacheAdapter backed by Bun's built-in SQLite
// ---------------------------------------------------------------------------

const SEL_SQL =
  "SELECT data FROM report_cache WHERE scope = ? AND kind = ? AND key = ? AND expires_at > ?";
const INS_SQL = `INSERT INTO report_cache (scope, kind, key, data, expires_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?)
 ON CONFLICT (scope, kind, key) DO UPDATE SET data = ?, expires_at = ?, updated_at = ?`;
const DEL_SCOPE_SQL = "DELETE FROM report_cache WHERE scope = ?";
const DEL_EXPIRED_SQL = "DELETE FROM report_cache WHERE expires_at <= ?";

/**
 * CacheAdapter implementation backed by SQLite (Bun's built-in driver).
 * Requires the Bun runtime.
 */
export class SQLiteCacheAdapter implements CacheAdapter {
  constructor(private readonly db: BunDb) {}

  async get(scope: string, kind: CacheKind, key: string): Promise<CacheEntry | null> {
    const row = this.db.getRow(SEL_SQL, scope, kind, key, Date.now());
    if (!row) return null;
    return { data: row.data, expiresAt: 0 }; // expiresAt omitted — already validated by SQL
  }

  async set(scope: string, kind: CacheKind, key: string, data: string, expiresAt: number): Promise<void> {
    const now = Date.now();
    this.db.run(INS_SQL, scope, kind, key, data, expiresAt, now, data, expiresAt, now);
  }

  async clear(scope: string): Promise<void> {
    this.db.run(DEL_SCOPE_SQL, scope);
  }

  async vacuum(): Promise<void> {
    this.db.run(DEL_EXPIRED_SQL, Date.now());
  }

  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton adapter (shared across all ReportCache instances)
// ---------------------------------------------------------------------------

let adapter: CacheAdapter | null = null;

const CACHE_BACKEND_ENV = "LINEAR_INSIGHTS_CACHE_BACKEND";

function getKvUrl(): string | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function getKvToken(): string | null {
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function useVercelKV(): boolean {
  const override = process.env[CACHE_BACKEND_ENV];
  if (override === "sqlite") return false;
  if (override === "vercel-kv") return true;

  return process.env.VERCEL === "1" && getKvUrl() != null && getKvToken() != null;
}

/**
 * Open (or return) the cache adapter. Idempotent.
 * - On Vercel (VERCEL=1 + KV/Upstash env vars): uses Redis via @vercel/kv
 * - Otherwise: uses SQLite at ~/.cache/linear-insights/report.db
 */
export async function openReportCache(options: ReportCacheOptions = {}): Promise<ReportCache> {
  const refresh = options.forceRefresh ?? false;
  if (adapter) return new ReportCache(adapter, isCacheDisabled(), refresh);

  if (useVercelKV()) {
    const { createClient } = await import("@vercel/kv");
    const { VercelKVAdapter } = await import("./kv-adapter.js");
    const url = getKvUrl();
    const token = getKvToken();
    if (!url || !token) {
      throw new Error(
        "KV cache requires KV_REST_API_URL+KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL+UPSTASH_REDIS_REST_TOKEN. Add them in Vercel Project Settings → Environment Variables."
      );
    }
    const kv = createClient({ url, token });
    adapter = new VercelKVAdapter(kv);
  } else {
    const path = options.dbPath ?? defaultDbPath();
    const { mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(path), { recursive: true });
    adapter = new SQLiteCacheAdapter(await createBunDb(path));
  }

  return new ReportCache(adapter, isCacheDisabled(), refresh);
}

/**
 * Close the underlying connection (e.g. on exit). No-op if not open.
 * SQLite connections are closed; Vercel KV is stateless and has no-op.
 */
export function closeReportCache(): void {
  if (adapter && typeof (adapter as { close?: () => void }).close === "function") {
    (adapter as { close: () => void }).close();
  }
  adapter = null;
}

// ---------------------------------------------------------------------------
// ReportCache — typed, domain-aware wrapper over a CacheAdapter
// ---------------------------------------------------------------------------

/**
 * Report cache: typed get/set for teams, projects, issues, history.
 * Delegates storage to a CacheAdapter — swap for Redis/Vercel KV without
 * changing any call sites.
 */
export class ReportCache {
  constructor(
    private readonly adapter: CacheAdapter,
    private readonly disabled: boolean,
    private readonly forceRefresh: boolean = false,
  ) {}

  private async fetch(scope: string, kind: CacheKind, key: string): Promise<string | null> {
    if (this.disabled || this.forceRefresh) return null;
    const entry = await this.adapter.get(scope, kind, key);
    return entry?.data ?? null;
  }

  private async store(scope: string, kind: CacheKind, key: string, data: string, ttlSeconds: number): Promise<void> {
    if (this.disabled) return;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    await this.adapter.set(scope, kind, key, data, expiresAt);
  }

  async getTeams<T>(scope: string): Promise<T | null> {
    const raw = await this.fetch(scope, "teams", "");
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setTeams(scope: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.store(scope, "teams", "", JSON.stringify(data), ttlSeconds);
  }

  async getProjects<T>(scope: string, key: string): Promise<T | null> {
    const raw = await this.fetch(scope, "projects", key);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setProjects(scope: string, key: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.store(scope, "projects", key, JSON.stringify(data), ttlSeconds);
  }

  async getIssues<T>(scope: string, projectId: string): Promise<T | null> {
    const raw = await this.fetch(scope, "issues", projectId);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setIssues(scope: string, projectId: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.store(scope, "issues", projectId, JSON.stringify(data), ttlSeconds);
  }

  async getHistory<T>(scope: string, projectId: string): Promise<T | null> {
    const raw = await this.fetch(scope, "history", projectId);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setHistory(scope: string, projectId: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.store(scope, "history", projectId, JSON.stringify(data), ttlSeconds);
  }

  /** Clear all cached data for a scope (e.g. on token revocation). */
  async clearScope(scope: string): Promise<void> {
    await this.adapter.clear(scope);
  }

  /** Remove expired rows (optional maintenance). */
  async vacuum(): Promise<void> {
    if (this.disabled) return;
    await this.adapter.vacuum?.();
  }
}

/** Build a stable cache key for "projects" (e.g. from team IDs). */
export function projectsCacheKey(teamIds: string[] | undefined): string {
  if (!teamIds?.length) return "all";
  return [...teamIds].sort().join(",");
}
