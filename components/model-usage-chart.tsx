'use client'

import { useMemo } from 'react'
import type { CSSProperties } from 'react'

type ModelUsageChartProps = {
  modelCounts: Record<string, number>
}

const PALETTE = ['#10a37f', '#7c8cff', '#f59e0b', '#ff6b8b', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24']

function shortName(id: string) {
  const parts = id.split('/')
  return parts[parts.length - 1] ?? id
}

export function ModelUsageChart({ modelCounts }: ModelUsageChartProps) {
  const entries = useMemo(
    () =>
      Object.entries(modelCounts)
        .map(([model, count]) => ({ model, count: Number(count) || 0 }))
        .filter((entry) => entry.count > 0)
        .sort((left, right) => right.count - left.count),
    [modelCounts],
  )

  const max = entries.reduce((acc, entry) => Math.max(acc, entry.count), 0) || 1
  const total = entries.reduce((acc, entry) => acc + entry.count, 0)

  if (entries.length === 0) {
    return (
      <section className="panel admin-panel">
        <div>
          <div className="section-title">Model usage</div>
        </div>
        <span className="pill">No model data yet</span>
      </section>
    )
  }

  return (
    <section className="panel admin-panel">
      <div>
        <div className="section-title">Model usage</div>
      </div>
      <div className="chart3d">
        <div className="chart3d-bars">
          {entries.map((entry, index) => {
            const heightPct = Math.round((entry.count / max) * 84) + 12
            const share = total > 0 ? Math.round((entry.count / total) * 100) : 0
            const style = {
              '--h': `${heightPct}%`,
              '--c': PALETTE[index % PALETTE.length],
              '--delay': `${index * 110}ms`,
            } as CSSProperties
            return (
              <div key={entry.model} className="chart3d-slot" style={style}>
                <div className="chart3d-value">{entry.count}</div>
                <div
                  className="chart3d-bar"
                  tabIndex={0}
                  data-tip={`${entry.model} · ${entry.count} call${entry.count === 1 ? '' : 's'} · ${share}%`}
                >
                  <span className="chart3d-cap" />
                  <span className="chart3d-side" />
                  <span className="chart3d-front" />
                </div>
                <div className="chart3d-label" title={entry.model}>
                  {shortName(entry.model)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="chart3d-axis">
          <span>
            {total} total call{total === 1 ? '' : 's'} · {entries.length} model{entries.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </section>
  )
}
