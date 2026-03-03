export interface ProjectsPerMonth {
  month: string;
  created: number;
  closed: number;
}

export type VelocityTrend = "accelerating" | "steady" | "slowing" | "unknown";

export interface VelocitySummary {
  buckets: ProjectsPerMonth[];
  trend: VelocityTrend;
  trendRecentTotal: number;
  trendPreviousTotal: number;
}

/** Report payload produced by the insights command; shared by CLI and web app. */
export interface InsightsReportData {
  teams: { Key: string; Name: string; ID: string }[];
  activeProjects: { Name: string; State: string; Start: string; Target: string }[];
  showAllProjectsMessage?: string;
  lifecycle: {
    rows: { Project: string; State: string; Created: string; Updated: string; Closed: string; "Lifetime (days)": string }[];
    averageLifetimeDays: number | null;
    buckets: { Month: string; Created: string; Closed: string; "Cumul. created": string; "Cumul. closed": string }[];
  };
  unified: { ProjectId: string; Project: string; State: string; Risk: string; Closed: string; "Closed month": string; Started: string; "Now for (days)": string; Created: string; "Lifetime (days)": string; Issues: string; "% done": string; "Last activity": string; "Days left": string; Target: string }[];
  metricsHealth: {
    Health: string;
    Project: string;
    Total: string;
    Open: string;
    "In prog.": string;
    Done: string;
    "%": string;
    Stale: string;
    Blocked: string;
    "Last activity": string;
    "Days left": string;
  }[];
  objectivesOverSixWeeks: { Project: string; State: string; "Days running": string; Started: string }[];
  staleIssues: { Project: string; Issue: string; "Days since update": string; "Last update": string }[];
  velocity: VelocitySummary & { monthLabels: string[] };
  /** Week-over-week velocity (optional). */
  velocityWeekly?: {
    buckets: { week: string; created: number; closed: number }[];
    weekLabels?: string[];
  };
  dateSummary?: {
    Project: string;
    Created: string;
    "Orig. start": string;
    "Curr. start": string;
    "Orig. target": string;
    "Curr. target": string;
    "# changes": string;
  }[];
  activityLog?: {
    projectName: string;
    entries: { Date: string; Type: string; Detail: string }[];
  }[];
  /** Structured status updates per project for UI cards. */
  projectUpdates?: {
    ProjectId: string;
    Project: string;
    updates: { Date: string; Author: string; Summary: string }[];
  }[];
  /** Optional path to velocity chart HTML file (CLI only). */
  chartPath?: string;
}
