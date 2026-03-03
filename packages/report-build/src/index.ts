import type { TeamInfo } from "@linear-insights/linear-client";
import type {
  IssueSummary,
  ProjectSummary,
  ProjectDateTimeline,
} from "@linear-insights/linear-client";
import {
  computeProjectMetrics,
  computeProjectHealth,
  computeVelocity,
  computeVelocityWeekly,
  formatMonthLabel,
  formatWeekLabel,
  getWeekKey,
  computeProjectLifecycle,
  getStaleIssues,
  getObjectivesOverSixWeeks,
  isActiveForReporting,
  isTerminalProjectState,
  sortProjectsByState,
} from "@linear-insights/linear-client";
import type { InsightsReportData } from "@linear-insights/report-types";

function projectStateLabel(state: string | null | undefined): string {
  const lower = (state ?? "").toLowerCase();
  if (lower === "started") return "Now";
  if (lower === "planned") return "Next";
  if (lower === "backlog") return "Later";
  if (lower === "completed" || lower === "canceled") return "Completed";
  return state ?? "—";
}

function projectLifetimeDays(p: {
  createdAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
}): number | null {
  const created = p.createdAt ? new Date(p.createdAt) : null;
  if (!created) return null;
  const closed = p.completedAt ?? p.canceledAt;
  const end = closed ? new Date(closed) : new Date();
  return Math.round((end.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
}

function daysSince(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

function healthLabel(status: string): string {
  return status === "on_track"
    ? "On track"
    : status === "at_risk"
      ? "At risk"
      : status === "off_track"
        ? "Off track"
        : "—";
}

function summarizeUpdate(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return "—";
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) {
    return `${sentences[0]} ${sentences[1]}`.trim();
  }
  if (sentences.length === 1) {
    return sentences[0] ?? "—";
  }
  return clean.length > 180 ? `${clean.slice(0, 180)}…` : clean;
}

function formatFullDate(dateIso: string | null | undefined): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

/** Filter buckets (month keys YYYY-MM) to those within [from, to] (ISO date strings). */
function filterBucketsByDateRange<T extends { month?: string; period?: string }>(
  buckets: T[],
  dateRange: { from: string; to: string },
  getPeriod: (b: T) => string
): T[] {
  const fromMonth = dateRange.from.slice(0, 7);
  const toMonth = dateRange.to.slice(0, 7);
  return buckets.filter((b) => {
    const p = getPeriod(b);
    return p >= fromMonth && p <= toMonth;
  });
}

export interface BuildInsightsReportInput {
  teams: TeamInfo[];
  allProjects: ProjectSummary[];
  issuesByProject: Map<string, IssueSummary[]>;
  timelines: ProjectDateTimeline[];
}

export interface DateRangeFilter {
  from: string;
  to: string;
}

/**
 * Build InsightsReportData from raw teams, projects, issues, and timelines.
 * Optional dateRange filters velocity/lifecycle buckets and project lists to that window.
 */
export function buildInsightsReport(
  input: BuildInsightsReportInput,
  dateRange?: DateRangeFilter
): InsightsReportData {
  const { teams, allProjects, issuesByProject, timelines } = input;
  const reportingProjects = allProjects.filter(isActiveForReporting);

  let projects = reportingProjects.filter(
    (p) => !isTerminalProjectState(p.state)
  );
  projects = sortProjectsByState(projects);

  let showAllProjectsMessage: string | undefined;
  if (projects.length === 0 && reportingProjects.length > 0) {
    const sorted = sortProjectsByState(reportingProjects);
    showAllProjectsMessage = `No projects matched "active" (excluded: completed, canceled). Showing all ${sorted.length} project(s) and their state. Using all non-archived projects for metrics below.`;
    projects = sorted;
  }

  let projectsForLifecycle = reportingProjects;
  if (dateRange) {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    projectsForLifecycle = reportingProjects.filter((p) => {
      const created = p.createdAt ? new Date(p.createdAt) : null;
      const closedRaw = p.completedAt ?? p.canceledAt;
      const closed = closedRaw ? new Date(closedRaw) : null;
      const updated = p.updatedAt ? new Date(p.updatedAt) : null;
      if (created && created >= from && created <= to) return true;
      if (closed && closed >= from && closed <= to) return true;
      if (updated && updated >= from && updated <= to) return true;
      return false;
    });
    if (projectsForLifecycle.length === 0) projectsForLifecycle = reportingProjects;
  }

  const lifecycle = computeProjectLifecycle(projectsForLifecycle);
  let lifecycleBuckets = lifecycle.buckets;
  if (dateRange) {
    lifecycleBuckets = filterBucketsByDateRange(
      lifecycle.buckets,
      dateRange,
      (b) => b.period
    );
  }

  const unifiedStateOrder: Record<string, number> = { Now: 0, Next: 1, Later: 2, Completed: 3 };
  const unified = reportingProjects.map((p) => {
    const issues = issuesByProject.get(p.id) ?? [];
    const metrics = issues.length > 0 ? computeProjectMetrics(p.id, p.name, issues) : null;
    const completionPct = metrics?.completionPct ?? 0;
    const health = computeProjectHealth(p, completionPct);
    const lifetime = projectLifetimeDays(p);
    const stateLabel = projectStateLabel(p.state);
    const lastActivityAt = metrics?.lastActivityAt ?? p.updatedAt ?? null;
    const createdSort = p.createdAt ?? "";
    const startedIso = p.startedAt ?? p.createdAt ?? null;
    const nowForDays = stateLabel === "Now" ? daysSince(startedIso) : null;
    const terminalCloseIso =
      p.completedAt ??
      p.canceledAt ??
      (stateLabel === "Completed" ? p.updatedAt ?? null : null);
    return {
      id: p.id,
      name: p.name,
      stateSort: stateLabel,
      target: p.targetDate ?? "—",
      risk: metrics != null ? healthLabel(health.health) : "—",
      closedAt: terminalCloseIso,
      startedAt: formatFullDate(startedIso),
      nowForDays: nowForDays != null ? String(nowForDays) : "—",
      createdAt: formatFullDate(p.createdAt),
      lifetimeDays: lifetime != null ? String(lifetime) : "—",
      issueCount: issues.length > 0 ? String(issues.length) : "—",
      pctCompleted: metrics != null ? `${metrics.completionPct}%` : "—",
      lastActivity: formatFullDate(lastActivityAt),
      daysLeft: health.daysRemaining != null ? String(health.daysRemaining) : "—",
      createdSort,
    };
  });
  unified.sort((a, b) => {
    const stateOrder =
      (unifiedStateOrder[a.stateSort] ?? 99) - (unifiedStateOrder[b.stateSort] ?? 99);
    if (stateOrder !== 0) return stateOrder;
    return (a.createdSort ?? "").localeCompare(b.createdSort ?? "", undefined, { numeric: true });
  });

  const combined = projects.map((p) => {
    const issues = issuesByProject.get(p.id) ?? [];
    const metrics = computeProjectMetrics(p.id, p.name, issues);
    const health = computeProjectHealth(p, metrics.completionPct);
    return { metrics, health };
  });
  const healthOrder: Record<string, number> = { on_track: 0, at_risk: 1, off_track: 2 };
  combined.sort(
    (a, b) => (healthOrder[a.health.health] ?? 99) - (healthOrder[b.health.health] ?? 99)
  );

  const overSixWeeks = getObjectivesOverSixWeeks(projects);
  const staleIssues = getStaleIssues(issuesByProject, projects);
  let velocity = computeVelocity(projectsForLifecycle);
  if (dateRange) {
    velocity = {
      ...velocity,
      buckets: filterBucketsByDateRange(velocity.buckets, dateRange, (b) => b.month),
    };
  }

  const velocityWeeklyRaw = computeVelocityWeekly(projectsForLifecycle);
  let velocityWeeklyBuckets = velocityWeeklyRaw.buckets;
  if (dateRange) {
    const fromWeek = getWeekKey(new Date(dateRange.from));
    const toWeek = getWeekKey(new Date(dateRange.to));
    velocityWeeklyBuckets = velocityWeeklyBuckets.filter(
      (b) => b.week >= fromWeek && b.week <= toWeek
    );
  }
  const velocityWeekly =
    velocityWeeklyBuckets.length > 0
      ? {
          buckets: velocityWeeklyBuckets,
          weekLabels: velocityWeeklyBuckets.map((b) => formatWeekLabel(b.week)),
        }
      : undefined;

  const dateSummaryRows = timelines.map((t) => ({
    Project: t.projectName.slice(0, 24),
    Created: formatFullDate(t.createdAt),
    "Orig. start": t.originalStartDate ?? "—",
    "Curr. start": t.currentStartDate ?? "—",
    "Orig. target": t.originalTargetDate ?? "—",
    "Curr. target": t.currentTargetDate ?? "—",
    "# changes": String(t.dateChanges.length),
  }));

  const activityLog: InsightsReportData["activityLog"] = timelines.map((t) => {
    type Entry = { date: string; type: "date_change" | "status_update"; detail: string };
    const entries: Entry[] = [];
    for (const dc of t.dateChanges) {
      entries.push({
        date: dc.changedAt,
        type: "date_change",
        detail: `${dc.field === "targetDate" ? "Target date" : "Start date"}: ${dc.from ?? "none"} → ${dc.to ?? "none"}`,
      });
    }
    for (const su of t.statusUpdates) {
      const healthPart = su.health === "onTrack" ? "On track · " : "";
      const firstName = su.userName?.split(/\s+/)[0] ?? "";
      const by = firstName ? `${firstName} · ` : "";
      const snippet = su.body.replace(/\n/g, " ").trim().slice(0, 40);
      const ellipsis = su.body.trim().length > 40 ? "…" : "";
      entries.push({
        date: su.createdAt,
        type: "status_update",
        detail: `${healthPart}${by}${snippet}${ellipsis}`,
      });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return {
      projectName: t.projectName,
      entries: entries.map((e) => ({
        Date: formatFullDate(e.date),
        Type: e.type === "date_change" ? "Date change" : "Status update",
        Detail: e.detail,
      })),
    };
  });

  const projectUpdates: InsightsReportData["projectUpdates"] = timelines
    .map((t) => {
      const statusItems = t.statusUpdates.map((su) => ({
        dateIso: su.createdAt,
        Date: formatFullDate(su.createdAt),
        Author: su.userName ?? "Unknown",
        Summary: summarizeUpdate(su.body),
      }));
      const dateChangeItems = t.dateChanges.map((dc) => ({
        dateIso: dc.changedAt,
        Date: formatFullDate(dc.changedAt),
        Author: "System",
        Summary: `${dc.field === "targetDate" ? "Target date" : "Start date"} changed: ${dc.from ?? "none"} -> ${dc.to ?? "none"}`,
      }));
      const updates = [...statusItems, ...dateChangeItems]
        .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
        .map((item) => ({ Date: item.Date, Author: item.Author, Summary: item.Summary }));
      return {
        ProjectId: t.projectId,
        Project: t.projectName.slice(0, 28),
        updates,
      };
    })
    .filter((p) => p.updates.length > 0);

  return {
    teams: teams.map((t) => ({ Key: t.key, Name: t.name, ID: t.id })),
    activeProjects: projects.map((p) => ({
      Name: p.name,
      State: projectStateLabel(p.state),
      Start: p.startDate ?? "—",
      Target: p.targetDate ?? "—",
    })),
    showAllProjectsMessage,
    lifecycle: {
      rows: lifecycle.rows.map((r) => ({
        Project: r.projectName.slice(0, 22),
        State: r.state,
        Created: formatFullDate(r.createdAt),
        Updated: formatFullDate(r.updatedAt),
        Closed: formatFullDate(r.closedAt),
        "Lifetime (days)": r.lifetimeDays != null ? String(r.lifetimeDays) : "—",
      })),
      averageLifetimeDays: lifecycle.averageLifetimeDays,
      buckets: lifecycleBuckets.map((b) => ({
        Month: formatMonthLabel(b.period),
        Created: String(b.created),
        Closed: String(b.closed),
        "Cumul. created": String(b.cumulativeCreated),
        "Cumul. closed": String(b.cumulativeClosed),
      })),
    },
    unified: unified.map((u) => ({
      ProjectId: u.id,
      Project: u.name,
      State: u.stateSort,
      Risk: u.risk,
      Closed: formatFullDate(u.closedAt),
      "Closed month": u.closedAt ? String(u.closedAt).slice(0, 7) : "—",
      Started: u.startedAt,
      "Now for (days)": u.nowForDays,
      Created: u.createdAt,
      "Lifetime (days)": u.lifetimeDays,
      Issues: u.issueCount,
      "% done": u.pctCompleted,
      "Last activity": u.lastActivity,
      "Days left": u.daysLeft,
      Target: u.target,
    })),
    metricsHealth: combined.map(({ metrics: m, health: h }) => ({
      Health: healthLabel(h.health),
      Project: m.projectName.slice(0, 20),
      Total: String(m.total),
      Open: String(m.open),
      "In prog.": String(m.inProgress),
      Done: String(m.completed + m.canceled),
      "%": `${m.completionPct}%`,
      Stale: String(m.staleCount),
      Blocked: String(m.blockedCount),
      "Last activity": m.lastActivityAt
        ? formatFullDate(m.lastActivityAt)
        : "—",
      "Days left": h.daysRemaining != null ? String(h.daysRemaining) : "—",
    })),
    objectivesOverSixWeeks: overSixWeeks.map((o) => ({
      Project: o.project.name.slice(0, 28),
      State: o.project.state ?? "—",
      "Days running": String(o.daysRunning),
      Started: o.startedAt
        ? formatFullDate(o.startedAt)
        : o.project.createdAt
          ? formatFullDate(o.project.createdAt)
          : "—",
    })),
    staleIssues: staleIssues.map((r) => ({
      Project: r.projectName,
      Issue: r.issue.title,
      "Days since update": String(r.daysSinceUpdate),
      "Last update": formatFullDate(r.updatedAt),
    })),
    velocity: {
      ...velocity,
      monthLabels: velocity.buckets.map((b) => formatMonthLabel(b.month)),
    },
    velocityWeekly,
    dateSummary: dateSummaryRows,
    activityLog,
    projectUpdates,
  };
}
