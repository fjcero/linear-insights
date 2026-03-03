import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '1rem',
          fontWeight: 600,
          color: '#c4cde0',
          marginBottom: '0.75rem',
          marginTop: 0,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
