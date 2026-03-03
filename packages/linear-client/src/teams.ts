import { getLinearClient } from "./client.js";
import type { Team } from "@linear/sdk";

export interface TeamInfo {
  id: string;
  name: string;
  key: string;
}

function toTeamInfo(t: Team): TeamInfo {
  return { id: t.id, name: t.name, key: t.key };
}

/**
 * List all teams the API key can access (no cache; use report-data layer for SQLite cache).
 * @throws if the API returns an error (e.g. invalid key, no access)
 */
export async function listTeams(): Promise<TeamInfo[]> {
  const client = getLinearClient();
  const connection = await client.teams();
  const nodes = connection?.nodes ?? [];
  const teams: TeamInfo[] = nodes.map((t: Team) => toTeamInfo(t));

  let current = connection;
  while (current?.pageInfo?.hasNextPage) {
    const next = await current.fetchNext();
    const nextNodes = next?.nodes ?? [];
    teams.push(...nextNodes.map((t: Team) => toTeamInfo(t)));
    current = next;
  }

  return teams;
}
