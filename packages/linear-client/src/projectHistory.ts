import { getLinearClient } from "./client.js";
import type {
  ProjectSummary,
  ProjectHistoryEvent,
  ProjectFieldChange,
  ProjectStatusUpdate,
  ProjectDateTimeline,
} from "./types.js";

/**
 * Parse a single ProjectHistory.entries blob into structured field changes.
 * The `entries` shape is untyped (JSONObject); we handle common patterns defensively.
 */
function parseEntries(entries: unknown): ProjectFieldChange[] {
  if (entries == null || typeof entries !== "object") return [];

  if (Array.isArray(entries)) {
    return entries.flatMap((e) => parseEntries(e));
  }

  const obj = entries as Record<string, unknown>;
  const changes: ProjectFieldChange[] = [];

  if ("field" in obj && typeof obj.field === "string") {
    changes.push({
      field: obj.field,
      from: obj.previousValue != null ? String(obj.previousValue) : (obj.from != null ? String(obj.from) : null),
      to: obj.newValue != null ? String(obj.newValue) : (obj.to != null ? String(obj.to) : null),
    });
    return changes;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const inner = value as Record<string, unknown>;
      if ("from" in inner || "to" in inner) {
        changes.push({
          field: key,
          from: inner.from != null ? String(inner.from) : null,
          to: inner.to != null ? String(inner.to) : null,
        });
      }
    }
  }

  return changes;
}

/** Fetch all ProjectHistory entries for a given project ID. */
export async function fetchProjectHistory(projectId: string): Promise<ProjectHistoryEvent[]> {
  const client = getLinearClient();
  const project = await client.project(projectId);
  let connection = await project.history({ first: 50 });
  const events: ProjectHistoryEvent[] = [];

  for (const node of connection?.nodes ?? []) {
    const changes = parseEntries(node.entries);
    if (changes.length > 0) {
      events.push({
        id: node.id,
        projectId,
        createdAt: node.createdAt.toISOString(),
        changes,
      });
    }
  }

  while (connection?.pageInfo?.hasNextPage) {
    connection = await connection.fetchNext();
    for (const node of connection?.nodes ?? []) {
      const changes = parseEntries(node.entries);
      if (changes.length > 0) {
        events.push({
          id: node.id,
          projectId,
          createdAt: node.createdAt.toISOString(),
          changes,
        });
      }
    }
  }

  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return events;
}

/** Fetch human-written ProjectUpdate entries (status updates with health). */
export async function fetchProjectUpdates(projectId: string): Promise<ProjectStatusUpdate[]> {
  const client = getLinearClient();
  const project = await client.project(projectId);
  let connection = await project.projectUpdates({ first: 50 });
  const updates: ProjectStatusUpdate[] = [];

  for (const node of connection?.nodes ?? []) {
    const user = await node.user;
    updates.push({
      id: node.id,
      projectId,
      createdAt: node.createdAt.toISOString(),
      body: node.body,
      health: node.health,
      userName: user?.name ?? null,
    });
  }

  while (connection?.pageInfo?.hasNextPage) {
    connection = await connection.fetchNext();
    for (const node of connection?.nodes ?? []) {
      const user = await node.user;
      updates.push({
        id: node.id,
        projectId,
        createdAt: node.createdAt.toISOString(),
        body: node.body,
        health: node.health,
        userName: user?.name ?? null,
      });
    }
  }

  updates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return updates;
}

/**
 * Build a full date-change timeline for a project.
 * Walks history in chronological order to determine original vs. current dates.
 */
export function buildProjectDateTimeline(
  project: ProjectSummary,
  history: ProjectHistoryEvent[],
  statusUpdates: ProjectStatusUpdate[],
): ProjectDateTimeline {
  const dateChanges: ProjectDateTimeline["dateChanges"] = [];

  let originalStartDate: string | null = project.startDate ?? null;
  let originalTargetDate: string | null = project.targetDate ?? null;

  const sorted = [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const event of sorted) {
    for (const change of event.changes) {
      if (change.field === "startDate" || change.field === "targetDate") {
        dateChanges.push({
          changedAt: event.createdAt,
          field: change.field,
          from: change.from,
          to: change.to,
        });
      }
    }
  }

  if (dateChanges.length > 0) {
    const startChanges = dateChanges.filter((c) => c.field === "startDate");
    const targetChanges = dateChanges.filter((c) => c.field === "targetDate");

    if (startChanges.length > 0) {
      originalStartDate = startChanges[0].from ?? project.startDate ?? null;
    }
    if (targetChanges.length > 0) {
      originalTargetDate = targetChanges[0].from ?? project.targetDate ?? null;
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    createdAt: project.createdAt ?? null,
    originalStartDate,
    currentStartDate: project.startDate ?? null,
    originalTargetDate,
    currentTargetDate: project.targetDate ?? null,
    dateChanges,
    statusUpdates,
  };
}

/**
 * Fetch history + status updates for multiple projects and build timelines.
 * Only includes projects that have date data or date changes.
 */
export async function fetchProjectDateTimelines(
  projects: ProjectSummary[],
): Promise<ProjectDateTimeline[]> {
  const timelines: ProjectDateTimeline[] = [];

  for (const project of projects) {
    const [history, updates] = await Promise.all([
      fetchProjectHistory(project.id),
      fetchProjectUpdates(project.id),
    ]);
    const timeline = buildProjectDateTimeline(project, history, updates);
    timelines.push(timeline);
  }

  return timelines;
}
