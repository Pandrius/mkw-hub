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
const METALS: Record<1 | 2 | 3 | 4, { stops: string[]; rim: string; ink: string }> = {
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
  kind = 'metal',
}: {
  glyph: Glyph
  tier: Tier
  size?: number
  single?: boolean
  /** 'ruby' (evento perfecto) y 'legend' (logro supremo) tienen diseño propio al conseguirse */
  kind?: MedalKind
}) {
  const id = useId().replace(/:/g, '')
  const earned = tier > 0
  if (earned && kind === 'ruby') return <RubyGem glyph={glyph} size={size} />
  if (earned && kind === 'legend') return <LegendEmblem size={size * 1.1} />
  const metal = earned ? METALS[tier as 1 | 2 | 3 | 4] : null
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
          {[1, 2, 3, 4].map((i) => (
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

/** Estrellitas que parpadean alrededor del logro supremo: posición (%) y retraso (s) */
const SPARKLES: [number, number, number][] = [
  [6, 18, 0],
  [14, 78, 0.7],
  [31, 10, 1.4],
  [47, 90, 0.3],
  [63, 6, 1.9],
  [76, 84, 1.1],
  [88, 22, 0.5],
  [94, 70, 1.6],
]

/**
 * Logro supremo: todos los demás conseguidos. Marco de colores que gira, texto con destello, estrellitas y una medalla de
 * platino con un brillo que la barre. Sin conseguir se ve apagado, con cuántos faltan.
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
  const pct = Math.round((Math.min(progress.count, total) / total) * 100)
  return (
    <div className={`relative p-[3px] ${earned ? 'glam-frame' : 'bg-line'}`}>
      <div className="relative overflow-hidden" style={{ background: earned ? 'radial-gradient(circle at 14% 50%, rgba(255,213,0,0.2), transparent 42%), #08080c' : 'var(--color-bg)' }}>
        {earned && <div className="glam-sweep pointer-events-none absolute inset-0" aria-hidden />}
        {earned &&
          SPARKLES.map(([x, y, delay], i) => (
            <svg key={i} aria-hidden viewBox="0 0 10 10" className="glam-star pointer-events-none absolute size-4 fill-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}>
              <polygon points="5,0 6.2,3.8 10,5 6.2,6.2 5,10 3.8,6.2 0,5 3.8,3.8" />
            </svg>
          ))}
        <div className={`relative flex flex-wrap items-center gap-x-10 gap-y-5 px-6 py-8 sm:px-12 ${earned ? '' : 'opacity-60'}`}>
          <div className={earned ? 'glam-float' : ''}>
            {earned ? <LegendEmblem size={190} /> : <MedalIcon glyph={glyph} tier={0} size={150} single />}
          </div>
          <div className="min-w-0 flex-1 basis-80">
            <p className="font-mono text-xs font-bold tracking-[0.35em] text-kart-yellow">{kicker}</p>
            <h4 className={`mt-1 font-display text-5xl leading-[0.92] font-black uppercase sm:text-7xl ${earned ? 'glam-text' : 'text-muted'}`}>{name}</h4>
            <p className="mt-3 max-w-2xl text-sm text-ink/80">{description}</p>
            <div className="mt-5 max-w-2xl">
              <div className="h-2.5 bg-line" role="progressbar" aria-valuenow={progress.count} aria-valuemin={0} aria-valuemax={total} aria-label={name}>
                <div className={`h-full ${earned ? 'glam-bar' : ''}`} style={{ width: `${pct}%`, background: earned ? undefined : TIER_COLOR[4] }} />
              </div>
              <p className="mt-1.5 flex justify-between font-mono text-xs text-muted">
                <span>
                  <span className="font-bold text-ink">{Math.min(progress.count, total)}</span> / {total} {countLabel}
                </span>
                {earned && <span className="font-bold uppercase text-kart-yellow">{doneLabel}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Facetas del rubí: polígono y tono (de la más clara a la más oscura) */
const RUBY_FACETS: [string, string][] = [
  ['16,4 40,4 34,18 22,18', '#ff8aa6'],
  ['16,4 22,18 2,18', '#d4144a'],
  ['40,4 54,18 34,18', '#ff4d7a'],
  ['2,18 22,18 28,60', '#8e0a31'],
  ['22,18 34,18 28,60', '#ee1a5c'],
  ['34,18 54,18 28,60', '#b30d3d'],
]

/** Evento perfecto: un rubí tallado con facetas, destellos y la corona grabada. Más exclusivo que cualquier metal */
export function RubyGem({ glyph, size = 64 }: { glyph: Glyph; size?: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" className="block overflow-visible drop-shadow-[0_0_8px_rgba(255,45,106,0.65)]">
        {RUBY_FACETS.map(([points, fill]) => (
          <polygon key={points} points={points} fill={fill} stroke="#4a0519" strokeWidth="0.6" strokeLinejoin="round" />
        ))}
        {/* Reflejos de las facetas */}
        <polygon points="18,6 26,6 22,15 19,15" fill="#fff" opacity="0.55" />
        <polygon points="6,18 17,18 12,19.5" fill="#fff" opacity="0.2" />
        <polygon points="24,22 28,22 28,50" fill="#fff" opacity="0.18" />
        <polygon points="2,18 54,18 52,19.6 4,19.6" fill="#fff" opacity="0.3" />
        <polygon points="16,4 40,4 54,18 28,60 2,18" fill="none" stroke="#5c0620" strokeWidth="1.2" strokeLinejoin="round" />
        <svg x="16" y="21" width="24" height="24" viewBox="0 0 24 24" fill="rgba(0,0,0,0.35)">
          <g transform="translate(0.6 0.8)">{GLYPHS[glyph]}</g>
        </svg>
        <svg x="16" y="21" width="24" height="24" viewBox="0 0 24 24" fill="#ffe4ec">
          {GLYPHS[glyph]}
        </svg>
        <svg viewBox="0 0 10 10" x="40" y="2" width="9" height="9" className="glam-star fill-white">
          <polygon points="5,0 6.2,3.8 10,5 6.2,6.2 5,10 3.8,6.2 0,5 3.8,3.8" />
        </svg>
      </svg>
      <span className="size-1.5" style={{ background: RUBY }} />
    </div>
  )
}

/**
 * Logro supremo: un emblema que no se parece a ningún escudo. Anillo iridiscente que gira, rayos dorados, dos coronas de laurel
 * y un trofeo de oro sobre fondo de obsidiana. Es lo más difícil de conseguir de toda la web.
 */
export function LegendEmblem({ size = 150 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  const leaves = Array.from({ length: 7 }, (_, i) => 118 + i * 17)
  const rays = Array.from({ length: 28 }, (_, i) => i * (360 / 28))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <div className="legend-ring absolute inset-0 rounded-full" />
      <div className="absolute rounded-full bg-[#0a0a0f]" style={{ inset: size * 0.045 }} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff8c4" />
            <stop offset="0.35" stopColor="#ffd500" />
            <stop offset="0.6" stopColor="#b57f00" />
            <stop offset="0.8" stopColor="#ffd500" />
            <stop offset="1" stopColor="#fff2a0" />
          </linearGradient>
          <radialGradient id={`${id}r`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd500" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffd500" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill={`url(#${id}r)`} />
        <g className="legend-rays">
          {rays.map((a) => (
            <polygon key={a} points="50,6 51.4,22 48.6,22" fill="#ffd500" opacity="0.6" transform={`rotate(${a} 50 50)`} />
          ))}
        </g>
        <circle cx="50" cy="50" r="34" fill="none" stroke={`url(#${id}g)`} strokeWidth="1.6" />
        {[-1, 1].map((side) =>
          leaves.map((a) => {
            const rad = (a * Math.PI) / 180
            const x = 50 + side * 31 * Math.cos(rad - Math.PI)
            const y = 50 + 31 * Math.sin(rad - Math.PI) * -1
            return <ellipse key={`${side}${a}`} cx={x} cy={y} rx="2.6" ry="6" fill={`url(#${id}g)`} transform={`rotate(${side * (a - 90)} ${x} ${y})`} />
          }),
        )}
        <svg x="30" y="27" width="40" height="40" viewBox="0 0 24 24" fill="rgba(0,0,0,0.5)">
          <g transform="translate(0.5 0.7)">{GLYPHS.trophy}</g>
        </svg>
        <svg x="30" y="27" width="40" height="40" viewBox="0 0 24 24" fill={`url(#${id}g)`} stroke="#6b4a00" strokeWidth="0.4">
          {GLYPHS.trophy}
        </svg>
        <svg viewBox="0 0 10 10" x="44" y="2" width="12" height="12" className="glam-star fill-white">
          <polygon points="5,0 6.2,3.8 10,5 6.2,6.2 5,10 3.8,6.2 0,5 3.8,3.8" />
        </svg>
      </svg>
    </div>
  )
}
