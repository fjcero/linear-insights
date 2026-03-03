import { getLinearClient } from "./client.js";
import type { Project } from "@linear/sdk";
import type { ProjectSummary } from "./types.js";
import { listTeams } from "./teams.js";
import { isTerminalProjectState } from "./projectState.js";

export interface ListProjectsOptions {
  teamIds?: string[];
  state?: string;
}

function mapProject(p: Project, teamId?: string): ProjectSummary {
  const startDate = p.startDate != null ? String(p.startDate) : null;
  const targetDate = p.targetDate != null ? String(p.targetDate) : null;
  const deletedAtRaw =
    "deletedAt" in p
      ? (p as Project & { deletedAt?: Date | null }).deletedAt
      : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    state: p.state,
    deletedAt: deletedAtRaw != null ? deletedAtRaw.toISOString() : null,
    archivedAt: p.archivedAt != null ? p.archivedAt.toISOString() : null,
    trashed: Boolean(p.trashed),
    startDate,
    targetDate,
    teamIds: teamId ? [teamId] : [],
    createdAt: p.createdAt != null ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt != null ? p.updatedAt.toISOString() : null,
    startedAt: p.startedAt != null ? p.startedAt.toISOString() : null,
    completedAt: p.completedAt != null ? p.completedAt.toISOString() : null,
    canceledAt: p.canceledAt != null ? p.canceledAt.toISOString() : null,
  };
}

const IGNORED_PROJECT_STATES = new Set(["archived", "deleted", "canceled", "cancelled"]);

/** True when project should be ignored in reporting/metrics. */
export function isActiveForReporting(project: ProjectSummary): boolean {
  if (project.deletedAt) return false;
  if (project.archivedAt) return false;
  if (project.trashed) return false;
  if (project.canceledAt) return false;
  const state = (project.state ?? "").toLowerCase();
  if (IGNORED_PROJECT_STATES.has(state)) return false;
  return true;
}

/** Fetch all projects for a single team (with pagination). */
async function fetchProjectsForTeam(teamId: string): Promise<ProjectSummary[]> {
  const client = getLinearClient();
  const team = await client.team(teamId);
  const connection = await team.projects({ first: 50, includeArchived: false });
  const nodes = connection?.nodes ?? [];
  const projects: ProjectSummary[] = nodes.map((p: Project) => mapProject(p, teamId));
  let current = connection;
  while (current?.pageInfo?.hasNextPage) {
    const next = await current.fetchNext();
    projects.push(...(next?.nodes ?? []).map((p: Project) => mapProject(p, teamId)));
    current = next;
  }
  return projects;
}

/**
 * Resolve option team IDs/keys to actual team UUIDs.
 * options.teamIds can be UUIDs or team keys (e.g. "OTH", "MOR").
 */
function resolveTeamIds(teams: { id: string; key: string }[], optionTeamIds?: string[]): string[] {
  if (!optionTeamIds?.length) return teams.map((t) => t.id);
  const optionSet = new Set(optionTeamIds.map((x) => x.trim().toLowerCase()));
  return teams
    .filter((t) => optionSet.has(t.id.toLowerCase()) || optionSet.has(t.key.toLowerCase()))
    .map((t) => t.id);
}

/**
 * List projects by fetching from each team (works even when root projects query returns none).
 * options.teamIds can be team UUIDs or keys (e.g. "OTH", "MOR"). If empty, all teams are used.
 * Optionally filter by state in memory.
 */
export async function listProjects(options: ListProjectsOptions = {}): Promise<ProjectSummary[]> {
  const teams = await listTeams();
  const teamIdsToFetch = resolveTeamIds(teams, options.teamIds);

  const byId = new Map<string, ProjectSummary>();
  for (const teamId of teamIdsToFetch) {
    const projects = await fetchProjectsForTeam(teamId);
    for (const p of projects) {
      const existing = byId.get(p.id);
      if (existing) {
        existing.teamIds = [...new Set([...existing.teamIds, ...p.teamIds])];
      } else {
        byId.set(p.id, { ...p });
      }
    }
  }

  if (byId.size === 0) {
    const client = getLinearClient();
    const connection = await client.projects({ first: 50, includeArchived: false });
    const nodes = connection?.nodes ?? [];
    for (const p of nodes) {
      const summary = mapProject(p as Project);
      if (!byId.has(summary.id)) byId.set(summary.id, summary);
    }
    let current = connection;
    while (current?.pageInfo?.hasNextPage) {
      const next = await current.fetchNext();
      for (const p of next?.nodes ?? []) {
        const summary = mapProject(p as Project);
        if (!byId.has(summary.id)) byId.set(summary.id, summary);
      }
      current = next;
    }
  }

  let result = Array.from(byId.values());
  if (options.state) {
    result = result.filter((p) => p.state === options.state);
  }
  return result;
}

/**
 * List projects that are considered "active" (not completed/canceled).
 * Linear may use custom statuses or deprecated state; we treat any non-terminal state as active.
 */
export async function listActiveProjects(options: ListProjectsOptions = {}): Promise<ProjectSummary[]> {
  const all = await listProjects(options);
  return all.filter(
    (p) =>
      isActiveForReporting(p) &&
      !isTerminalProjectState(p.state)
  );
}
