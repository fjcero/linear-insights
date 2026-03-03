/**
 * Report API server: serves GET /report (gated by Linear OAuth session)
 * and the /auth/* endpoints for login, callback, logout, and me.
 *
 * Run with: bun run server/report-api.ts (from apps/app).
 */
import {
  openCache,
  cacheScopeFromUserId,
  cacheScopeFromApiKey,
  projectsCacheKey,
  getProjectTimelinesCached,
  syncLinearData,
} from "@linear-insights/report-data";
import { buildInsightsReport } from "@linear-insights/report-build";
import {
  createLinearClient,
  fetchProjectHistory,
  fetchProjectUpdates,
  buildProjectDateTimeline,
} from "@linear-insights/linear-client";
import type { TeamInfo, ProjectSummary, IssueSummary, ProjectDateTimeline } from "@linear-insights/linear-client";
import {
  handleLogin,
  handleCallback,
  handleLogout,
  handleMe,
  getSession,
} from "./auth.js";

const PORT = Number(process.env.LINEAR_INSIGHTS_API_PORT ?? "3001");
const CORS_ORIGIN = process.env.LINEAR_INSIGHTS_CORS_ORIGIN ?? "*";
const SYNC_ON_START = process.env.LINEAR_INSIGHTS_SYNC_ON_START !== "0";

interface AuthContext {
  token: string;
  scope: string;
  /** Present when authenticated via OAuth session; absent for API key env fallback. */
  userId?: string;
}

/**
 * Determine the auth context from the request.
 * Supports two modes:
 *   1. OAuth session (preferred for hosted usage): reads token + userId from cookie.
 *   2. API key env var (fallback for local/CLI usage): reads LINEAR_API_KEY from env.
 */
function getAuthContext(req: Request): AuthContext | null {
  const session = getSession(req);
  if (session) {
    return {
      token: session.accessToken,
      scope: cacheScopeFromUserId(session.userId),
      userId: session.userId,
    };
  }
  // Fallback: allow API key from env for local development without OAuth setup
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey?.trim()) {
    return {
      token: envKey.trim(),
      scope: cacheScopeFromApiKey(envKey.trim()),
    };
  }
  return null;
}

const TEAM_IDS = process.env.LINEAR_TEAM_IDS
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PROJECTS_KEY = projectsCacheKey(TEAM_IDS?.length ? TEAM_IDS : undefined);

/** Sync Linear data into cache on startup (uses env API key or skips if not set). */
async function ensureCacheReady(): Promise<void> {
  const envKey = process.env.LINEAR_API_KEY;

  if (!SYNC_ON_START) {
    if (!envKey?.trim()) return;
    const cache = await openCache({ forceRefresh: false });
    const scope = cacheScopeFromApiKey(envKey.trim());
    const teams = await cache.getTeams<TeamInfo[]>(scope);
    const projects = await cache.getProjects<ProjectSummary[]>(scope, PROJECTS_KEY);
    if (teams != null && teams.length > 0 && projects != null && projects.length > 0) {
      return;
    }
    console.log("Cache empty or missing — syncing from Linear…");
    await syncLinearData({ token: envKey.trim(), forceRefresh: false, closeAfterSync: false });
    console.log("Sync done.");
    return;
  }

  if (envKey?.trim()) {
    console.log("Refreshing cache from Linear on startup…");
    await syncLinearData({ token: envKey.trim(), forceRefresh: true, closeAfterSync: false });
    console.log("Refresh done.");
  } else {
    console.log(
      "No LINEAR_API_KEY set — skipping startup sync. " +
      "Cache will be populated per-user after OAuth login."
    );
  }
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

async function handleReport(req: Request, url: URL): Promise<Response> {
  const auth = getAuthContext(req);
  if (!auth) {
    return json({ error: "Unauthenticated. Log in via /auth/login." }, 401);
  }

  const { token, scope } = auth;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const teamParam = url.searchParams.get("team") ?? "all";
  const dateRange =
    from && to ? ({ from, to } as { from: string; to: string }) : undefined;

  const client = createLinearClient(token);

  async function readFromCache(): Promise<
    | {
        ok: true;
        teams: TeamInfo[];
        projects: ProjectSummary[];
        issuesByProject: Map<string, IssueSummary[]>;
        timelines: ProjectDateTimeline[];
      }
    | { ok: false; response: Response }
  > {
    const cache = await openCache({ forceRefresh: false });
    const teams = await cache.getTeams<TeamInfo[]>(scope);
    if (!teams || teams.length === 0) {
      return {
        ok: false,
        response: json(
          { error: "Cache empty. Please wait while data syncs, or try again shortly." },
          503
        ),
      };
    }

    const allProjects = await cache.getProjects<ProjectSummary[]>(scope, PROJECTS_KEY);
    if (!allProjects || allProjects.length === 0) {
      return {
        ok: false,
        response: json(
          { error: "Cache empty. Please wait while data syncs, or try again shortly." },
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
  }

  // Trigger a per-user sync if cache is empty
  async function triggerUserSync(): Promise<void> {
    await syncLinearData({ token, userId: auth.userId, forceRefresh: false, closeAfterSync: false });
  }

  let snapshot = await readFromCache();

  // Cache miss for this user: sync their data then retry once
  if (!snapshot.ok) {
    console.log(`Cache empty for scope ${scope} — syncing…`);
    await triggerUserSync();
    snapshot = await readFromCache();
    if (!snapshot.ok) return snapshot.response;
  }

  // Backfill timelines if missing
  if (snapshot.projects.length > 0 && snapshot.timelines.length === 0) {
    console.log("No project timelines in cache — backfilling…");
    const cache = await openCache({ forceRefresh: false });
    await getProjectTimelinesCached(cache, scope, snapshot.projects.map((p) => p.id), async (pid) => {
      const proj =
        snapshot.ok ? snapshot.projects.find((p) => p.id === pid) ?? { id: pid, name: pid, state: "", teamIds: [] }
                   : { id: pid, name: pid, state: "", teamIds: [] };
      const [history, updates] = await Promise.all([
        fetchProjectHistory(client, pid),
        fetchProjectUpdates(client, pid),
      ]);
      return buildProjectDateTimeline(proj, history, updates);
    });
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

// ---------------------------------------------------------------------------
// Startup: pre-populate cache if LINEAR_API_KEY is set
// ---------------------------------------------------------------------------

let cacheReady = false;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Auth routes (no auth required)
    if (url.pathname === "/auth/login" && req.method === "GET") {
      return handleLogin(req);
    }
    if (url.pathname === "/auth/callback" && req.method === "GET") {
      return handleCallback(req);
    }
    if (url.pathname === "/auth/logout" && req.method === "POST") {
      return handleLogout(req);
    }
    if (url.pathname === "/auth/me" && req.method === "GET") {
      return handleMe(req);
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Report endpoint
    if (req.method === "GET" && (url.pathname === "/report" || url.pathname === "/report.json")) {
      if (!cacheReady) {
        const auth = getAuthContext(req);
        if (!auth) return json({ error: "Unauthenticated. Log in via /auth/login." }, 401);
      }
      try {
        return await handleReport(req, url);
      } catch (err) {
        console.error("Report error:", err);
        return json({ error: "Report generation failed. See server logs." }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Report API: http://localhost:${server.port}/report`);

await ensureCacheReady();
cacheReady = true;
