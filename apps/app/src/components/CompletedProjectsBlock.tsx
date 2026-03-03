interface UnifiedRow {
  Project: string
  State: string
  Created: string
  Closed?: string
  'Closed month'?: string
  'Lifetime (days)': string
  'Last activity': string
}

interface CompletedProjectsBlockProps {
  rows: UnifiedRow[]
  avgLifetimeDays: number | null
}

function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  const year = Number(m[1])
  const monthIndex = Number(m[2]) - 1
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month
  }
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${names[monthIndex]} ${year}`
}

export function CompletedProjectsBlock({
  rows,
  avgLifetimeDays,
}: CompletedProjectsBlockProps) {
  if (rows.length === 0) return null

  const byMonth = new Map<string, UnifiedRow[]>()
  for (const r of rows) {
    const month =
      r['Closed month'] && r['Closed month'] !== '—' ? r['Closed month'] : 'Date unavailable'
    const list = byMonth.get(month) ?? []
    list.push(r)
    byMonth.set(month, list)
  }
  const months = Array.from(byMonth.keys()).sort((a, b) => {
    if (a === 'Date unavailable') return 1
    if (b === 'Date unavailable') return -1
    return b.localeCompare(a)
  })
  const hasEstimatedCloseDate = rows.some(
    (r) => (r.Closed ?? '—') === '—' && r['Last activity'] && r['Last activity'] !== '—'
  )

  return (
    <div className="completed-block" style={{ marginTop: 36 }}>
      <h2
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#c4cde0',
          letterSpacing: '-0.01em',
          marginBottom: 14,
          marginTop: 0,
        }}
      >
        Completed{' '}
        <span style={{ color: '#8fa1bf', fontWeight: 400, fontSize: '1rem' }}>
          · {rows.length}
        </span>
      </h2>
      {months.map((month, monthIdx) => {
        const monthRows = byMonth.get(month) ?? []
        return (
          <div key={month}>
            <div
              style={{
                color: '#93a4c4',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: monthIdx === 0 ? 0 : 16,
                marginBottom: 6,
              }}
            >
              {month === 'Date unavailable' ? 'Completion date unavailable' : formatMonthLabel(month)}
            </div>
            <div
              className="dashboard-row header"
              style={{
                color: '#8fa1bf',
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                paddingBottom: 6,
              }}
            >
              <span>Project</span>
              <span>Closed</span>
              <span>Lifetime (days)</span>
              <span>vs avg</span>
            </div>
            <div className="dashboard-hr" />
            {monthRows.map((r, i) => {
              const lifetime =
                r['Lifetime (days)'] === '—' ? null : parseInt(r['Lifetime (days)'], 10)
              const vsAvg =
                avgLifetimeDays != null && lifetime != null && !Number.isNaN(lifetime)
                  ? lifetime - avgLifetimeDays
                  : null
              return (
                <div key={`${month}-${r.Project}-${r.Closed ?? r.Created}`}>
                  <div className="dashboard-row">
                    <div
                      style={{
                        fontSize: '0.9rem',
                        color: '#c4cde0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: '#4ade80', fontSize: '0.825rem' }}>✓</span>
                      {r.Project}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#9fb0cd' }}>
                      {(r.Closed ?? '—') !== '—'
                        ? r.Closed
                        : r['Last activity'] && r['Last activity'] !== '—'
                          ? `${r['Last activity']}*`
                          : '—'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                      {r['Lifetime (days)']}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: vsAvg != null ? (vsAvg <= 0 ? '#4ade80' : '#f97316') : '#2d3a55',
                      }}
                    >
                      {vsAvg != null ? (vsAvg <= 0 ? `−${Math.abs(vsAvg)}d` : `+${vsAvg}d`) : '—'}
                    </span>
                  </div>
                  {i < monthRows.length - 1 && <div className="dashboard-hr" />}
                </div>
              )
            })}
          </div>
        )
      })}
      {hasEstimatedCloseDate && (
        <div style={{ color: '#9fb0cd', fontSize: '0.75rem', marginTop: 8 }}>
          * Estimated from last activity when close date is missing in Linear.
        </div>
      )}
    </div>
  )
}
