import { progressOf, type Progress } from './badges'
import { sortTimeline, streakOf, type TimedResult } from './form'
import { POINTS } from './scoring'
import { mean, RACES_PER_WAR } from './statMath'

export type AchievementId =
  | 'podiums'
  | 'wins'
  | 'top6'
  | 'winStreak'
  | 'top6Streak'
  | 'cleanEvent'
  | 'bigEvent'
  | 'legendEvent'
  | 'redemption'
  | 'finalRace'
  | 'domination'
  | 'podiumEverywhere'
  | 'winEverywhere'

/** Dibujo de la medalla (ver Medal.tsx) */
export type Glyph = 'podium' | 'flag' | 'chevrons' | 'bars' | 'ring' | 'bolt' | 'star'

export type Achievement = Progress & {
  id: AchievementId
  glyph: Glyph
  /** Cantidades necesarias para cada nivel (bronce, plata, oro, platino) */
  thresholds: number[]
}

/** Puntos de un evento completo a partir de los cuales cuenta como "gran evento" y como "evento legendario" */
export const BIG_EVENT_POINTS = 120
export const LEGEND_EVENT_POINTS = 150
/** Carreras en una pista para considerarla "dominada" y posición media máxima que se exige */
export const DOMINATION_RACES = 10
export const DOMINATION_AVG_POS = 3
/** Una remontada es ganar justo después de acabar en esta posición o peor */
export const REDEMPTION_FROM = 10

const pointsOf = (position: number) => POINTS[position - 1] ?? 0

type Def = { id: AchievementId; glyph: Glyph; thresholds: (totalTracks: number) => number[]; count: (rows: TimedResult[], totalTracks: number) => number }

/** Eventos completos (12 carreras) con las posiciones del jugador en orden */
function fullEvents(rows: TimedResult[]): number[][] {
  const byEvent = new Map<string, TimedResult[]>()
  for (const r of rows) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r])
  return [...byEvent.values()].filter((rs) => rs.length >= RACES_PER_WAR).map((rs) => rs.map((r) => r.position))
}

const countWhere = (rows: TimedResult[], test: (r: TimedResult) => boolean) => rows.filter(test).length

const DEFS: Def[] = [
  { id: 'podiums', glyph: 'podium', thresholds: () => [25, 100, 300, 1000], count: (rows) => countWhere(rows, (r) => r.position <= 3) },
  { id: 'wins', glyph: 'star', thresholds: () => [10, 50, 150, 500], count: (rows) => countWhere(rows, (r) => r.position === 1) },
  { id: 'top6', glyph: 'chevrons', thresholds: () => [50, 250, 750, 2000], count: (rows) => countWhere(rows, (r) => r.position <= 6) },
  { id: 'winStreak', glyph: 'bolt', thresholds: () => [2, 3, 5, 8], count: (rows) => streakOf(rows, (r) => r.position === 1).best },
  { id: 'top6Streak', glyph: 'bars', thresholds: () => [5, 10, 25, 50], count: (rows) => streakOf(rows, (r) => r.position <= 6).best },
  { id: 'cleanEvent', glyph: 'flag', thresholds: () => [1, 3, 10, 25], count: (rows) => fullEvents(rows).filter((ps) => ps.every((p) => p <= 6)).length },
  {
    id: 'bigEvent',
    glyph: 'flag',
    thresholds: () => [1, 5, 15, 40],
    count: (rows) => fullEvents(rows).filter((ps) => ps.reduce((a, p) => a + pointsOf(p), 0) >= BIG_EVENT_POINTS).length,
  },
  {
    id: 'legendEvent',
    glyph: 'star',
    thresholds: () => [1, 3, 8, 20],
    count: (rows) => fullEvents(rows).filter((ps) => ps.reduce((a, p) => a + pointsOf(p), 0) >= LEGEND_EVENT_POINTS).length,
  },
  {
    id: 'redemption',
    glyph: 'bolt',
    thresholds: () => [1, 5, 15, 40],
    count: (rows) => {
      let n = 0
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]
        const cur = rows[i]
        if (prev.eventId === cur.eventId && cur.raceNo === prev.raceNo + 1 && prev.position >= REDEMPTION_FROM && cur.position === 1) n++
      }
      return n
    },
  },
  { id: 'finalRace', glyph: 'flag', thresholds: () => [1, 5, 15, 40], count: (rows) => countWhere(rows, (r) => r.raceNo === RACES_PER_WAR && r.position === 1) },
  {
    id: 'domination',
    glyph: 'ring',
    thresholds: () => [1, 3, 6, 12],
    count: (rows) => {
      const byTrack = new Map<string, number[]>()
      for (const r of rows) byTrack.set(r.trackId, [...(byTrack.get(r.trackId) ?? []), r.position])
      return [...byTrack.values()].filter((ps) => ps.length >= DOMINATION_RACES && mean(ps) <= DOMINATION_AVG_POS).length
    },
  },
  {
    id: 'podiumEverywhere',
    glyph: 'podium',
    thresholds: (total) => [10, 20, 30, total],
    count: (rows) => new Set(rows.filter((r) => r.position <= 3).map((r) => r.trackId)).size,
  },
  {
    id: 'winEverywhere',
    glyph: 'ring',
    thresholds: (total) => [5, 12, 25, total],
    count: (rows) => new Set(rows.filter((r) => r.position === 1).map((r) => r.trackId)).size,
  },
]

/**
 * Logros de desempeño a partir de las carreras de eventos finalizados (War y Lounge).
 * A diferencia de las insignias de volumen, estos dependen de las posiciones. Función pura.
 */
export function computeAchievements(timeline: TimedResult[], totalTracks: number): Achievement[] {
  const rows = sortTimeline(timeline)
  return DEFS.map((d) => {
    const thresholds = d.thresholds(totalTracks)
    return { id: d.id, glyph: d.glyph, thresholds, ...progressOf(d.count(rows, totalTracks), thresholds) }
  })
}
