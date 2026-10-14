import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { Glyph } from '../lib/achievements'
import type { Progress, Tier } from '../lib/badges'
import { TIER_COLOR, tierLabel } from './tiers'

/** Dibujos de las medallas en una cuadrícula de 24 × 24: formas planas, sin degradados */
const GLYPHS: Record<Glyph, ReactNode> = {
  podium: (
    <>
      <rect x="2" y="11" width="6" height="11" />
      <rect x="9" y="4" width="6" height="18" />
      <rect x="16" y="14" width="6" height="8" />
    </>
  ),
  flag: (
    <>
      {[0, 1, 2, 3].flatMap((x) =>
        [0, 1, 2].map((y) => ((x + y) % 2 === 0 ? <rect key={`${x}-${y}`} x={3 + x * 4.5} y={5 + y * 4.5} width="4.5" height="4.5" /> : null)),
      )}
      <rect x="2" y="3" width="1.6" height="19" />
    </>
  ),
  chevrons: (
    <>
      <polygon points="2,4 9,12 2,20 2,15 5,12 2,9" />
      <polygon points="9,4 16,12 9,20 9,15 12,12 9,9" />
      <polygon points="16,4 23,12 16,20 16,15 19,12 16,9" />
    </>
  ),
  bars: (
    <>
      <rect x="2" y="15" width="4" height="7" />
      <rect x="7.5" y="11" width="4" height="11" />
      <rect x="13" y="7" width="4" height="15" />
      <rect x="18.5" y="3" width="3.5" height="19" />
    </>
  ),
  ring: (
    <>
      <path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12a6 6 0 0 1 0-12z" fillRule="evenodd" />
      <rect x="9.5" y="9.5" width="5" height="5" />
    </>
  ),
  bolt: <polygon points="14,2 4,14 11,14 9,22 20,9 13,9" />,
  star: <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" />,
}

/**
 * Medalla: escudo plano del color del nivel con el dibujo dentro. Sin conseguir, solo el contorno apagado.
 * El nivel se marca además con tantos cuadraditos como niveles alcanzados.
 */
export function MedalIcon({ glyph, tier, size = 64 }: { glyph: Glyph; tier: Tier; size?: number }) {
  const earned = tier > 0
  // Sin conseguir: contorno discontinuo y dibujo apagados, pero legibles
  const color = earned ? TIER_COLOR[tier] : '#5d5b55'
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" className="block">
        <polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill={earned ? color : 'none'} stroke={color} strokeWidth={earned ? 0 : 2.5} strokeDasharray={earned ? undefined : '4 3'} />
        <svg x="14" y="10" width="28" height="28" viewBox="0 0 24 24" fill={earned ? 'var(--color-bg)' : color}>
          {GLYPHS[glyph]}
        </svg>
      </svg>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="size-1.5" style={{ background: i <= tier ? TIER_COLOR[tier] : 'var(--color-line)' }} />
        ))}
      </span>
    </div>
  )
}

/** Tarjeta de una insignia o un logro: medalla, nombre, descripción, progreso y lo que falta */
export function MedalCard({
  glyph,
  name,
  description,
  progress,
  thresholds,
  suffix,
}: {
  glyph: Glyph
  name: string
  description: string
  progress: Progress
  /** Cantidades de cada nivel, para mostrarlas al pasar el ratón */
  thresholds: number[]
  suffix?: string
}) {
  const { t } = useI18n()
  const { count, tier, next } = progress
  const previous = tier > 0 ? thresholds[tier - 1] : 0
  const pct = next ? Math.max(0, Math.min(100, Math.round(((count - previous) / (next - previous)) * 100))) : 100
  const accent = TIER_COLOR[tier]
  const nextColor = TIER_COLOR[Math.min(4, tier + 1) as Tier]
  const tooltip = thresholds.map((n, i) => `${t(tierLabel((i + 1) as Tier))}: ${n}`).join('  ·  ')

  return (
    <div
      className="panel relative flex gap-4 overflow-hidden p-4"
      style={tier === 4 ? { borderColor: accent } : undefined}
      title={tooltip}
    >
      {tier === 4 && <div className="hazard absolute inset-x-0 top-0 h-1" />}
      <MedalIcon glyph={glyph} tier={tier} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-xl leading-[1.05] font-black">{name}</h4>
          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold uppercase" style={{ color: tier ? accent : 'var(--color-muted)' }}>
            {tier ? t(tierLabel(tier)) : t('badge.locked')}
          </span>
        </div>
        <p className="mt-1 text-xs leading-snug text-muted">{description}</p>
        <div className="mt-2.5 h-1.5 bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={name}>
          <div className="h-full" style={{ width: `${pct}%`, background: nextColor }} />
        </div>
        <p className="mt-1 flex justify-between font-mono text-[11px] text-muted">
          <span>
            <span className="font-bold text-ink">{count}</span>
            {suffix ? ` ${suffix}` : ''}
          </span>
          <span>{next ? t('badge.nextAt', { n: next }) : t('badge.maxed')}</span>
        </p>
      </div>
    </div>
  )
}
