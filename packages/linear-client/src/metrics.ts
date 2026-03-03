import type { IssueSummary, ProjectMetrics } from "./types.js";

/** Issues with no update in this many days are "stale" (objective-style: 6 weeks). */
const STALE_DAYS = 6 * 7;
const BLOCKED_LABEL = "Blocked";

function isCompletedState(state: string, stateType?: string): boolean {
  return stateType === "completed" || state.toLowerCase() === "done" || state.toLowerCase() === "canceled";
}

export function computeProjectMetrics(
  projectId: string,
  projectName: string,
  issues: IssueSummary[],
  now: Date = new Date()
): ProjectMetrics {
  const staleCutoff = new Date(now);
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

  let open = 0;
  let inProgress = 0;
  let completed = 0;
  let canceled = 0;
  let lastActivityAt: string | null = null;
  let staleCount = 0;
  let blockedCount = 0;

  for (const i of issues) {
    if (isCompletedState(i.state, i.stateType)) {
      if (i.state.toLowerCase() === "canceled") canceled++;
      else completed++;
    } else if (i.stateType === "started") {
      inProgress++;
    } else {
      open++;
    }
    const updated = new Date(i.updatedAt);
    if (!lastActivityAt || updated > new Date(lastActivityAt)) lastActivityAt = i.updatedAt;
    // Stale = open issue, created 6+ weeks ago, no update in 6+ weeks
    const created = i.createdAt ? new Date(i.createdAt) : updated;
    if (
      !isCompletedState(i.state, i.stateType) &&
      created < staleCutoff &&
      updated < staleCutoff
    ) {
      staleCount++;
    }
    const isBlocked =
      i.labelNames?.some((n) => n === BLOCKED_LABEL) || i.state?.toLowerCase() === "blocked";
    if (isBlocked) blockedCount++;
  }

  const total = issues.length;
  const completionPct = total === 0 ? 0 : Math.round((100 * (completed + canceled)) / total);

  return {
    projectId,
    projectName,
    total,
    open,
    inProgress,
    completed,
    canceled,
    completionPct,
    lastActivityAt,
    staleCount,
    blockedCount,
  };
}
