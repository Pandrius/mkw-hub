import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

/*
 * Gráficos sencillos sin librerías: una línea (con media de referencia), columnas divergentes
 * (+/-) e histograma. Marcas finas, rejilla tenue y un tooltip al pasar el ratón o tocar.
 */

const POS = 'var(--color-kart-green)'
const NEG = 'var(--color-kart-red)'
const SERIES = 'var(--color-kart-yellow)'

/** Ticks "redondos" entre min y max */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // Se acerca al borde contrario cuando el punto está a un lado, para no salirse del gráfico
  const style = x > 60 ? { right: `${100 - x}%` } : { left: `${x}%` }
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 -translate-y-1 border border-line bg-bg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
      style={style}
    >
      {children}
    </div>
  )
}

export type LinePoint = { value: number; tip: ReactNode }

/**
 * Línea de una serie con una referencia horizontal opcional (p. ej. la media de siempre).
 * `format` da formato a los ticks del eje.
 */
export function LineChart({
  points,
  reference,
  referenceLabel,
  format = (v) => String(v),
  height = 180,
  zeroLine = false,
  ariaLabel,
}: {
  points: LinePoint[]
  reference?: number
  referenceLabel?: string
  format?: (v: number) => string
  height?: number
  /** Dibuja la línea del 0 y colorea la zona positiva / negativa */
  zeroLine?: boolean
  ariaLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId()
  if (points.length < 2) return null

  const values = points.map((p) => p.value)
  const extra = [reference, zeroLine ? 0 : undefined].filter((v): v is number => v !== undefined)
  let min = Math.min(...values, ...extra)
  let max = Math.max(...values, ...extra)
  const pad = (max - min || 1) * 0.08
  min -= pad
  max += pad
  const ticks = niceTicks(min, max)
  min = Math.min(min, ticks[0])
  max = Math.max(max, ticks[ticks.length - 1])

  const W = 1000
  const H = 100
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(2)}`).join('')
  const yPct = (v: number) => ((max - v) / (max - min)) * 100

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = (clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))))
  }

  const hx = hover === null ? 0 : (hover / (points.length - 1)) * 100

  return (
    <figure className="m-0">
      <div className="relative flex gap-2">
        {/* Eje Y: ticks redondos */}
        <div className="relative w-9 shrink-0 font-mono text-[10px] text-muted" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: `${yPct(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div
          className="relative flex-1 touch-pan-y"
          style={{ height }}
          role="img"
          aria-label={ariaLabel}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {ticks.map((t) => (
              <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {zeroLine ? (
              <>
                <defs>
                  <clipPath id={`${clipId}-pos`}>
                    <rect x="0" y="0" width={W} height={y(0)} />
                  </clipPath>
                  <clipPath id={`${clipId}-neg`}>
                    <rect x="0" y={y(0)} width={W} height={H - y(0)} />
                  </clipPath>
                </defs>
                <path d={`${path}L${W},${y(0)}L0,${y(0)}Z`} fill={POS} opacity="0.12" clipPath={`url(#${clipId}-pos)`} />
                <path d={`${path}L${W},${y(0)}L0,${y(0)}Z`} fill={NEG} opacity="0.12" clipPath={`url(#${clipId}-neg)`} />
                <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
            {reference !== undefined && (
              <line x1="0" x2={W} y1={y(reference)} y2={y(reference)} stroke="var(--color-muted)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            )}
            <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--color-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {/* Punto final y punto activo en HTML para que no se deformen */}
          {[hover ?? points.length - 1].map((i) => (
            <span
              key="dot"
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
              style={{ left: `${(i / (points.length - 1)) * 100}%`, top: `${yPct(points[i].value)}%`, background: SERIES }}
            />
          ))}
          {reference !== undefined && referenceLabel && (
            <span
              className="pointer-events-none absolute right-0 -translate-y-full bg-surface px-1 font-mono text-[10px] text-muted"
              style={{ top: `${yPct(reference)}%` }}
            >
              {referenceLabel}
            </span>
          )}
          {hover !== null && <Tooltip x={hx}>{points[hover].tip}</Tooltip>}
        </div>
      </div>
    </figure>
  )
}

export type BarItem = { key: string; value: number; tip: ReactNode; href?: string }

/** Columnas divergentes desde el 0: verdes hacia arriba, rojas hacia abajo */
export function DiffBars({ items, height = 160, ariaLabel }: { items: BarItem[]; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!items.length) return null
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  const half = height / 2

  return (
    <figure className="relative m-0" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
      <div className="relative flex items-stretch gap-0.5" style={{ height }}>
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-muted" aria-hidden />
        {items.map((item, i) => {
          const h = Math.max(2, (Math.abs(item.value) / max) * (half - 4))
          const up = item.value >= 0
          const bar = (
            <span className="relative flex h-full w-full justify-center" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <span
                className="absolute w-full max-w-6"
                style={{
                  height: h,
                  background: up ? POS : NEG,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                  ...(up ? { bottom: half, borderRadius: '4px 4px 0 0' } : { top: half, borderRadius: '0 0 4px 4px' }),
                }}
              />
            </span>
          )
          return item.href ? (
            <Link key={item.key} to={item.href} className="flex min-w-0 flex-1" aria-label={String(item.value)}>
              {bar}
            </Link>
          ) : (
            <span key={item.key} className="flex min-w-0 flex-1">
              {bar}
            </span>
          )
        })}
      </div>
      {hover !== null && <Tooltip x={((hover + 0.5) / items.length) * 100}>{items[hover].tip}</Tooltip>}
    </figure>
  )
}

/** Histograma de posiciones 1.º-12.º (porcentaje de carreras en cada una) */
export function PositionHistogram({ counts, ariaLabel, label }: { counts: number[]; ariaLabel: string; label: (pos: number, n: number, pct: number) => ReactNode }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = counts.reduce((a, b) => a + b, 0) || 1
  const max = Math.max(...counts, 1)
  return (
    <figure className="relative m-0" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
      <div className="flex h-32 items-end gap-0.5 border-b border-line">
        {counts.map((n, i) => (
          <span key={i} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
            <span
              className="w-full max-w-6"
              style={{
                height: `${Math.max(n ? 3 : 0, (n / max) * 100)}%`,
                background: SERIES,
                borderRadius: '4px 4px 0 0',
                opacity: hover === null || hover === i ? 1 : 0.55,
              }}
            />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 font-mono text-[10px] text-muted" aria-hidden>
        {counts.map((_, i) => (
          <span key={i} className="flex-1 text-center tabular-nums">
            {i + 1}
          </span>
        ))}
      </div>
      {hover !== null && <Tooltip x={((hover + 0.5) / counts.length) * 100}>{label(hover + 1, counts[hover], Math.round((counts[hover] / total) * 100))}</Tooltip>}
    </figure>
  )
}
