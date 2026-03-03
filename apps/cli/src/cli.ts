#!/usr/bin/env bun
import { runInsightsCommand } from "./commands/insights/insights.command.js";
import { runSyncCommand } from "./commands/sync/sync.command.js";

async function main() {
  const args = process.argv.slice(2);
  const noCache = args.includes("--no-cache");
  const forceCache = args.includes("--force-cache");
  const force = args.includes("--force");
  const forceRefresh =
    force || noCache || forceCache || process.env.LINEAR_INSIGHTS_FORCE_REFRESH === "1";
  const positional = args.filter((a) => !a.startsWith("--"));

  if (positional[0] === "sync") {
    await runSyncCommand({ forceRefresh });
    return;
  }

  if (positional[0] === "insights" || positional[0] === "report" || positional.length === 0) {
    await runInsightsCommand({ forceRefresh });
    return;
  }

  console.log("Usage: linear-insights [command] [options]");
  console.log("  insights (default) — full report: teams, projects, metrics, health, velocity");
  console.log("  sync               — fetch and cache data only (no report)");
  console.log("  --force            — force refresh cache (fetch fresh data)");
  console.log("  --no-cache         — same as --force");
  console.log("  --force-cache      — same as --force");
  console.log("  Env: LINEAR_INSIGHTS_FORCE_REFRESH=1 to force refresh");
  process.exit(1);
}

main();
