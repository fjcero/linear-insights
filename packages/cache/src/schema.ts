/**
 * Schema optimized for insights report: one table for all cached blobs.
 * (scope, kind, key) uniquely identifies an entry; expires_at for TTL.
 */
export const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS report_cache (
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, kind, key)
);
`;

export const CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_report_cache_expires
ON report_cache (expires_at);
`;

export type CacheKind = "teams" | "projects" | "issues" | "history";
