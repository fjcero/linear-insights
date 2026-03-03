import { Database } from "bun:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";
import { CREATE_TABLE, CREATE_INDEX, type CacheKind } from "./schema.js";

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

/** Uses Bun's built-in SQLite (no native addon). Requires Bun runtime. */
function createBunDb(path: string): {
  getRow: (sql: string, ...params: (string | number)[]) => { data: string } | undefined;
  run: (sql: string, ...params: (string | number)[]) => void;
  close: () => void;
} {
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

let db: ReturnType<typeof createBunDb> | null = null;

/**
 * Open (or get) the report cache DB. Idempotent.
 * Uses Bun's built-in SQLite; requires Bun to run.
 */
export async function openReportCache(options: ReportCacheOptions = {}): Promise<ReportCache> {
  const refresh = options.forceRefresh ?? false;
  if (db) return new ReportCache(db, isCacheDisabled(), refresh);
  const path = options.dbPath ?? defaultDbPath();
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  db = createBunDb(path);
  return new ReportCache(db, isCacheDisabled(), refresh);
}

/**
 * Close the cache DB (e.g. on exit). No-op if not open.
 */
export function closeReportCache(): void {
  if (db) {
    db.close();
    db = null;
  }
}

const SEL_SQL =
  "SELECT data FROM report_cache WHERE scope = ? AND kind = ? AND key = ? AND expires_at > ?";
const INS_SQL = `INSERT INTO report_cache (scope, kind, key, data, expires_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?)
 ON CONFLICT (scope, kind, key) DO UPDATE SET data = ?, expires_at = ?, updated_at = ?`;
const DEL_SQL = "DELETE FROM report_cache WHERE expires_at <= ?";

/**
 * Report cache: get/set teams, projects, issues by scope (e.g. API key hash).
 * All methods are async for consistency; storage is synchronous SQLite.
 */
export class ReportCache {
  constructor(
    private readonly database: ReturnType<typeof createBunDb>,
    private readonly disabled: boolean,
    private readonly forceRefresh: boolean = false,
  ) {}

  private get(scope: string, kind: CacheKind, key: string): string | null {
    if (this.disabled || this.forceRefresh) return null;
    const now = Date.now();
    const row = this.database.getRow(SEL_SQL, scope, kind, key, now);
    return row?.data ?? null;
  }

  private set(scope: string, kind: CacheKind, key: string, data: string, ttlSeconds: number): void {
    if (this.disabled) return;
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    this.database.run(INS_SQL, scope, kind, key, data, expiresAt, now, data, expiresAt, now);
  }

  async getTeams<T>(scope: string): Promise<T | null> {
    const raw = this.get(scope, "teams", "");
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setTeams(scope: string, data: unknown, ttlSeconds: number): Promise<void> {
    this.set(scope, "teams", "", JSON.stringify(data), ttlSeconds);
  }

  /** key = sorted team IDs joined, or "all" for no filter. */
  async getProjects<T>(scope: string, key: string): Promise<T | null> {
    const raw = this.get(scope, "projects", key);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setProjects(scope: string, key: string, data: unknown, ttlSeconds: number): Promise<void> {
    this.set(scope, "projects", key, JSON.stringify(data), ttlSeconds);
  }

  async getIssues<T>(scope: string, projectId: string): Promise<T | null> {
    const raw = this.get(scope, "issues", projectId);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setIssues(
    scope: string,
    projectId: string,
    data: unknown,
    ttlSeconds: number
  ): Promise<void> {
    this.set(scope, "issues", projectId, JSON.stringify(data), ttlSeconds);
  }

  /** key = projectId. */
  async getHistory<T>(scope: string, projectId: string): Promise<T | null> {
    const raw = this.get(scope, "history", projectId);
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  async setHistory(
    scope: string,
    projectId: string,
    data: unknown,
    ttlSeconds: number
  ): Promise<void> {
    this.set(scope, "history", projectId, JSON.stringify(data), ttlSeconds);
  }

  /** Remove expired rows (optional maintenance). */
  vacuum(): void {
    if (this.disabled) return;
    this.database.run(DEL_SQL, Date.now());
  }
}

/** Build a stable cache key for "projects" (e.g. from team IDs). */
export function projectsCacheKey(teamIds: string[] | undefined): string {
  if (!teamIds?.length) return "all";
  return [...teamIds].sort().join(",");
}
