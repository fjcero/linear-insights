/**
 * Single start: run report API (sync if needed, serve /report) then start the app.
 * Flow: 1) Start script  2) Report API ensures cache, serves JSON  3) App loads from /report.
 */
import { join } from "node:path";

const API_PORT = Number(process.env.LINEAR_INSIGHTS_API_PORT ?? "3001");
const API_URL = `http://127.0.0.1:${API_PORT}/report`;
const POLL_MS = 800;
const POLL_ATTEMPTS = 60; // ~48s max wait for API (e.g. while syncing)

// Run from app package dir so "bun run server/report-api.ts" and "bun run dev" resolve correctly
const cwd = join(import.meta.dir, "..");

const apiProcess = Bun.spawn({
  cmd: ["bun", "run", "server/report-api.ts"],
  cwd,
  stdout: "inherit",
  stderr: "inherit",
});

function killApi() {
  try {
    apiProcess.kill();
  } catch {
    // already exited
  }
}

process.on("SIGINT", () => {
  killApi();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killApi();
  process.exit(143);
});

async function waitForApi(): Promise<boolean> {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    if (apiProcess.exitCode != null) {
      console.error("Report API process exited early.");
      return false;
    }
    try {
      const res = await fetch(API_URL);
      // 200 = report ready, 503 = API up but cache empty (app can still show error)
      if (res.status === 200 || res.status === 503) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.error("Report API did not become ready in time.");
  return false;
}

const ready = await waitForApi();
if (!ready) {
  killApi();
  process.exit(1);
}

const viteProcess = Bun.spawn({
  cmd: ["bun", "run", "dev"],
  cwd,
  stdout: "inherit",
  stderr: "inherit",
});

viteProcess.exited.then((code) => {
  killApi();
  process.exit(code ?? 0);
});
