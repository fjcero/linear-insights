import { getLinearClient } from "./client.js";
import type { Issue } from "@linear/sdk";
import type { IssueSummary } from "./types.js";

/** Derive state name/type from issue dates and stateId for display. */
function deriveState(i: Issue): { state: string; stateType: string } {
  if (i.completedAt) return { state: "Done", stateType: "completed" };
  if (i.canceledAt) return { state: "Canceled", stateType: "canceled" };
  if (i.startedAt) return { state: "In Progress", stateType: "started" };
  return { state: "Todo", stateType: "unstarted" };
}

function mapIssue(i: Issue): IssueSummary {
  const { state, stateType } = deriveState(i);
  return {
    id: i.id,
    title: i.title,
    state,
    stateType,
    assigneeId: i.assigneeId ?? null,
    projectId: i.projectId ?? null,
    createdAt: i.createdAt != null ? i.createdAt.toISOString() : null,
    updatedAt: i.updatedAt.toISOString(),
    labelIds: i.labelIds ?? [],
    labelNames: [], // SDK Issue fragment has labelIds only; labels are lazy. Fill from labels fetch if needed.
  };
}

export interface ListIssuesByProjectOptions {
  projectId: string;
}

/**
 * List all issues for a project (paginated fetch).
 * Uses the project-scoped issues API so no filter is required.
 */
export async function listIssuesByProject(options: ListIssuesByProjectOptions): Promise<IssueSummary[]> {
  const client = getLinearClient();
  const project = await client.project(options.projectId);
  let connection = await project.issues({ first: 50 });
  while (connection.pageInfo.hasNextPage) {
    connection = await connection.fetchNext();
  }
  return connection.nodes.map(mapIssue);
}

/**
 * Fetch issues for multiple projects.
 */
export async function listIssuesForProjects(projectIds: string[]): Promise<Map<string, IssueSummary[]>> {
  const out = new Map<string, IssueSummary[]>();
  for (const id of projectIds) {
    const issues = await listIssuesByProject({ projectId: id });
    out.set(id, issues);
  }
  return out;
}
