import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { getTrack, getTrackColor, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { Record3 } from '../lib/statMath'
import { positionColor, useNum } from './statFormat'
import { Plate } from './ui'

/** Valor con signo, verde si es positivo y rojo si es negativo */
export function Signed({ value, digits = 1, suffix = '', className = '' }: { value: number; digits?: number; suffix?: string; className?: string }) {
  const num = useNum()
  const color = value > 0 ? 'text-kart-green' : value < 0 ? 'text-kart-red' : 'text-muted'
  return (
    <span className={`tabular-nums ${color} ${className}`}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {num(Math.abs(value), digits)}
      {suffix}
    </span>
  )
}

/** Cifra destacada con su etiqueta, una línea de contexto y una explicación al pasar el ratón */
export function StatTile({ label, value, sub, hint, accent }: { label: string; value: ReactNode; sub?: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="panel p-4" title={hint}>
      <p className="text-xs text-muted sm:text-sm">
        {label}
        {hint && (
          <span aria-hidden className="ml-1 cursor-help text-[10px]">
            ⓘ
          </span>
        )}
      </p>
      <p className={`mt-1 font-display text-3xl leading-none font-extrabold sm:text-4xl ${accent ? 'text-kart-yellow' : ''}`}>{value}</p>
      {sub && <p className="mt-1.5 font-mono text-xs text-muted">{sub}</p>}
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  )
}

/** Título de bloque con una línea opcional que explica cómo se calcula */
export function SectionTitle({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-display text-xl font-bold">{title}</h3>
        {hint && <p className="max-w-2xl text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/** Balance V-D-E */
export function RecordText({ record }: { record: Record3 }) {
  const { t } = useI18n()
  return <>{t('an.record', { w: record.w, l: record.l, t: record.t })}</>
}

/** Placa y nombre de una pista, con enlace */
export function TrackName({ trackId, short = false }: { trackId: string; short?: boolean }) {
  const track = getTrack(trackId)
  return (
    <Link to={`/pistas/${trackId}`} className="flex min-w-0 items-center gap-2 hover:text-kart-yellow">
      <Plate color={getTrackColor(track)} textColor={getTrackTextColor(track)}>
        {track?.abbr ?? trackId}
      </Plate>
      {!short && <span className="truncate font-semibold">{track?.name ?? trackId}</span>}
    </Link>
  )
}

/** Cabecera de columna con explicación al pasar el ratón */
export function Th({ children, hint, right = true }: { children: ReactNode; hint?: string; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-extrabold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`} title={hint}>
      {children}
      {hint && (
        <span aria-hidden className="ml-0.5 cursor-help text-[10px] text-muted">
          ⓘ
        </span>
      )}
    </th>
  )
}

/** Posición en un cuadradito de color */
export function PositionChip({ position }: { position: number }) {
  return (
    <span
      className="time grid size-6 place-items-center text-xs font-bold"
      style={{ background: positionColor(position), color: position <= 6 ? 'var(--color-bg)' : 'var(--color-ink)' }}
    >
      {position}
    </span>
  )
}
