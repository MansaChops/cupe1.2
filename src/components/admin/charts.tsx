import { useState } from 'react'
import { formatMoney } from '@/config/site'

type Point = { date: string; revenue: number; orders: number }

/** Lightweight SVG area chart — no chart library, keeps the admin bundle small. */
export function SalesChart({ data, label = 'Daily order value' }: { data: Array<Point>; label?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 200
  const pad = { t: 12, r: 8, b: 22, l: 40 }
  if (data.length < 2) return <p className="px-2 py-10 text-center text-sm text-ink-3">Not enough days to chart yet.</p>
  const max = Math.max(100, Math.ceil(Math.max(...data.map((d) => d.revenue)) / 100) * 100)
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r)
  const last = data.length - 1
  const tickIdx = [...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last])]
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join('')
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const ticks = [0, max / 2, max]
  const h = hover !== null ? data[hover] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1)))))
        }}
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-verdigris)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--color-verdigris)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t ? '2 4' : undefined} />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" className="fill-ink-3 font-mono" fontSize="10">£{Math.round(t)}</text>
          </g>
        ))}
        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="fill-ink-3 font-mono" fontSize="10">
            {new Date(data[i].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </text>
        ))}
        <path d={area} fill="url(#fill)" />
        <path d={line} fill="none" stroke="var(--color-verdigris)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="var(--color-ink-3)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(data[hover].revenue)} r="4" fill="var(--color-card)" stroke="var(--color-verdigris)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm"
          style={{ left: `${(x(hover!) / W) * 100}%`, transform: `translateX(${hover! > data.length / 2 ? '-110%' : '10%'})` }}
        >
          <p className="text-ink-3">{new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="font-medium">{formatMoney(h.revenue)}</p>
          <p className="text-ink-3">{h.orders} {h.orders === 1 ? 'order' : 'orders'}</p>
        </div>
      )}
    </div>
  )
}

export function BarList({ rows, format }: { rows: Array<{ label: string; sub?: string; value: number }>; format: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  if (!rows.length) return <p className="text-sm text-ink-3">Nothing sold in this period yet.</p>
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={`${r.label} ${r.sub ?? ''}`}>
          <div className="flex justify-between text-sm mb-1.5">
            <span>
              {r.label} {r.sub && <span className="text-ink-3">{r.sub}</span>}
            </span>
            <span className="font-mono text-xs text-ink-2">{format(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-paper-2 overflow-hidden">
            <div className="h-full rounded-full bg-verdigris origin-left" style={{ transform: `scaleX(${r.value / max})` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
