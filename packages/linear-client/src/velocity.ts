import type { ProjectSummary } from "./types.js";
import type { VelocitySummary, VelocityTrend, VelocityWeeklySummary } from "./types.js";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar month key "YYYY-MM". */
function getMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** ISO week key "YYYY-Www" (e.g. 2025-W01). Week 1 = week containing Jan 4. */
export function getWeekKey(d: Date): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - date.getDay() + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week1 = new Date(jan4);
  week1.setDate(jan4.getDate() - jan4.getDay() + 1);
  const weekNum = Math.ceil((thursday.getTime() - week1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const y = thursday.getFullYear();
  const w = String(weekNum).padStart(2, "0");
  return `${y}-W${w}`;
}

/** Format "2026-01" as "Jan 2026". */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return monthKey;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Format "2025-W42" as "W42 2025". */
export function formatWeekLabel(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  return `W${match[2]} ${match[1]}`;
}

/**
 * Velocity = projects created and closed by month (not issues).
 * Trend = projects closed in last 2 months vs previous 2 months.
 */
export function computeVelocity(projects: ProjectSummary[]): VelocitySummary {
  const months = new Set<string>();
  for (const p of projects) {
    const created = p.createdAt ? new Date(p.createdAt) : null;
    if (created) months.add(getMonthKey(created));
    const closed = p.completedAt ?? p.canceledAt;
    const closedDate = closed ? new Date(closed) : null;
    if (closedDate) months.add(getMonthKey(closedDate));
  }
  const sortedMonths = Array.from(months).sort();

  const buckets = sortedMonths.map((month) => {
    const created = projects.filter((p) => {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      return d && getMonthKey(d) === month;
    }).length;
    const closed = projects.filter((p) => {
      const d = p.completedAt ?? p.canceledAt;
      const date = d ? new Date(d) : null;
      return date && getMonthKey(date) === month;
    }).length;
    return { month, created, closed };
  });

  // Trend: last 2 completed months closed vs previous 2 completed months closed.
  // Exclude current month because it is partial and can make trend look artificially slower.
  const currentMonth = getMonthKey(new Date());
  const trendBuckets =
    buckets.length > 0 && buckets[buckets.length - 1]?.month === currentMonth
      ? buckets.slice(0, -1)
      : buckets;
  const closedByMonth = trendBuckets.map((b) => b.closed);
  const recent = closedByMonth.slice(-2).reduce((s, c) => s + c, 0);
  const previous = closedByMonth.slice(-4, -2).reduce((s, c) => s + c, 0);
  let trend: VelocityTrend = "unknown";
  if (previous > 0 || recent > 0) {
    if (recent > previous) trend = "accelerating";
    else if (recent < previous) trend = "slowing";
    else trend = "steady";
  }

  return {
    buckets,
    trend,
    trendRecentTotal: recent,
    trendPreviousTotal: previous,
  };
}

/**
 * Velocity by week (WoW). Same idea as computeVelocity but with ISO week keys.
 */
export function computeVelocityWeekly(projects: ProjectSummary[]): VelocityWeeklySummary {
  const weeks = new Set<string>();
  for (const p of projects) {
    const created = p.createdAt ? new Date(p.createdAt) : null;
    if (created) weeks.add(getWeekKey(created));
    const closed = p.completedAt ?? p.canceledAt;
    const closedDate = closed ? new Date(closed) : null;
    if (closedDate) weeks.add(getWeekKey(closedDate));
  }
  const sortedWeeks = Array.from(weeks).sort();

  const buckets = sortedWeeks.map((week) => {
    const created = projects.filter((p) => {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      return d && getWeekKey(d) === week;
    }).length;
    const closed = projects.filter((p) => {
      const d = p.completedAt ?? p.canceledAt;
      const date = d ? new Date(d) : null;
      return date && getWeekKey(date) === week;
    }).length;
    return { week, created, closed };
  });

  return { buckets };
}
