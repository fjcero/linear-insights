/**
 * Report API server: serves GET /report (gated by Linear OAuth session)
 * and the /auth/* endpoints for login, callback, logout, and me.
 *
 * Run with: bun run server/report-api.ts (from apps/app).
 */
import {
  openCache,
  cacheScopeFromApiKey,
  projectsCacheKey,
  syncLinearData,
} from "@linear-insights/report-data";
import type { TeamInfo, ProjectSummary } from "@linear-insights/linear-client";
import { handleLogin, handleCallback, handleLogout, handleMe } from "./auth.js";
import { handleReportRequest } from "./report-handler.js";

const PORT = Number(process.env.LINEAR_INSIGHTS_API_PORT ?? "3001");
const CORS_ORIGIN = process.env.LINEAR_INSIGHTS_CORS_ORIGIN ?? "*";
const SYNC_ON_START = process.env.LINEAR_INSIGHTS_SYNC_ON_START !== "0";

const TEAM_IDS = process.env.LINEAR_TEAM_IDS
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PROJECTS_KEY = projectsCacheKey(TEAM_IDS?.length ? TEAM_IDS : undefined);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
    },
  });
}

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

// ---------------------------------------------------------------------------
// Startup: pre-populate cache if LINEAR_API_KEY is set
// ---------------------------------------------------------------------------

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
      try {
        return await handleReportRequest(req);
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
