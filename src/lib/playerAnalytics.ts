import type { EventKind } from './events'
import { sortTimeline, streakOf, type Streak, type TimedResult } from './form'
import { POINTS } from './scoring'
import { mean, median, pct, PHASES, phaseOf, RACES_PER_WAR, rolling, round2, shrink, stdDev, sum, type Phase } from './statMath'
import type { StatsFilter } from './stats'

/** Rendimiento de un conjunto de carreras */
export type PerfLine = { races: number; avgPos: number; avgPoints: number }

export type PlayerTrack = {
  trackId: string
  races: number
  avgPos: number
  avgPoints: number
  /** Puntos por carrera por encima (+) o por debajo (−) de la media del jugador */
  delta: number
  /** El mismo delta ajustado por muestra (con pocas carreras se acerca a 0); ordena mejores y peores */
  rating: number
  podiumRate: number
  best: number
  /** Últimas posiciones en la pista, de la más antigua a la más reciente (máx. 3) */
  recent: number[]
}

export type PlayerEvent = {
  eventId: string
  kind: EventKind
  date: string
  races: number
  points: number
  /** Puntos llevados a 12 carreras (para comparar eventos incompletos) */
  perWar: number
  avgPos: number
}

export type FormTrend = 'up' | 'steady' | 'down'

export type PlayerAnalytics = {
  races: number
  eventCount: number
  avgPos: number
  medianPos: number
  /** Desviación típica de la posición: cuanto más baja, más regular */
  sdPos: number
  avgPoints: number
  /** Puntos de media por 12 carreras, la referencia habitual en wars */
  perWar: number
  winRate: number
  podiumRate: number
  top6Rate: number
  /** Veces en cada posición (índice 0 = 1.º) */
  distribution: number[]
  phases: Record<Phase, PerfLine | null>
  /** War frente a lounge (con el filtro "todo") */
  split: Record<EventKind, PerfLine | null>
  form: { recent: PerfLine; baseline: PerfLine; delta: number; trend: FormTrend } | null
  /** Media móvil de puntos por carrera (ventana de 12) */
  rolling: { eventId: string; date: string; value: number }[]
  events: PlayerEvent[]
  streaks: { top6: Streak; podium: Streak; win: Streak; outsideTop6: Streak }
  tracks: PlayerTrack[]
  strongest: PlayerTrack[]
  weakest: PlayerTrack[]
}

/** Carreras de la "forma reciente" */
export const RECENT_RACES = 12
/** Mínimo de carreras anteriores para comparar la forma */
export const MIN_BASELINE = 6
/** Diferencia (puntos por carrera) a partir de la cual la forma sube o baja */
export const TREND_THRESHOLD = 0.75
/** Carreras mínimas en una pista para entrar en mejores / peores */
export const MIN_TRACK_RACES = 2

const pointsOf = (position: number) => POINTS[position - 1] ?? 0

export function perfOf(rows: { position: number }[]): PerfLine | null {
  if (!rows.length) return null
  return {
    races: rows.length,
    avgPos: round2(mean(rows.map((r) => r.position))),
    avgPoints: round2(mean(rows.map((r) => pointsOf(r.position)))),
  }
}

export const trendOf = (delta: number): FormTrend =>
  delta >= TREND_THRESHOLD ? 'up' : delta <= -TREND_THRESHOLD ? 'down' : 'steady'

/** Estadísticas individuales a partir de la línea de tiempo del jugador (función pura). Null si no hay carreras. */
export function computePlayerAnalytics(all: TimedResult[], filter: StatsFilter): PlayerAnalytics | null {
  const rows = sortTimeline(filter === 'all' ? all : all.filter((r) => r.kind === filter))
  if (!rows.length) return null

  const positions = rows.map((r) => r.position)
  const points = positions.map(pointsOf)
  const avgPoints = mean(points)

  const distribution = Array.from({ length: 12 }, (_, i) => positions.filter((p) => p === i + 1).length)

  const phases = Object.fromEntries(PHASES.map((ph) => [ph, perfOf(rows.filter((r) => phaseOf(r.raceNo) === ph))])) as Record<
    Phase,
    PerfLine | null
  >

  // Forma: las últimas 12 carreras frente a todas las anteriores
  const recentRows = rows.slice(-RECENT_RACES)
  const baselineRows = rows.slice(0, -RECENT_RACES)
  let form: PlayerAnalytics['form'] = null
  if (recentRows.length === RECENT_RACES && baselineRows.length >= MIN_BASELINE) {
    const recent = perfOf(recentRows)!
    const baseline = perfOf(baselineRows)!
    const delta = round2(recent.avgPoints - baseline.avgPoints)
    form = { recent, baseline, delta, trend: trendOf(delta) }
  }

  const roll = rolling(points, RECENT_RACES)
  const rollingSeries = roll.map((value, i) => {
    const r = rows[i + RECENT_RACES - 1]
    return { eventId: r.eventId, date: r.date, value: round2(value) }
  })

  // Eventos en orden cronológico
  const byEvent = new Map<string, TimedResult[]>()
  for (const r of rows) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r])
  const events: PlayerEvent[] = [...byEvent.entries()].map(([eventId, rs]) => {
    const pts = sum(rs.map((r) => pointsOf(r.position)))
    return {
      eventId,
      kind: rs[0].kind,
      date: rs[0].date,
      races: rs.length,
      points: pts,
      perWar: Math.round((pts / rs.length) * RACES_PER_WAR),
      avgPos: round2(mean(rs.map((r) => r.position))),
    }
  })

  // Pistas
  const byTrack = new Map<string, TimedResult[]>()
  for (const r of rows) byTrack.set(r.trackId, [...(byTrack.get(r.trackId) ?? []), r])
  const tracks: PlayerTrack[] = [...byTrack.entries()]
    .map(([trackId, rs]) => {
      const ps = rs.map((r) => r.position)
      const pts = ps.map(pointsOf)
      return {
        trackId,
        races: rs.length,
        avgPos: round2(mean(ps)),
        avgPoints: round2(mean(pts)),
        delta: round2(mean(pts) - avgPoints),
        rating: round2(shrink(sum(pts.map((p) => p - avgPoints)), pts.length)),
        podiumRate: pct(ps.filter((p) => p <= 3).length, ps.length),
        best: Math.min(...ps),
        recent: ps.slice(-3),
      }
    })
    .sort((a, b) => b.avgPoints - a.avgPoints || b.races - a.races)

  const ranked = tracks.filter((t) => t.races >= MIN_TRACK_RACES).sort((a, b) => b.rating - a.rating)
  const strongest = ranked.filter((t) => t.rating > 0).slice(0, 3)
  const weakest = ranked
    .filter((t) => t.rating < 0)
    .reverse()
    .slice(0, 3)

  return {
    races: rows.length,
    eventCount: byEvent.size,
    avgPos: round2(mean(positions)),
    medianPos: median(positions),
    sdPos: round2(stdDev(positions)),
    avgPoints: round2(avgPoints),
    perWar: Math.round(avgPoints * RACES_PER_WAR),
    winRate: pct(distribution[0], rows.length),
    podiumRate: pct(positions.filter((p) => p <= 3).length, rows.length),
    top6Rate: pct(positions.filter((p) => p <= 6).length, rows.length),
    distribution,
    phases,
    split: {
      war: perfOf(rows.filter((r) => r.kind === 'war')),
      lounge: perfOf(rows.filter((r) => r.kind === 'lounge')),
    },
    form,
    rolling: rollingSeries,
    events,
    streaks: {
      top6: streakOf(rows, (r) => r.position <= 6),
      podium: streakOf(rows, (r) => r.position <= 3),
      win: streakOf(rows, (r) => r.position === 1),
      outsideTop6: streakOf(rows, (r) => r.position >= 7),
    },
    tracks,
    strongest,
    weakest,
  }
}
