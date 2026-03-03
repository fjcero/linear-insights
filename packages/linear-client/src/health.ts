import type { ProjectSummary, ProjectHealth, HealthStatus } from "./types.js";

const DAYS_OFF_TRACK_WINDOW = 7;

export function computeProjectHealth(
  project: ProjectSummary,
  completionPct: number,
  now: Date = new Date()
): ProjectHealth {
  const start = project.startDate ? new Date(project.startDate) : null;
  const target = project.targetDate ? new Date(project.targetDate) : null;
  const daysSinceStart = start ? Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) : null;
  const daysRemaining =
    target != null ? Math.floor((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

  let elapsedRatio: number | null = null;
  if (start && target && target > start) {
    const total = target.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    elapsedRatio = Math.min(1, Math.max(0, elapsed / total));
  }

  let health: HealthStatus = "unknown";
  // Off track only when 7 days or less to deadline and not complete (never assume off track for "no updates").
  const inOffTrackWindow =
    daysRemaining != null && daysRemaining >= 0 && daysRemaining <= DAYS_OFF_TRACK_WINDOW;
  if (inOffTrackWindow && completionPct < 100) {
    health = "off_track";
  } else if (elapsedRatio !== null) {
    const expectedMin = Math.floor(elapsedRatio * 100) - 10;
    if (completionPct >= expectedMin) health = "on_track";
    else if (completionPct >= expectedMin - 20) health = "at_risk";
    else health = "at_risk"; // Behind but not in 7-day window: at_risk, not off_track
  }

  return {
    projectId: project.id,
    projectName: project.name,
    health,
    completionPct,
    elapsedRatio,
    daysSinceStart,
    daysRemaining,
  };
}
