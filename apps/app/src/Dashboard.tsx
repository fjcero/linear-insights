import type { InsightsReportData } from '@linear-insights/report-types'
import type { DateRange, TeamFilter } from '#/utils/types'
import { buildChartDataFromReport } from '#/lib/chartData'
import { Section } from '#/components/Section'
import { StaleIssuesTable } from '#/components/StaleIssuesTable'
import { StatsStrip } from '#/components/StatsStrip'
import { ThroughputCharts } from '#/components/ThroughputCharts'
import { CompletedProjectsBlock } from '#/components/CompletedProjectsBlock'
import { ProjectGrid } from '#/components/ProjectGrid'
import { VelocitySection } from '#/components/VelocitySection'

interface DashboardProps {
  report: InsightsReportData
  onReset: () => void
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  selectedTeam: TeamFilter
  onTeamChange: (teamId: TeamFilter) => void
  loading?: boolean
  user?: { name: string; email: string } | null
  onLogout?: () => void
}

export function Dashboard({
  report,
  onReset,
  dateRange,
  onDateRangeChange,
  selectedTeam,
  onTeamChange,
  loading,
  user,
  onLogout,
}: DashboardProps) {
  const {
    teams,
    showAllProjectsMessage,
    unified,
    lifecycle,
    staleIssues,
    velocity,
  } = report

  const { moData, woData, stats } = buildChartDataFromReport(report)
  const openProjects = unified.filter((r) => r.State !== 'Completed')
  const completedProjects = unified.filter((r) => r.State === 'Completed')
  const updatesByProject = Object.fromEntries(
    (report.projectUpdates ?? []).flatMap((p) => [
      [p.ProjectId, p.updates] as const,
      [p.Project, p.updates] as const,
    ])
  )

  return (
    <div
      style={{
        background: '#050810',
        minHeight: '100vh',
        padding: '36px 28px 48px',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#e2e8f0',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 30,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              color: '#2d4baa',
              fontSize: '0.625rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Linear Insights
          </div>
          <h1
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.03em',
              margin: '0 0 4px',
            }}
          >
            Project throughput dashboard
          </h1>
          <div style={{ color: '#9fb0cd', fontSize: '0.6875rem' }}>{unified.length} projects</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ color: '#9fb0cd', fontSize: '0.6875rem' }}>
            Team
            <select
              value={selectedTeam}
              onChange={(e) => onTeamChange(e.target.value)}
              style={{
                marginLeft: 8,
                background: '#0f172a',
                border: '1px solid #1e293b',
                color: '#e2e8f0',
                padding: '6px 8px',
                borderRadius: 4,
                fontFamily: 'inherit',
              }}
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t.ID} value={t.ID}>
                  {t.Key} · {t.Name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onReset}
            style={{
              background: 'transparent',
              border: '1px solid #1a2540',
              color: '#3d4f70',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.5625rem',
              letterSpacing: '0.08em',
            }}
          >
            Load another report
          </button>
          {user && onLogout && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  color: '#9fb0cd',
                  fontSize: '0.6875rem',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={user.email}
              >
                {user.name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid #1a2540',
                  color: '#3d4f70',
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.5625rem',
                  letterSpacing: '0.08em',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {showAllProjectsMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#422006',
            color: '#fcd34d',
            borderRadius: 8,
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          {showAllProjectsMessage}
        </div>
      )}

      {/* Stats + Throughput charts (WoW / MoM) */}
      {(moData.length > 0 || (woData?.length ?? 0) > 0) && (
        <>
          <StatsStrip stats={stats} />
          <Section title="Throughput (opened vs closed, backlog, trend)">
            <ThroughputCharts
              moData={moData}
              woData={woData}
              stats={stats}
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              loading={loading}
            />
          </Section>
        </>
      )}

      {/* Trend summary from CLI */}
      <Section title="Velocity trend">
        <VelocitySection velocity={velocity} />
      </Section>

      {/* Project grid (derived from unified): Now / Next / Later */}
      <ProjectGrid
        rows={openProjects}
        trendPerMonth={stats.velocityPerMonth}
        updatesByProject={updatesByProject}
      />

      {/* Completed projects grouped by completion month */}
      <CompletedProjectsBlock
        rows={completedProjects}
        avgLifetimeDays={lifecycle.averageLifetimeDays}
      />

      {staleIssues.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <Section title="Stale issues (created 6+ weeks ago, no update in 6+ weeks)">
            <StaleIssuesTable data={staleIssues} />
          </Section>
        </div>
      )}
    </div>
  )
}
