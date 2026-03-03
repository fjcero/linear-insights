import { createHash } from "node:crypto";
import type { ReportCache } from "@linear-insights/cache";
import {
	closeReportCache,
	openReportCache,
	projectsCacheKey,
	type ReportCacheOptions,
} from "@linear-insights/cache";
import type {
	IssueSummary,
	ProjectSummary,
	ProjectDateTimeline,
	TeamInfo,
} from "@linear-insights/linear-client";
import {
	buildProjectDateTimeline,
	createLinearClient,
	fetchProjectHistory,
	fetchProjectUpdates,
	isActiveForReporting,
	isTerminalProjectState,
	listIssuesByProject,
	listProjects,
	listTeams,
} from "@linear-insights/linear-client";
import type { LinearClient } from "@linear/sdk";

const TEAMS_TTL = 365 * 24 * 60 * 60; // 1 year
const PROJECTS_TTL = 24 * 60 * 60; // 1 day
const ISSUES_TTL = 24 * 60 * 60; // 1 day
const HISTORY_TTL = 60 * 60; // 1h

/**
 * Derive a stable cache scope from a Linear user ID (preferred for OAuth)
 * or from an API key hash (fallback for CLI / API-key usage).
 */
export function cacheScopeFromUserId(userId: string): string {
	return userId;
}

export function cacheScopeFromApiKey(apiKey: string): string {
	return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

let cacheInstance: ReportCache | null = null;

/**
 * Open the report cache (SQLite). Call once before using get*Cached.
 */
export async function openCache(
	options?: ReportCacheOptions,
): Promise<ReportCache> {
	cacheInstance = await openReportCache(options ?? {});
	return cacheInstance;
}

/** Close the cache (e.g. on exit). */
export function closeCache(): void {
	closeReportCache();
	cacheInstance = null;
}

/**
 * Teams: cache-first, then listTeams(), then cache set.
 */
export async function getTeamsCached(
	cache: ReportCache,
	scope: string,
	listTeamsFn: () => Promise<TeamInfo[]>,
): Promise<TeamInfo[]> {
	const cached = await cache.getTeams<TeamInfo[]>(scope);
	if (cached != null) return cached;
	const data = await listTeamsFn();
	await cache.setTeams(scope, data, TEAMS_TTL);
	return data;
}

/**
 * Projects: cache-first by team scope key, then listProjects(), then cache set.
 */
export async function getProjectsCached(
	cache: ReportCache,
	scope: string,
	teamIds: string[] | undefined,
	listProjectsFn: () => Promise<ProjectSummary[]>,
): Promise<ProjectSummary[]> {
	const key = projectsCacheKey(teamIds);
	const cached = await cache.getProjects<ProjectSummary[]>(scope, key);
	if (cached != null) return cached;
	const data = await listProjectsFn();
	await cache.setProjects(scope, key, data, PROJECTS_TTL);
	return data;
}

/**
 * Issues: cache-first per project, then listIssuesByProject(), then cache set.
 * Returns Map<projectId, IssueSummary[]>.
 */
export async function getIssuesCached(
	cache: ReportCache,
	scope: string,
	projectIds: string[],
	listIssuesByProjectFn: (opts: {
		projectId: string;
	}) => Promise<IssueSummary[]>,
): Promise<Map<string, IssueSummary[]>> {
	const out = new Map<string, IssueSummary[]>();
	const toFetch: string[] = [];

	for (const id of projectIds) {
		const cached = await cache.getIssues<IssueSummary[]>(scope, id);
		if (cached != null) out.set(id, cached);
		else toFetch.push(id);
	}

	for (const projectId of toFetch) {
		const issues = await listIssuesByProjectFn({ projectId });
		out.set(projectId, issues);
		await cache.setIssues(scope, projectId, issues, ISSUES_TTL);
	}

	return out;
}

/**
 * Project date timelines: cache-first per project, then fetch from API.
 * Returns Map<projectId, ProjectDateTimeline>.
 */
export async function getProjectTimelinesCached(
	cache: ReportCache,
	scope: string,
	projectIds: string[],
	fetchTimelineFn: (projectId: string) => Promise<ProjectDateTimeline>,
): Promise<Map<string, ProjectDateTimeline>> {
	const out = new Map<string, ProjectDateTimeline>();
	const toFetch: string[] = [];

	for (const id of projectIds) {
		const cached = await cache.getHistory<ProjectDateTimeline>(scope, id);
		if (cached != null) out.set(id, cached);
		else toFetch.push(id);
	}

	for (const projectId of toFetch) {
		const timeline = await fetchTimelineFn(projectId);
		out.set(projectId, timeline);
		await cache.setHistory(scope, projectId, timeline, HISTORY_TTL);
	}

	return out;
}

export interface SyncLinearDataOptions {
	/** Scope to specific team IDs; derived from LINEAR_TEAM_IDS if not set. */
	teamIds?: string[];
	/** Bypass cache and fetch fresh data, then write back to cache. */
	forceRefresh?: boolean;
	/**
	 * OAuth access token or API key.
	 * Defaults to LINEAR_API_KEY env var if not provided (CLI / local usage).
	 */
	token?: string;
	/**
	 * Linear user ID to use as the cache scope.
	 * When provided (OAuth flow), the user ID is used directly.
	 * Otherwise, the scope is derived from a hash of the token.
	 */
	userId?: string;
}

/**
 * Fetch from Linear and fill the cache (teams, projects, issues, project timelines).
 * Both CLI and app server can call this. No report computation—only populating the cache.
 */
export async function syncLinearData(options?: SyncLinearDataOptions): Promise<void> {
	const token = options?.token ?? process.env.LINEAR_API_KEY ?? "";
	const scope = options?.userId
		? cacheScopeFromUserId(options.userId)
		: cacheScopeFromApiKey(token);

	const teamIds =
		options?.teamIds ??
		process.env.LINEAR_TEAM_IDS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

	const client: LinearClient = createLinearClient(token);
	const cache = await openCache({ forceRefresh: options?.forceRefresh ?? false });

	try {
		const teams = await getTeamsCached(cache, scope, () => listTeams(client));
		if (teams.length === 0) {
			return;
		}

		const allProjects = await getProjectsCached(
			cache,
			scope,
			teamIds?.length ? teamIds : undefined,
			() => listProjects(client, teamIds?.length ? { teamIds } : {}),
		);

		const activeProjects = allProjects.filter(
			(p) => isActiveForReporting(p) && !isTerminalProjectState(p.state),
		);
		const projectIds =
			activeProjects.length > 0
				? activeProjects.map((p) => p.id)
				: allProjects.map((p) => p.id);

		await getIssuesCached(cache, scope, projectIds, (opts) =>
			listIssuesByProject(client, opts),
		);

		await getProjectTimelinesCached(cache, scope, projectIds, async (pid) => {
			const proj =
				allProjects.find((p) => p.id === pid) ?? {
					id: pid,
					name: pid,
					state: "",
					teamIds: [],
				};
			const [history, updates] = await Promise.all([
				fetchProjectHistory(client, pid),
				fetchProjectUpdates(client, pid),
			]);
			return buildProjectDateTimeline(proj, history, updates);
		});
	} finally {
		closeCache();
	}
}

/**
 * Get the cache scope for the current environment (from LINEAR_API_KEY).
 * Used by CLI and report-api when running without OAuth.
 * @deprecated Prefer passing userId or token explicitly via SyncLinearDataOptions.
 */
export function getScope(): string {
	return cacheScopeFromApiKey(process.env.LINEAR_API_KEY ?? "");
}

export type { ReportCache, ReportCacheOptions } from "@linear-insights/cache";
export {
	closeReportCache,
	openReportCache,
	projectsCacheKey,
} from "@linear-insights/cache";
