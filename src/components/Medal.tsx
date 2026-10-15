import { useContext, useId, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { Glyph } from '../lib/achievements'
import type { Progress, Tier } from '../lib/badges'
import type { BoltStyle } from '../lib/titles'
import { BoltStyleContext } from './boltStyle'
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
/** Los dos logros únicos usan el mismo escudo con su propio metal: rojo rubí y negro con filo dorado */
const SPECIAL_METALS: Record<'ruby' | 'legend', { stops: string[]; rim: string; ink: string; light: boolean; animated?: boolean }> = {
  ruby: { stops: ['#ff8a96', '#e8112d', '#8c0a1d', '#d4112b', '#ff6b7d'], rim: '#3a040c', ink: '#14040a', light: false },
  // Multicolor iridiscente: muchos tonos mezclados (no los del arcoíris literal); los colores cambian y el reflejo se mueve
  legend: { stops: ['#7df9ff', '#a78bfa', '#ff7ad9', '#ffc46b', '#7dffb2', '#6ea8ff', '#e879f9', '#fff1a8', '#7df9ff'], rim: '#3b2a6b', ink: '#16121f', light: false, animated: true },
}
/** Rayos simples: ocho zigzags que parpadean alrededor del escudo y se apagan */
const BOLT_PATH = 'M0 0 L4.9 -3.6 L7.7 2.5 L13.3 -3.1 L16.8 0.8 L21 -1.7'
const BOLT_ANGLES = [-75, -30, 15, 60, 105, 150, 195, 240]

function Bolts({ colors, shifting }: { colors: string[]; shifting: boolean }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {BOLT_ANGLES.map((angle, i) => {
        const color = colors[i % colors.length]
        const dur = 1.9 + (i % 3) * 0.45
        const begin = `-${((i * 0.73) % dur).toFixed(2)}s`
        // La leyenda cambia de color por el camino, como su escudo
        const rotated = [...colors.slice(i % colors.length), ...colors.slice(0, i % colors.length), color].join(';')
        const shift = shifting ? <animate attributeName="stroke" values={rotated} dur="6s" repeatCount="indefinite" /> : null
        return (
          <g key={angle} transform={`translate(28 31) rotate(${angle}) translate(24 0)`} opacity="0">
            {/* Parpadeo de relámpago: salta, vacila y se apaga hasta el siguiente */}
            <animate attributeName="opacity" values="0;1;0.25;0.95;0;0" keyTimes="0;0.06;0.14;0.22;0.5;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
            <path d={BOLT_PATH} stroke={color} strokeWidth="5" opacity="0.4">
              {shift}
            </path>
            <path d={BOLT_PATH} stroke={color} strokeWidth="2.2">
              {shift}
            </path>
            <path d={BOLT_PATH} stroke="#fff" strokeWidth="0.8" opacity="0.9" />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Rayos ramificados (evento perfecto y leyenda absoluta) que salen del escudo por fuera, con un halo que chisporrotea. Todo se genera con un generador de números con semilla, así que es siempre igual.
 */
function rng(seed: number) {
  let v = seed
  return () => {
    v = (v * 16807) % 2147483647
    return (v - 1) / 2147483646
  }
}
type Pt = [number, number]
const toPath = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')

/** Rayo irregular entre dos puntos, con ramas cortas que salen de algunos de sus quiebros */
function boltPath(seed: number, [x1, y1]: Pt, [x2, y2]: Pt, segs: number, jitter: number, forks: number): string {
  const rand = rng(seed)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const pts: Pt[] = [[x1, y1]]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const o = (rand() - 0.5) * 2 * jitter
    pts.push([x1 + dx * t + nx * o, y1 + dy * t + ny * o])
  }
  pts.push([x2, y2])
  let d = toPath(pts)
  for (let f = 0; f < forks; f++) {
    const k = 1 + Math.floor(rand() * (pts.length - 2))
    const ang = Math.atan2(dy, dx) + (rand() < 0.5 ? -1 : 1) * (0.45 + rand() * 0.5)
    const flen = len * (0.25 + rand() * 0.2)
    const mid: Pt = [pts[k][0] + Math.cos(ang) * flen * 0.5 + (rand() - 0.5) * 2, pts[k][1] + Math.sin(ang) * flen * 0.5 + (rand() - 0.5) * 2]
    const end: Pt = [pts[k][0] + Math.cos(ang) * flen, pts[k][1] + Math.sin(ang) * flen]
    d += toPath([pts[k], mid, end])
  }
  return d
}

type Arc = { d: string; dur: number; begin: number }
/** Rayos que salen por fuera: punto del borde, ángulo y largo */
const OUTER_ARCS: Arc[] = (
  [
    [7, 0, -125, 16],
    [28, 0, -90, 14],
    [49, 0, -55, 16],
    [56, 24, -8, 16],
    [46, 48, 38, 15],
    [28, 62, 90, 14],
    [10, 48, 142, 15],
    [0, 24, 188, 16],
  ] as [number, number, number, number][]
).map(([x, y, deg, len], i) => {
  const r = (deg * Math.PI) / 180
  return { d: boltPath(31 + i * 5, [x, y], [x + Math.cos(r) * len, y + Math.sin(r) * len], 6, 3, 2), dur: 1.1 + (i % 4) * 0.4, begin: i * 0.31 }
})

function Charge({ id, colors, shifting }: { id: string; colors: string[]; shifting: boolean }) {
  const colorAt = (i: number) => colors[i % colors.length]
  // Los colores del legend van cambiando por el camino, como su escudo
  const shift = (i: number) =>
    shifting ? <animate attributeName="stroke" values={[...colors.slice(i % colors.length), ...colors.slice(0, i % colors.length), colorAt(i)].join(';')} dur="5s" repeatCount="indefinite" /> : null
  // Cada rayo se enciende en ráfagas cortas y se apaga hasta la siguiente
  const burst = (a: Arc) => (
    <animate attributeName="opacity" values="0;1;0.2;1;0.4;0;0" keyTimes="0;0.03;0.07;0.12;0.18;0.32;1" dur={`${a.dur}s`} begin={`-${a.begin}s`} repeatCount="indefinite" />
  )
  const arcs = (list: Arc[], offset: number) =>
    list.map((a, i) => (
      <g key={i} opacity="0">
        {burst(a)}
        <path d={a.d} stroke={colorAt(i + offset)} strokeWidth="2.2" opacity="0.8">
          {shift(i + offset)}
        </path>
        <path d={a.d} stroke="#fff" strokeWidth="0.7" />
      </g>
    ))
  return (
    <>
      <defs>
        {/* Los rayos chisporrotean: se deforman con ruido que cambia varias veces por segundo, con un halo difuminado */}
        <filter id={`${id}f`} filterUnits="userSpaceOnUse" x="-24" y="-24" width="104" height="110">
          <feTurbulence type="fractalNoise" baseFrequency="0.24 0.2" numOctaves="2" seed="1" result="n">
            <animate attributeName="seed" values="1;5;2;8;3;6;4;9" dur="0.64s" calcMode="discrete" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="d" />
          </feMerge>
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Rayos de fuera */}
        <g filter={`url(#${id}f)`}>
          {arcs(OUTER_ARCS, 2)}
        </g>
      </g>
    </>
  )
}

/** Segundos de adelanto del reflejo de cada medalla (0 a 3,5), sacado de su id para que no brillen todas a la vez */
const shineOffset = (id: string) => (Array.from(id).reduce((a, ch) => a + ch.charCodeAt(0), 0) % 36) / 10
const STOP_AT = [0, 0.3, 0.5, 0.72, 1]
const stopAt = (i: number, n: number) => (n === STOP_AT.length ? STOP_AT[i] : i / (n - 1))

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
  bolts,
}: {
  glyph: Glyph
  tier: Tier
  size?: number
  single?: boolean
  /** Niveles del logro (4, o 5 con esmeralda): cuadraditos que se enseñan debajo */
  levels?: number
  /** 'ruby' (evento perfecto) y 'legend' (logro supremo) tienen diseño propio al conseguirse */
  kind?: MedalKind
  /** Rayos de los escudos especiales; sin indicarlo, los del jugador cuyo perfil se está viendo */
  bolts?: BoltStyle
}) {
  const boltsFromProfile = useContext(BoltStyleContext)
  const boltStyle = bolts ?? boltsFromProfile
  const special = kind === 'ruby' || kind === 'legend'
  const id = useId().replace(/:/g, '')
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const earned = tier > 0
  const metal: { stops: string[]; rim: string; ink: string; light?: boolean; animated?: boolean } | null = !earned ? null : kind === 'metal' ? METALS[tier as 1 | 2 | 3 | 4 | 5] : SPECIAL_METALS[kind]
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" style={{ overflow: 'visible' }} className="block drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
        {metal && !reduceMotion && special && boltStyle === 'simple' && <Bolts colors={metal.animated ? metal.stops : metal.stops.filter((_, i) => i !== 2)} shifting={!!metal.animated} />}
        {metal ? (
          <>
            <defs>
              <linearGradient id={`${id}o`} {...(metal.animated ? { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 56, y2: 62, spreadMethod: 'repeat' } : { x1: 0, y1: 0, x2: 1, y2: 1 })}>
                {metal.stops.map((c, i) => (
                  <stop key={i} offset={stopAt(i, metal.stops.length)} stopColor={c} />
                ))}
                {metal.animated && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="56 62" dur="5s" repeatCount="indefinite" />}
              </linearGradient>
              <linearGradient id={`${id}i`} {...(metal.animated ? { gradientUnits: 'userSpaceOnUse', x1: 56, y1: 62, x2: 0, y2: 0, spreadMethod: 'repeat' } : { x1: 1, y1: 1, x2: 0, y2: 0 })}>
                {metal.stops.map((c, i) => (
                  <stop key={i} offset={stopAt(i, metal.stops.length)} stopColor={c} />
                ))}
                {metal.animated && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="-56 -62" dur="7s" repeatCount="indefinite" />}
              </linearGradient>
              <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <clipPath id={`${id}c`}>
                <polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10" />
              </clipPath>
            </defs>
            <g>
              <polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill={`url(#${id}o)`} stroke={metal.rim} strokeWidth="1.2" strokeLinejoin="round" />
              <polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10" fill={`url(#${id}i)`} stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeLinejoin="round" />
            </g>
            <g clipPath={`url(#${id}c)`}>
              {metal.animated ? (
                <polygon points="-20,0 -4,0 26,62 10,62" fill="#fff" opacity="0.6">
                  <animateTransform attributeName="transform" type="translate" from="-30 0" to="95 0" dur="3.2s" repeatCount="indefinite" />
                </polygon>
              ) : (
                <>
                  <polygon points="0,0 34,0 0,36" fill="#fff" opacity="0.18" />
                  {/* Reflejo que cruza el escudo de vez en cuando; cada medalla empieza en un momento distinto */}
                  {!reduceMotion && (
                    <polygon points="-16,0 2,0 28,62 10,62" fill={`url(#${id}s)`}>
                      <animateTransform attributeName="transform" type="translate" values="-30 0;92 0;92 0" keyTimes="0;0.5;1" dur="4s" begin={`-${shineOffset(id)}s`} repeatCount="indefinite" />
                    </polygon>
                  )}
                </>
              )}
              <polygon points="56,62 56,28 24,62" fill="#000" opacity="0.14" />
            </g>
            <svg x="14.5" y="11.5" width="27" height="27" viewBox="0 0 24 24" fill={metal.light ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.55)'}>
              {GLYPHS[glyph]}
            </svg>
            <svg x="14" y="11" width="27" height="27" viewBox="0 0 24 24" fill={metal.ink}>
              {GLYPHS[glyph]}
            </svg>
            {!reduceMotion && special && boltStyle === 'forked' && <Charge id={id} colors={metal.animated ? metal.stops : metal.stops.filter((_, i) => i !== 2)} shifting={!!metal.animated} />}
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
  topPercent = null,
}: {
  single?: boolean
  kind?: MedalKind
  topPercent?: number | null
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
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-display text-[6rem] leading-none font-black text-transparent select-none sm:text-[12rem]"
          style={{ WebkitTextStroke: `2px ${accent}`, opacity: earned ? 0.5 : 0.35 }}
        >
          {ghost}
        </span>
        <span className="sm:hidden">
          <MedalIcon glyph={glyph} tier={tier} size={80} single={single} kind={kind} />
        </span>
        <span className="hidden sm:block">
          <MedalIcon glyph={glyph} tier={tier} size={112} single={single} kind={kind} />
        </span>
        <div className="relative min-w-0 flex-1 basis-72">
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow">{kicker}</p>
          <h4 className="mt-1 font-display text-4xl leading-[0.95] font-black sm:text-6xl">{name}</h4>
          <p className="mt-2 max-w-xl text-sm text-ink/80">{description}</p>
          <div className="mt-4 max-w-xl">
            <div className="h-2 bg-line" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={next ?? count} aria-label={name}>
              <div className="h-full" style={{ width: `${next ? Math.min(100, Math.round((count / next) * 100)) : 100}%`, background: kind === 'ruby' ? RUBY : TIER_COLOR[Math.min(4, tier + 1) as Tier] }} />
            </div>
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 font-mono text-xs text-muted">
              <span>
                <span className="font-bold text-ink">{count}</span> {countLabel}
                {topPercent !== null && <span className="ml-2 font-bold text-kart-yellow">· {t('ach.top', { pct: topPercent })}</span>}
                {earned && (
                  <span className="ml-2 font-bold uppercase" style={{ color: accent }}>
                    · {single ? t('ach.done') : t(tierLabel(tier))}
                  </span>
                )}
              </span>
              <span>{single ? '' : next ? t('badge.nextAt', { n: next }) : t('badge.maxed')}</span>
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
  topPercent = null,
}: {
  single?: boolean
  topPercent?: number | null
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
            {topPercent !== null && <span className="ml-2 font-bold text-kart-yellow">· {t('ach.top', { pct: topPercent })}</span>}
          </span>
          <span>{single ? (tier ? t('ach.done') : '') : next ? t('badge.nextAt', { n: next }) : t('badge.maxed')}</span>
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
 * Logro supremo: todos los demás conseguidos. Marco de colores que cambia sin parar, texto con destello, estrellitas y un escudo
 * negro. Sin conseguir se ve apagado, con cuántos faltan.
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
  topPercent = null,
}: {
  topPercent?: number | null
  glyph: Glyph
  kicker: string
  name: string
  description: string
  countLabel: string
  progress: Progress
  total: number
  doneLabel: string
}) {
  const { t } = useI18n()
  const earned = progress.tier > 0
  const pct = Math.round((Math.min(progress.count, total) / total) * 100)
  return (
    <div className={`relative p-[3px] ${earned ? 'glam-frame' : 'bg-line'}`}>
      <div className="relative overflow-hidden bg-bg">
        {earned && <div className="glam-sweep pointer-events-none absolute inset-0" aria-hidden />}
        {earned &&
          SPARKLES.map(([x, y, delay], i) => (
            <svg key={i} aria-hidden viewBox="0 0 10 10" className="glam-star pointer-events-none absolute size-4 fill-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}>
              <polygon points="5,0 6.2,3.8 10,5 6.2,6.2 5,10 3.8,6.2 0,5 3.8,3.8" />
            </svg>
          ))}
        <div className={`relative flex flex-wrap items-center gap-x-10 gap-y-5 px-6 py-8 sm:px-12 ${earned ? '' : 'opacity-60'}`}>
          <div className={earned ? 'glam-float' : ''}>
            <span className="sm:hidden">
              <MedalIcon glyph={glyph} tier={earned ? 4 : 0} size={104} single kind="legend" />
            </span>
            <span className="hidden sm:block">
              <MedalIcon glyph={glyph} tier={earned ? 4 : 0} size={150} single kind="legend" />
            </span>
          </div>
          <div className="min-w-0 flex-1 basis-80">
            <p className="font-mono text-xs font-bold tracking-[0.35em] text-kart-yellow">{kicker}</p>
            <h4 className={`mt-1 font-display text-4xl leading-[0.92] font-black uppercase sm:text-7xl ${earned ? 'glam-text' : 'text-muted'}`}>{name}</h4>
            <p className="mt-3 max-w-2xl text-sm text-ink/80">{description}</p>
            <div className="mt-5 max-w-2xl">
              <div className="h-2.5 bg-line" role="progressbar" aria-valuenow={progress.count} aria-valuemin={0} aria-valuemax={total} aria-label={name}>
                <div className={`h-full ${earned ? 'glam-bar' : ''}`} style={{ width: `${pct}%`, background: earned ? undefined : TIER_COLOR[4] }} />
              </div>
              <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 font-mono text-xs text-muted">
                <span>
                  <span className="font-bold text-ink">{Math.min(progress.count, total)}</span> / {total} {countLabel}
                  {topPercent !== null && <span className="ml-2 font-bold text-kart-yellow">· {t('ach.top', { pct: topPercent })}</span>}
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
