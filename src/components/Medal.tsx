import { useId, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { Glyph } from '../lib/achievements'
import type { Progress, Tier } from '../lib/badges'
import { RUBY, TIER_COLOR, tierLabel, type MedalKind } from './tiers'

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
  crown: (
    <>
      <polygon points="2,18 3.5,6 8.5,11.5 12,3 15.5,11.5 20.5,6 22,18" />
      <rect x="2" y="19.5" width="20" height="2.5" />
    </>
  ),
  bolt: <polygon points="14,2 4,14 11,14 9,22 20,9 13,9" />,
  trophy: (
    <>
      <path d="M6 2h12v6a6 6 0 0 1-12 0z" />
      <path d="M6 4H2v2a4 4 0 0 0 4 4zM18 4h4v2a4 4 0 0 1-4 4z" />
      <rect x="10.5" y="13" width="3" height="5" />
      <rect x="7" y="18" width="10" height="3" />
    </>
  ),
  star: <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" />,
}

/** Metales de cada nivel: reflejos, tono medio y sombra, de la esquina clara a la oscura */
const METALS: Record<1 | 2 | 3 | 4 | 5, { stops: string[]; rim: string; ink: string }> = {
  5: { stops: ['#d4ffe6', '#34e68f', '#0a8a4a', '#42d68f', '#d8ffec'], rim: '#04442a', ink: '#033a22' },
  1: { stops: ['#f8c9a0', '#dc8c46', '#8a4a1c', '#c9773a', '#f2b686'], rim: '#5a2c0e', ink: '#4a230c' },
  2: { stops: ['#ffffff', '#d7dce3', '#848d9a', '#c3c9d2', '#f6f8fa'], rim: '#474d56', ink: '#363b43' },
  3: { stops: ['#fff6b0', '#ffd500', '#b58300', '#f2c200', '#fff2a0'], rim: '#664500', ink: '#4a3200' },
  4: { stops: ['#eaffff', '#3fe0fa', '#0a8aa6', '#55d6ec', '#cdf8ff'], rim: '#04506a', ink: '#04384a' },
}
const STOP_AT = [0, 0.3, 0.5, 0.72, 1]

/**
 * Medalla: escudo de metal (bronce, plata, oro o platino) con bisel, brillo y el dibujo grabado en relieve.
 * Sin conseguir, solo el contorno apagado. El nivel se marca además con tantos cuadraditos como niveles alcanzados.
 */
export function MedalIcon({
  glyph,
  tier,
  size = 64,
  single = false,
  levels = 4,
  kind = 'metal',
}: {
  glyph: Glyph
  tier: Tier
  size?: number
  single?: boolean
  /** Niveles del logro (4, o 5 con esmeralda): cuadraditos que se enseñan debajo */
  levels?: number
  /** 'ruby' (evento perfecto) y 'legend' (logro supremo) tienen diseño propio al conseguirse */
  kind?: MedalKind
}) {
  const id = useId().replace(/:/g, '')
  const earned = tier > 0
  if (earned && kind === 'ruby') return <RubyGem glyph={glyph} size={size} />
  if (earned && kind === 'legend') return <LegendEmblem size={size} />
  const metal = earned ? METALS[tier as 1 | 2 | 3 | 4 | 5] : null
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" className="block drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
        {metal ? (
          <>
            <defs>
              <linearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="1">
                {metal.stops.map((c, i) => (
                  <stop key={i} offset={STOP_AT[i]} stopColor={c} />
                ))}
              </linearGradient>
              <linearGradient id={`${id}i`} x1="1" y1="1" x2="0" y2="0">
                {metal.stops.map((c, i) => (
                  <stop key={i} offset={STOP_AT[i]} stopColor={c} />
                ))}
              </linearGradient>
              <clipPath id={`${id}c`}>
                <polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10" />
              </clipPath>
            </defs>
            <polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill={`url(#${id}o)`} stroke={metal.rim} strokeWidth="1.2" strokeLinejoin="round" />
            <polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10" fill={`url(#${id}i)`} stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeLinejoin="round" />
            <g clipPath={`url(#${id}c)`}>
              <polygon points="0,0 34,0 0,36" fill="#fff" opacity="0.28" />
              <polygon points="56,62 56,28 24,62" fill="#000" opacity="0.14" />
            </g>
            <svg x="14.5" y="11.5" width="27" height="27" viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)">
              {GLYPHS[glyph]}
            </svg>
            <svg x="14" y="11" width="27" height="27" viewBox="0 0 24 24" fill={metal.ink}>
              {GLYPHS[glyph]}
            </svg>
          </>
        ) : (
          <>
            <polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill="none" stroke="#5d5b55" strokeWidth="2.5" strokeDasharray="4 3" />
            <svg x="14" y="10" width="28" height="28" viewBox="0 0 24 24" fill="#5d5b55">
              {GLYPHS[glyph]}
            </svg>
          </>
        )}
      </svg>
      {!single && (
        <span className="flex gap-0.5">
          {Array.from({ length: levels }, (_, k) => k + 1).map((i) => (
            <span key={i} className="size-1.5" style={{ background: i <= tier ? TIER_COLOR[tier] : 'var(--color-line)' }} />
          ))}
        </span>
      )}
    </div>
  )
}

/**
 * Logro épico: tarjeta a todo ancho con banderas a cuadros en movimiento, medalla grande y la cifra enorme de fondo.
 * Sin conseguir se ve apagado, como un reto a la vista.
 */
export function EpicCard({
  glyph,
  kicker,
  name,
  description,
  ghost,
  countLabel,
  progress,
  thresholds,
  single = false,
  kind = 'metal',
}: {
  single?: boolean
  kind?: MedalKind
  glyph: Glyph
  kicker: string
  name: string
  description: string
  /** Cifra grande de fondo */
  ghost: string
  countLabel: string
  progress: Progress
  thresholds: number[]
}) {
  const { t } = useI18n()
  const { count, tier, next } = progress
  const earned = tier > 0
  const accent = earned ? (kind === 'ruby' ? RUBY : TIER_COLOR[tier]) : 'var(--color-line)'
  const tooltip = single ? undefined : thresholds.map((n, i) => `${t(tierLabel((i + 1) as Tier))}: ${n}`).join('  ·  ')

  return (
    <div className="panel relative overflow-hidden" style={{ borderColor: earned ? accent : undefined }} title={tooltip}>
      <div className={`checker h-3 ${earned ? 'checker-run' : 'opacity-30'}`} aria-hidden />
      <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-6 sm:px-10">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-display text-[9rem] leading-none font-black text-transparent select-none sm:text-[12rem]"
          style={{ WebkitTextStroke: `2px ${accent}`, opacity: earned ? 0.5 : 0.35 }}
        >
          {ghost}
        </span>
        <MedalIcon glyph={glyph} tier={tier} size={112} single={single} kind={kind} />
        <div className="relative min-w-0 flex-1 basis-72">
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow">{kicker}</p>
          <h4 className="mt-1 font-display text-4xl leading-[0.95] font-black sm:text-6xl">{name}</h4>
          <p className="mt-2 max-w-xl text-sm text-ink/80">{description}</p>
          <div className="mt-4 max-w-xl">
            <div className="h-2 bg-line" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={next ?? count} aria-label={name}>
              <div className="h-full" style={{ width: `${next ? Math.min(100, Math.round((count / next) * 100)) : 100}%`, background: kind === 'ruby' ? RUBY : TIER_COLOR[Math.min(4, tier + 1) as Tier] }} />
            </div>
            <p className="mt-1.5 flex justify-between font-mono text-xs text-muted">
              <span>
                <span className="font-bold text-ink">{count}</span> {countLabel}
                {earned && (
                  <span className="ml-2 font-bold uppercase" style={{ color: accent }}>
                    · {single ? t('ach.done') : t(tierLabel(tier))}
                  </span>
                )}
              </span>
              <span>{single ? (earned ? t('ach.done') : '') : next ? t('badge.nextAt', { n: next }) : t('badge.maxed')}</span>
            </p>
          </div>
        </div>
      </div>
      <div className={`checker h-3 ${earned ? 'checker-run' : 'opacity-30'}`} aria-hidden />
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
  single = false,
}: {
  single?: boolean
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
  const levels = thresholds.length
  const previous = tier > 0 ? thresholds[tier - 1] : 0
  const pct = single ? (tier > 0 ? 100 : 0) : next ? Math.max(0, Math.min(100, Math.round(((count - previous) / (next - previous)) * 100))) : 100
  const accent = TIER_COLOR[tier]
  const nextColor = single ? TIER_COLOR[tier || 4] : TIER_COLOR[Math.min(levels, tier + 1) as Tier]
  const tooltip = single ? undefined : thresholds.map((n, i) => `${t(tierLabel((i + 1) as Tier))}: ${n}`).join('  ·  ')

  return (
    <div
      className="panel relative flex gap-4 overflow-hidden p-4"
      style={single ? (tier > 0 ? { borderColor: accent } : undefined) : tier === levels ? { borderColor: accent } : undefined}
      title={tooltip}
    >
      {(single ? tier > 0 : tier === levels) && <div className="hazard absolute inset-x-0 top-0 h-1" />}
      <MedalIcon glyph={glyph} tier={tier} single={single} levels={levels} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-xl leading-[1.05] font-black">{name}</h4>
          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold uppercase" style={{ color: tier ? accent : 'var(--color-muted)' }}>
            {tier ? (single ? t('ach.done') : t(tierLabel(tier))) : t('badge.locked')}
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
          <span>{single ? (tier ? t('ach.done') : '') : next ? t('badge.nextAt', { n: next }) : t('badge.maxed')}</span>
        </p>
      </div>
    </div>
  )
}

const SHIELD = '7,0 49,0 56,9 56,40 28,62 0,40 0,9'

/** Fila de cuadros de bandera a cuadros recortada por el escudo (el mismo motivo de la meta que usa la web) */
function CheckerBand({ y, size, a, b, clip }: { y: number; size: number; a: string; b: string; clip: string }) {
  const cols = Math.ceil(56 / size)
  return (
    <g clipPath={`url(#${clip})`}>
      {[0, 1].flatMap((row) =>
        Array.from({ length: cols }, (_, c) => <rect key={`${row}-${c}`} x={c * size} y={y + row * size} width={size} height={size} fill={(c + row) % 2 === 0 ? a : b} />),
      )}
    </g>
  )
}

/**
 * Evento perfecto: un escudo rojo rubí de colores planos y trazo grueso, con la corona y una franja de bandera a cuadros.
 * Mismo lenguaje que el resto de la web (sin brillos ni degradados), pero es el único rojo.
 */
export function RubyGem({ glyph, size = 64 }: { glyph: Glyph; size?: number }) {
  const clip = useId().replace(/:/g, '') + 'r'
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" className="block">
        <defs>
          <clipPath id={clip}>
            <polygon points={SHIELD} />
          </clipPath>
        </defs>
        <polygon points={SHIELD} fill="#e8112d" />
        <g clipPath={`url(#${clip})`}>
          <polygon points="0,0 28,0 28,62 0,40" fill="#b30c22" />
          <polygon points="7,0 49,0 44,6 12,6" fill="#ff6b7d" />
          <polygon points="28,6 44,6 28,26" fill="#ff4a60" />
        </g>
        <CheckerBand y={39} size={4} a="#ffffff" b="#1a0207" clip={clip} />
        <svg x="14" y="9" width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
          {GLYPHS[glyph]}
        </svg>
        <polygon points={SHIELD} fill="none" stroke="#1a0207" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <span className="size-1.5 bg-kart-red" />
    </div>
  )
}

/**
 * Logro supremo: escudo negro con borde de franjas de peligro amarillas y negras (las de la web), trofeo amarillo y una franja de
 * meta. Es el único negro y amarillo, y el más grande de todos.
 */
export function LegendEmblem({ size = 150 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="shrink-0" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" className="block">
        <defs>
          <pattern id={`${id}h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="6" height="6" fill="#141414" />
            <rect width="3" height="6" fill="#ffd500" />
          </pattern>
          <clipPath id={`${id}c`}>
            <polygon points="9,4 47,4 52,11 52,39 28,57 4,39 4,11" />
          </clipPath>
        </defs>
        <polygon points={SHIELD} fill={`url(#${id}h)`} stroke="#141414" strokeWidth="2.4" strokeLinejoin="round" />
        <polygon points="9,4 47,4 52,11 52,39 28,57 4,39 4,11" fill="#141414" stroke="#ffd500" strokeWidth="1.6" strokeLinejoin="round" />
        <CheckerBand y={36} size={3.5} a="#ffd500" b="#141414" clip={`${id}c`} />
        <svg x="12" y="8" width="32" height="32" viewBox="0 0 24 24" fill="#ffd500">
          {GLYPHS.trophy}
        </svg>
      </svg>
    </div>
  )
}

/**
 * Logro supremo: todos los demás conseguidos. El único bloque entero en amarillo de la web, con franjas de peligro, meta a cuadros
 * en movimiento y la cifra enorme en contorno, como un cartel de boxes. Sin conseguir, un panel apagado con lo que falta.
 */
export function GrandCard({
  glyph,
  kicker,
  name,
  description,
  countLabel,
  progress,
  total,
  doneLabel,
}: {
  glyph: Glyph
  kicker: string
  name: string
  description: string
  countLabel: string
  progress: Progress
  total: number
  doneLabel: string
}) {
  const earned = progress.tier > 0
  const done = Math.min(progress.count, total)
  const pct = Math.round((done / total) * 100)
  if (!earned) {
    return (
      <div className="panel relative overflow-hidden border-dashed">
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-6 opacity-70 sm:px-10">
          <MedalIcon glyph={glyph} tier={0} size={96} single />
          <div className="min-w-0 flex-1 basis-72">
            <p className="font-mono text-xs font-bold tracking-widest text-muted">{kicker}</p>
            <h4 className="mt-1 font-display text-4xl leading-[0.95] font-black uppercase sm:text-6xl">{name}</h4>
            <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
            <div className="mt-4 h-2 max-w-xl bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={name}>
              <div className="h-full bg-kart-yellow" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted">
              <span className="font-bold text-ink">{done}</span> / {total} {countLabel}
            </p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="relative overflow-hidden bg-kart-yellow text-bg">
      <div className="hazard h-2.5" aria-hidden />
      <div className="checker checker-run h-3" aria-hidden />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-display text-[9rem] leading-none font-black text-transparent select-none sm:text-[13rem]"
        style={{ WebkitTextStroke: '3px rgba(20,20,20,0.45)' }}
      >
        {total}
      </span>
      <div className="relative flex flex-wrap items-center gap-x-10 gap-y-5 px-6 py-8 sm:px-12">
        <LegendEmblem size={150} />
        <div className="min-w-0 flex-1 basis-80">
          <p className="inline-block bg-bg px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-kart-yellow">{kicker}</p>
          <h4 className="mt-2 font-display text-5xl leading-[0.9] font-black uppercase sm:text-7xl">{name}</h4>
          <p className="mt-3 max-w-2xl text-sm font-semibold">{description}</p>
          <div className="mt-5 max-w-2xl">
            <div className="h-3 bg-bg/25" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={name}>
              <div className="h-full bg-bg" style={{ width: '100%' }} />
            </div>
            <p className="mt-1.5 flex justify-between font-mono text-xs font-bold">
              <span>
                {done} / {total} {countLabel}
              </span>
              <span className="uppercase">{doneLabel}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="checker checker-run h-3" aria-hidden />
      <div className="hazard h-2.5" aria-hidden />
    </div>
  )
}
