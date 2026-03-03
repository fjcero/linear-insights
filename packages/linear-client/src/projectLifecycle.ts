import type { ProjectSummary } from "./types.js";
import type {
  ProjectLifecycleAnalysis,
  ProjectLifecycleRow,
  ProjectCountBucket,
} from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** YYYY-MM for grouping by month. */
function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Compute lifecycle metrics for a set of projects:
 * - When each was created, last updated, closed
 * - Lifetime in days (for closed projects; optional for active = now - created)
 * - Average lifetime (closed only)
 * - Accumulated projects over time (by month)
 */
export function computeProjectLifecycle(projects: ProjectSummary[]): ProjectLifecycleAnalysis {
  const rows: ProjectLifecycleRow[] = [];
  const closedLifetimes: number[] = [];

  for (const p of projects) {
    const createdAt = parseDate(p.createdAt);
    const completedAt = parseDate(p.completedAt);
    const canceledAt = parseDate(p.canceledAt);
    const closedAt = completedAt ?? canceledAt ?? null;

    let lifetimeDays: number | null = null;
    if (closedAt && createdAt) {
      const days = daysBetween(createdAt, closedAt);
      lifetimeDays = days;
      closedLifetimes.push(days);
    }

    rows.push({
      projectId: p.id,
      projectName: p.name,
      state: p.state ?? "",
      createdAt: p.createdAt ?? null,
      updatedAt: p.updatedAt ?? null,
      closedAt: closedAt ? closedAt.toISOString() : null,
      lifetimeDays,
    });
  }

  const averageLifetimeDays =
    closedLifetimes.length > 0
      ? Math.round(
          closedLifetimes.reduce((a, b) => a + b, 0) / closedLifetimes.length
        )
      : null;

  // Build monthly buckets: all months that appear in created or closed
  const months = new Set<string>();
  for (const p of projects) {
    const created = parseDate(p.createdAt);
    if (created) months.add(monthKey(created));
    const closed = parseDate(p.completedAt ?? p.canceledAt);
    if (closed) months.add(monthKey(closed));
  }
  const sortedMonths = Array.from(months).sort();

  const buckets: ProjectCountBucket[] = [];
  let cumulativeCreated = 0;
  let cumulativeClosed = 0;

  for (const period of sortedMonths) {
    const created = projects.filter((p) => {
      const d = parseDate(p.createdAt);
      return d && monthKey(d) === period;
    }).length;

    const closed = projects.filter((p) => {
      const d = parseDate(p.completedAt ?? p.canceledAt);
      return d && monthKey(d) === period;
    }).length;

    cumulativeCreated += created;
    cumulativeClosed += closed;

    buckets.push({
      period,
      created,
      closed,
      cumulativeCreated,
      cumulativeClosed,
    });
  }

  return {
    rows,
    averageLifetimeDays,
    buckets,
  };
}
