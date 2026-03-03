import type { ChartStats } from '#/lib/chartData'

interface StatProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

function Stat({ label, value, sub, color }: StatProps) {
  return (
    <div
      style={{
        background: '#0b0f1e',
        border: '1px solid #141c30',
        borderRadius: 8,
        padding: '14px 18px',
        minWidth: 120,
        flex: '1 1 120px',
      }}
    >
      <div
        style={{
          color: '#8fa1bf',
          fontSize: '0.5625rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: color ?? '#e2e8f0',
          fontSize: '1.375rem',
          fontWeight: 700,
          fontFamily: "'IBM Plex Sans', sans-serif",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub != null && (
        <div style={{ color: '#8fa1bf', fontSize: '0.5625rem', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}

interface StatsStripProps {
  stats: ChartStats
}

export function StatsStrip({ stats }: StatsStripProps) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
      <Stat label="Total closed" value={stats.totalClosed} sub="in report window" color="#4ade80" />
      <Stat label="Open" value={stats.openCount} sub="active projects" color="#60a5fa" />
      <Stat label="Overdue" value={stats.overdueCount} sub="past target" color="#ef4444" />
      <Stat
        label="Avg closed / month"
        value={stats.velocityPerMonth}
        sub="throughput"
        color="#a78bfa"
      />
      <Stat
        label="Avg lifetime"
        value={stats.avgLifetimeDays != null ? `${stats.avgLifetimeDays}d` : '—'}
        sub="closed projects"
        color="#f59e0b"
      />
    </div>
  )
}
