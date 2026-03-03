import type { LinearClient } from "@linear/sdk";
import type { Issue } from "@linear/sdk";
import type { IssueSummary } from "./types.js";

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
    labelNames: [],
  };
}

export interface ListIssuesByProjectOptions {
  projectId: string;
}

/**
 * List all issues for a project (paginated fetch).
 */
export async function listIssuesByProject(client: LinearClient, options: ListIssuesByProjectOptions): Promise<IssueSummary[]> {
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
export async function listIssuesForProjects(client: LinearClient, projectIds: string[]): Promise<Map<string, IssueSummary[]>> {
  const out = new Map<string, IssueSummary[]>();
  for (const id of projectIds) {
    const issues = await listIssuesByProject(client, { projectId: id });
    out.set(id, issues);
  }
  return out;
}
