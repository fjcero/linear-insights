/** Minimal types for Linear API responses and derived data. */

export type ProjectState = "started" | "planned" | "paused" | "completed" | "canceled";

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  state: string;
  /** When the project was deleted (ISO). Null/undefined if not deleted. */
  deletedAt?: string | null;
  /** When the project was archived (ISO). Null/undefined if not archived. */
  archivedAt?: string | null;
  /** True when project is in trash bin. */
  trashed?: boolean;
  startDate?: string | null;
  targetDate?: string | null;
  teamIds: string[];
  /** When the project was created (ISO). */
  createdAt?: string | null;
  /** Last meaningful update (ISO). */
  updatedAt?: string | null;
  /** When moved to started state (ISO). */
  startedAt?: string | null;
  /** When moved to completed state (ISO). */
  completedAt?: string | null;
  /** When moved to canceled state (ISO). */
  canceledAt?: string | null;
}

export interface IssueSummary {
  id: string;
  title: string;
  state: string;
  stateType?: string;
  assigneeId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  updatedAt: string;
  labelIds?: string[];
  labelNames?: string[];
}

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  canceled: number;
  completionPct: number;
  lastActivityAt: string | null;
  staleCount: number;
  blockedCount: number;
}

export type HealthStatus = "on_track" | "at_risk" | "off_track" | "unknown";

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  health: HealthStatus;
  completionPct: number;
  elapsedRatio: number | null;
  daysSinceStart: number | null;
  daysRemaining: number | null;
}

/** Projects created and closed per calendar month (velocity = project throughput). */
export interface ProjectsPerMonth {
  month: string;
  created: number;
  closed: number;
}

/** Projects created and closed per ISO week (WoW). */
export interface ProjectsPerWeek {
  week: string;
  created: number;
  closed: number;
}

export type VelocityTrend = "accelerating" | "steady" | "slowing" | "unknown";

export interface VelocitySummary {
  /** Projects created and closed by month (velocity is measured on projects, not issues). */
  buckets: ProjectsPerMonth[];
  trend: VelocityTrend;
  /** Projects closed in the recent window (e.g. last 2 months). */
  trendRecentTotal: number;
  /** Projects closed in the previous window (e.g. previous 2 months). */
  trendPreviousTotal: number;
}

export interface VelocityWeeklySummary {
  buckets: ProjectsPerWeek[];
}

/** Per-project lifecycle: created, closed, last update, lifetime in days. */
export interface ProjectLifecycleRow {
  projectId: string;
  projectName: string;
  state: string;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  lifetimeDays: number | null;
}

/** Bucket for cumulative projects over time (e.g. by month). */
export interface ProjectCountBucket {
  period: string;
  created: number;
  closed: number;
  cumulativeCreated: number;
  cumulativeClosed: number;
}

/** Full lifecycle analysis result. */
export interface ProjectLifecycleAnalysis {
  rows: ProjectLifecycleRow[];
  averageLifetimeDays: number | null;
  buckets: ProjectCountBucket[];
}

/** Issue with no update in 6+ weeks (and created 6+ weeks ago). */
export interface StaleIssueRow {
  issue: IssueSummary;
  projectName: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  daysSinceUpdate: number;
}

/** Active project (objective) that has been running more than 6 weeks. */
export interface ObjectiveOverSixWeeks {
  project: ProjectSummary;
  daysRunning: number;
  startedAt: string | null;
}

/** A single field change extracted from a ProjectHistory entry. */
export interface ProjectFieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

/** A parsed ProjectHistory entry. */
export interface ProjectHistoryEvent {
  id: string;
  projectId: string;
  createdAt: string;
  changes: ProjectFieldChange[];
}

/** A human-written project status update (the "why"). */
export interface ProjectStatusUpdate {
  id: string;
  projectId: string;
  createdAt: string;
  body: string;
  health: string;
  userName: string | null;
}

/** Full date-change timeline for a single project. */
export interface ProjectDateTimeline {
  projectId: string;
  projectName: string;
  createdAt: string | null;
  originalStartDate: string | null;
  currentStartDate: string | null;
  originalTargetDate: string | null;
  currentTargetDate: string | null;
  dateChanges: {
    changedAt: string;
    field: "startDate" | "targetDate";
    from: string | null;
    to: string | null;
  }[];
  statusUpdates: ProjectStatusUpdate[];
}
