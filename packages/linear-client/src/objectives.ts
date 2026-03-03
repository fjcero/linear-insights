import type { IssueSummary, ProjectSummary } from "./types.js";
import type { StaleIssueRow, ObjectiveOverSixWeeks } from "./types.js";

const SIX_WEEKS_DAYS = 6 * 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isCompleted(state: string, stateType?: string): boolean {
  return (
    stateType === "completed" ||
    state?.toLowerCase() === "done" ||
    state?.toLowerCase() === "canceled"
  );
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Stale = open issue, created 6+ weeks ago, no update in 6+ weeks.
 * Returns rows for display (project name, issue, days since update).
 */
export function getStaleIssues(
  issuesByProject: Map<string, IssueSummary[]>,
  projects: ProjectSummary[],
  now: Date = new Date()
): StaleIssueRow[] {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - SIX_WEEKS_DAYS);

  const rows: StaleIssueRow[] = [];
  for (const [projectId, issues] of issuesByProject) {
    const projectName = nameById.get(projectId) ?? "(unknown)";
    for (const issue of issues) {
      if (isCompleted(issue.state, issue.stateType)) continue;
      const createdAt = issue.createdAt ? new Date(issue.createdAt) : new Date(issue.updatedAt);
      const updatedAt = new Date(issue.updatedAt);
      if (createdAt >= cutoff || updatedAt >= cutoff) continue;
      rows.push({
        issue,
        projectName,
        projectId,
        createdAt: issue.createdAt ?? issue.updatedAt,
        updatedAt: issue.updatedAt,
        daysSinceUpdate: daysBetween(updatedAt, now),
      });
    }
  }
  return rows.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

/**
 * Active projects (objectives) that have been running more than 6 weeks.
 * "Running" = from startedAt if set, else from createdAt.
 */
export function getObjectivesOverSixWeeks(
  projects: ProjectSummary[],
  now: Date = new Date()
): ObjectiveOverSixWeeks[] {
  const terminal = new Set(["completed", "canceled"]);
  const rows: ObjectiveOverSixWeeks[] = [];

  for (const p of projects) {
    if (terminal.has(p.state?.toLowerCase() ?? "")) continue;
    const startedAt = p.startedAt ? new Date(p.startedAt) : null;
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    const from = startedAt ?? createdAt;
    if (!from) continue;
    const daysRunning = daysBetween(from, now);
    if (daysRunning < SIX_WEEKS_DAYS) continue;
    rows.push({
      project: p,
      daysRunning,
      startedAt: p.startedAt ?? null,
    });
  }

  return rows.sort((a, b) => b.daysRunning - a.daysRunning);
}
