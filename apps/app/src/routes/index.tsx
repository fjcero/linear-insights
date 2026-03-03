import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { InsightsReportData } from '@linear-insights/report-types'
import type { DateRange, TeamFilter } from '#/utils/types'
import { Dashboard } from '#/Dashboard'
import { Loader } from '#/components/Loader'
import { LoginPage } from '#/components/LoginPage'

export const Route = createFileRoute('/')({
  component: Home,
})

function parseReport(json: string): InsightsReportData | null {
  try {
    const data = JSON.parse(json) as InsightsReportData
    if (!data.teams || !data.unified || !data.velocity) return null
    return data
  } catch {
    return null
  }
}

function reportUrl(range: DateRange, team: TeamFilter): string {
  const params = new URLSearchParams()
  if (range?.from && range?.to) {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  if (team !== 'all') params.set('team', team)
  const qs = params.toString()
  return qs ? `/report?${qs}` : '/report'
}

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

function Home() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [report, setReport] = useState<InsightsReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [selectedTeam, setSelectedTeam] = useState<TeamFilter>('all')
  const [reportSource, setReportSource] = useState<'api' | 'file' | null>(null)

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { name: string; email: string }
          setUser(data)
          setAuthState('authenticated')
        } else {
          setAuthState('unauthenticated')
        }
      })
      .catch(() => setAuthState('unauthenticated'))
  }, [])

  const handleLogout = useCallback(async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    setAuthState('unauthenticated')
    setUser(null)
    setReport(null)
    setReportSource(null)
    setDateRange(null)
    setSelectedTeam('all')
  }, [])

  const loadFromApi = useCallback(async (range: DateRange, team: TeamFilter) => {
    const url = reportUrl(range, team)
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      if (res.status === 401) {
        setAuthState('unauthenticated')
        throw new Error('Session expired. Please sign in again.')
      }
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string })?.error ?? 'Cache empty — syncing, please wait.')
      }
      throw new Error(`Report failed: ${res.status}`)
    }
    const data = parseReport(await res.text())
    if (data) return data
    throw new Error('Invalid report from server')
  }, [])

  useEffect(() => {
    if (authState !== 'authenticated') return

    const RETRY_DELAY_MS = 1500
    const MAX_RETRIES = 40
    type LoadResult = { data: InsightsReportData; source: 'api' | 'file' } | null

    setLoading(true)
    async function loadReport(): Promise<LoadResult> {
      let lastApiError: Error | null = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const data = await loadFromApi(null, 'all')
          if (data) return { data, source: 'api' }
        } catch (err) {
          if (err instanceof Error && err.message.includes('Session expired')) return null
          lastApiError = err instanceof Error ? err : new Error('Failed to load report API')
          if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        }
      }
      try {
        const res = await fetch('/report.json')
        if (res.ok) {
          const data = parseReport(await res.text())
          if (data) return { data, source: 'file' }
        }
      } catch {
        /* ignore */
      }
      if (lastApiError) setError(lastApiError.message)
      else setError('Report not available from API or static report.json')
      return null
    }

    loadReport()
      .then((result) => {
        if (result) {
          setReport(result.data)
          setReportSource(result.source)
          setError(null)
        }
      })
      .finally(() => setLoading(false))
  }, [authState, loadFromApi])

  const onDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range)
      if (reportSource !== 'api') return
      setLoading(true)
      loadFromApi(range, selectedTeam)
        .then(setReport)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Failed to load report')
        )
        .finally(() => setLoading(false))
    },
    [loadFromApi, reportSource, selectedTeam]
  )

  const onTeamChange = useCallback(
    (teamId: TeamFilter) => {
      setSelectedTeam(teamId)
      if (reportSource !== 'api') return
      setLoading(true)
      loadFromApi(dateRange, teamId)
        .then(setReport)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Failed to load report')
        )
        .finally(() => setLoading(false))
    },
    [dateRange, loadFromApi, reportSource]
  )

  const loadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = parseReport(reader.result as string)
      if (data) {
        setReport(data)
        setReportSource('file')
      } else {
        setError('Invalid report: missing teams, unified, or velocity, or invalid JSON.')
      }
    }
    reader.readAsText(file)
  }, [])

  if (authState === 'loading') {
    return <Loader onFileSelect={() => {}} error={null} loading />
  }
  if (authState === 'unauthenticated') {
    return <LoginPage />
  }
  if (report) {
    return (
      <Dashboard
        report={report}
        onReset={() => {
          setReport(null)
          setReportSource(null)
          setDateRange(null)
          setSelectedTeam('all')
        }}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        selectedTeam={selectedTeam}
        onTeamChange={onTeamChange}
        loading={loading}
        user={user}
        onLogout={handleLogout}
      />
    )
  }
  return <Loader onFileSelect={loadFile} error={error} loading={loading} />
}
