/**
 * Report API server: syncs cache if needed, then reads from SQLite and serves GET /report.
 * Flow: start → update cache (if empty/stale) → expose JSON API from cache.
 * Run with: bun run server/report-api.ts (from apps/app).
 */
import { openCache, closeCache, getScope, projectsCacheKey } from "@linear-insights/report-data";
import { buildInsightsReport } from "@linear-insights/report-build";
import { syncLinearData } from "@linear-insights/report-data";
import type { TeamInfo, ProjectSummary, IssueSummary, ProjectDateTimeline } from "@linear-insights/linear-client";

const PORT = Number(process.env.LINEAR_INSIGHTS_API_PORT ?? "3001");
const CORS_ORIGIN = process.env.LINEAR_INSIGHTS_CORS_ORIGIN ?? "*";
const SYNC_ON_START = process.env.LINEAR_INSIGHTS_SYNC_ON_START !== "0";
const TEAM_IDS = process.env.LINEAR_TEAM_IDS
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PROJECTS_KEY = projectsCacheKey(TEAM_IDS?.length ? TEAM_IDS : undefined);

/** Sync Linear data into cache if cache is empty (so /report can serve immediately). */
async function ensureCacheReady(): Promise<void> {
  if (SYNC_ON_START) {
    console.log("Refreshing cache from Linear on startup…");
    await syncLinearData({ forceRefresh: true });
    console.log("Refresh done.");
    return;
  }

  const cache = await openCache({ forceRefresh: false });
  const scope = getScope();
  try {
    const teams = await cache.getTeams<TeamInfo[]>(scope);
    const projects = await cache.getProjects<ProjectSummary[]>(scope, PROJECTS_KEY);
    if (teams != null && teams.length > 0 && projects != null && projects.length > 0) {
      return; // cache already populated
    }
  } finally {
    closeCache();
  }
  console.log("Cache empty or missing — syncing from Linear…");
  await syncLinearData({ forceRefresh: false });
  console.log("Sync done.");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
    },
  });
}

async function handleReport(url: URL): Promise<Response> {
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const teamParam = url.searchParams.get("team") ?? "all";
  const dateRange =
    from && to ? ({ from, to } as { from: string; to: string }) : undefined;

  async function readFromCache(): Promise<
    | { ok: true; teams: TeamInfo[]; projects: ProjectSummary[]; issuesByProject: Map<string, IssueSummary[]>; timelines: ProjectDateTimeline[] }
    | { ok: false; response: Response }
  > {
    const cache = await openCache({ forceRefresh: false });
    const scope = getScope();
    try {
      const teams = await cache.getTeams<TeamInfo[]>(scope);
      if (!teams || teams.length === 0) {
        return {
          ok: false,
          response: json(
            { error: "Cache empty. Ensure LINEAR_API_KEY is set and restart the app to trigger sync." },
            503
          ),
        };
      }

      const allProjects = await cache.getProjects<ProjectSummary[]>(scope, PROJECTS_KEY);
      if (!allProjects || allProjects.length === 0) {
        return {
          ok: false,
          response: json(
            { error: "Cache empty. Ensure LINEAR_API_KEY is set and restart the app to trigger sync." },
            503
          ),
        };
      }

      let projects = allProjects;
      if (teamParam && teamParam !== "all") {
        const lower = teamParam.toLowerCase();
        const resolvedTeamId = teams.find(
          (t) => t.id.toLowerCase() === lower || t.key.toLowerCase() === lower
        )?.id;
        if (!resolvedTeamId) {
          return { ok: false, response: json({ error: `Unknown team filter: ${teamParam}` }, 400) };
        }
        projects = allProjects.filter((p) => p.teamIds.includes(resolvedTeamId));
      }

      const issuesByProject = new Map<string, IssueSummary[]>();
      for (const p of projects) {
        const issues = await cache.getIssues<IssueSummary[]>(scope, p.id);
        issuesByProject.set(p.id, issues ?? []);
      }

      const timelines: ProjectDateTimeline[] = [];
      for (const p of projects) {
        const t = await cache.getHistory<ProjectDateTimeline>(scope, p.id);
        if (t) timelines.push(t);
      }

      return { ok: true, teams, projects, issuesByProject, timelines };
    } finally {
      closeCache();
    }
  }

  // First read
  let snapshot = await readFromCache();
  if (!snapshot.ok) return snapshot.response;

  // If timelines are missing, backfill once and retry.
  if (snapshot.projects.length > 0 && snapshot.timelines.length === 0) {
    console.log("No project timelines in cache — backfilling status updates/history…");
    await syncLinearData({ forceRefresh: false });
    snapshot = await readFromCache();
    if (!snapshot.ok) return snapshot.response;
  }

  const report = buildInsightsReport(
    {
      teams: snapshot.teams,
      allProjects: snapshot.projects,
      issuesByProject: snapshot.issuesByProject,
      timelines: snapshot.timelines,
    },
    dateRange
  );
  return json(report);
}

let cacheReady = false;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && (url.pathname === "/report" || url.pathname === "/report.json")) {
      if (!cacheReady) return json({ error: "Cache sync in progress — please wait and retry." }, 503);
      return handleReport(url);
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Report API: http://localhost:${server.port}/report`);

await ensureCacheReady();
cacheReady = true;
