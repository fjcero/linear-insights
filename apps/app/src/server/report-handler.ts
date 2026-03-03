/** Report handler — TanStack Start server routes. Node/Bun safe. */
import {
  openCache,
  cacheScopeFromUserId,
  cacheScopeFromApiKey,
  projectsCacheKey,
  getProjectTimelinesCached,
  syncLinearData,
} from '@linear-insights/report-data'
import { buildInsightsReport } from '@linear-insights/report-build'
import {
  createLinearClient,
  fetchProjectHistory,
  fetchProjectUpdates,
  buildProjectDateTimeline,
} from '@linear-insights/linear-client'
import type {
  TeamInfo,
  ProjectSummary,
  IssueSummary,
  ProjectDateTimeline,
} from '@linear-insights/linear-client'
import { getSession } from '#/server/auth'

const CORS_ORIGIN = process.env.LINEAR_INSIGHTS_CORS_ORIGIN ?? '*'

interface AuthContext {
  token: string
  scope: string
  userId?: string
}

function getAuthContext(req: Request): AuthContext | null {
  const session = getSession(req)
  if (session) {
    return {
      token: session.accessToken,
      scope: cacheScopeFromUserId(session.userId),
      userId: session.userId,
    }
  }
  const envKey = process.env.LINEAR_API_KEY
  if (envKey?.trim()) {
    return {
      token: envKey.trim(),
      scope: cacheScopeFromApiKey(envKey.trim()),
    }
  }
  return null
}

const TEAM_IDS = process.env.LINEAR_TEAM_IDS
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const PROJECTS_KEY = projectsCacheKey(TEAM_IDS?.length ? TEAM_IDS : undefined)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
    },
  })
}

async function handleReport(req: Request, url: URL): Promise<Response> {
  const auth = getAuthContext(req)
  if (!auth) {
    return json({ error: 'Unauthenticated. Log in via /auth/login.' }, 401)
  }

  const { token, scope } = auth
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined
  const teamParam = url.searchParams.get('team') ?? 'all'
  const dateRange =
    from && to ? ({ from, to } as { from: string; to: string }) : undefined

  const client = createLinearClient(token)

  async function readFromCache(): Promise<
    | {
        ok: true
        teams: TeamInfo[]
        projects: ProjectSummary[]
        issuesByProject: Map<string, IssueSummary[]>
        timelines: ProjectDateTimeline[]
      }
    | { ok: false; response: Response }
  > {
    const cache = await openCache({ forceRefresh: false })
    const teams = await cache.getTeams<TeamInfo[]>(scope)
    if (!teams || teams.length === 0) {
      return {
        ok: false,
        response: json(
          { error: 'Cache empty. Please wait while data syncs, or try again shortly.' },
          503
        ),
      }
    }

    const allProjects = await cache.getProjects<ProjectSummary[]>(scope, PROJECTS_KEY)
    if (!allProjects || allProjects.length === 0) {
      return {
        ok: false,
        response: json(
          { error: 'Cache empty. Please wait while data syncs, or try again shortly.' },
          503
        ),
      }
    }

    let projects = allProjects
    if (teamParam && teamParam !== 'all') {
      const lower = teamParam.toLowerCase()
      const resolvedTeamId = teams.find(
        (t) => t.id.toLowerCase() === lower || t.key.toLowerCase() === lower
      )?.id
      if (!resolvedTeamId) {
        return { ok: false, response: json({ error: `Unknown team filter: ${teamParam}` }, 400) }
      }
      projects = allProjects.filter((p) => p.teamIds.includes(resolvedTeamId))
    }

    const issuesByProject = new Map<string, IssueSummary[]>()
    for (const p of projects) {
      const issues = await cache.getIssues<IssueSummary[]>(scope, p.id)
      issuesByProject.set(p.id, issues ?? [])
    }

    const timelines: ProjectDateTimeline[] = []
    for (const p of projects) {
      const t = await cache.getHistory<ProjectDateTimeline>(scope, p.id)
      if (t) timelines.push(t)
    }

    return { ok: true, teams, projects, issuesByProject, timelines }
  }

  async function triggerUserSync(userId: string | undefined): Promise<void> {
    await syncLinearData({ token, userId, forceRefresh: false, closeAfterSync: false })
  }

  let snapshot = await readFromCache()

  if (!snapshot.ok) {
    console.log(`Cache empty for scope ${scope} — syncing…`)
    await triggerUserSync(auth.userId)
    snapshot = await readFromCache()
    if (!snapshot.ok) return snapshot.response
  }

  if (snapshot.projects.length > 0 && snapshot.timelines.length === 0) {
    console.log('No project timelines in cache — backfilling…')
    const cache = await openCache({ forceRefresh: false })
    await getProjectTimelinesCached(cache, scope, snapshot.projects.map((p) => p.id), async (pid) => {
      const proj =
        snapshot.ok ? snapshot.projects.find((p) => p.id === pid) ?? { id: pid, name: pid, state: '', teamIds: [] }
                   : { id: pid, name: pid, state: '', teamIds: [] }
      const [history, updates] = await Promise.all([
        fetchProjectHistory(client, pid),
        fetchProjectUpdates(client, pid),
      ])
      return buildProjectDateTimeline(proj, history, updates)
    })
    snapshot = await readFromCache()
    if (!snapshot.ok) return snapshot.response
  }

  const report = buildInsightsReport(
    {
      teams: snapshot.teams,
      allProjects: snapshot.projects,
      issuesByProject: snapshot.issuesByProject,
      timelines: snapshot.timelines,
    },
    dateRange
  )
  return json(report)
}

export async function handleReportRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const auth = getAuthContext(req)
  if (!auth) {
    return json({ error: 'Unauthenticated. Log in via /auth/login.' }, 401)
  }
  try {
    return await handleReport(req, url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Report error:', err)
    return json({ error: 'Report generation failed', details: msg }, 500)
  }
}
