import chalk from "chalk";
import {
  listTeams,
  listProjects,
  listIssuesByProject,
  fetchProjectHistory,
  fetchProjectUpdates,
  buildProjectDateTimeline,
  isTerminalProjectState,
  sortProjectsByState,
} from "@linear-insights/linear-client";
import {
  openCache,
  closeCache,
  getScope,
  getTeamsCached,
  getProjectsCached,
  getIssuesCached,
  getProjectTimelinesCached,
} from "@linear-insights/report-data";
import { buildInsightsReport } from "@linear-insights/report-build";
import {
  writeReportJson,
  getReportJsonPath,
  renderInsightsReport,
} from "../../components/index.js";

const REQUEST_TIMEOUT_MS = 30_000;

class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly label: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new TimeoutError(
            `${label} did not complete within ${ms / 1000}s. Check network connectivity and that LINEAR_API_KEY is valid.`,
            label,
            ms
          )
        ),
      ms
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function step(msg: string): void {
  process.stdout.write(chalk.dim("  … " + msg));
}

function stepDone(suffix?: string): void {
  process.stdout.write(chalk.green(" done") + (suffix ? chalk.dim(" " + suffix) : "") + "\n");
}

export async function runInsightsCommand(options?: { forceRefresh?: boolean }): Promise<void> {
  const teamIds = process.env.LINEAR_TEAM_IDS?.split(",").map((s) => s.trim()).filter(Boolean);

  const cache = await openCache({ forceRefresh: options?.forceRefresh });
  const scope = getScope();

  try {
    step("Fetching teams…");
    const teams = await withTimeout(
      getTeamsCached(cache, scope, () => listTeams()),
      REQUEST_TIMEOUT_MS,
      "Fetching teams"
    );
    stepDone(`(${teams.length} teams)`);

    if (teams.length === 0) {
      console.log(chalk.yellow("No teams found. Check that LINEAR_API_KEY has access to at least one team (Linear → Settings → API)."));
      console.log();
      closeCache();
      return;
    }

    step("Fetching projects…");
    const allProjectsForLifecycle = await withTimeout(
      getProjectsCached(cache, scope, teamIds ?? undefined, () =>
        listProjects(teamIds?.length ? { teamIds } : {})
      ),
      REQUEST_TIMEOUT_MS,
      "Fetching projects"
    );
    stepDone(`(${allProjectsForLifecycle.length} projects)`);

    let projects = allProjectsForLifecycle.filter(
      (p) => !isTerminalProjectState(p.state)
    );
    projects = sortProjectsByState(projects);
    if (projects.length === 0 && allProjectsForLifecycle.length > 0) {
      projects = sortProjectsByState(allProjectsForLifecycle);
    }
    const projectIds = projects.map((p) => p.id);

    step(`Fetching issues for ${projectIds.length} project(s)…`);
    const issuesByProject = await withTimeout(
      getIssuesCached(cache, scope, projectIds, (opts) =>
        withTimeout(
          listIssuesByProject(opts),
          REQUEST_TIMEOUT_MS,
          `Fetching issues for project ${opts.projectId}`
        )
      ),
      Math.max(REQUEST_TIMEOUT_MS, projectIds.length * 2),
      "Fetching issues"
    );
    stepDone();

    step(`Fetching project history for ${projectIds.length} project(s)…`);
    const timelinesMap = await withTimeout(
      getProjectTimelinesCached(cache, scope, projectIds, async (pid) => {
        const proj = allProjectsForLifecycle.find((p) => p.id === pid)
          ?? projects.find((p) => p.id === pid)
          ?? { id: pid, name: pid, state: "", teamIds: [] };
        const [history, updates] = await Promise.all([
          fetchProjectHistory(pid),
          fetchProjectUpdates(pid),
        ]);
        return buildProjectDateTimeline(proj, history, updates);
      }),
      Math.max(REQUEST_TIMEOUT_MS * 2, projectIds.length * 5_000),
      "Fetching project history"
    );
    stepDone();

    const report = buildInsightsReport({
      teams,
      allProjects: allProjectsForLifecycle,
      issuesByProject,
      timelines: Array.from(timelinesMap.values()),
    });

    const reportJsonPath = getReportJsonPath();
    await writeReportJson(report, reportJsonPath);

    closeCache();
    await renderInsightsReport(report);
  } catch (err) {
    closeCache();
    if (err instanceof TimeoutError) {
      console.error(chalk.red("\nTimeout:"), err.message);
      console.error(chalk.dim(`  Step: ${err.label}  (limit: ${err.timeoutMs / 1000}s)`));
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("\nError:"), msg);
      if (err instanceof Error && err.stack) {
        console.error(chalk.dim(err.stack));
      }
      const lower = msg.toLowerCase();
      if (lower.includes("auth") || lower.includes("401") || lower.includes("forbidden") || lower.includes("invalid") || lower.includes("permission")) {
        console.error(chalk.yellow("\nTip: Check LINEAR_API_KEY (Linear → Settings → API). Ensure the key has read access."));
      }
    }
    process.exit(1);
  }
}
