import { progressOf, type Progress, type Tier } from './badges.js'
import { sortTimeline, streakOf, type TimedResult } from './form.js'
import { POINTS } from './scoring.js'
import { RACES_PER_WAR } from './statMath.js'

export type AchievementId =
  | 'perfectEvent'
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
  | 'podiumEverywhere'
  | 'winEverywhere'
  | 'allAchievements'

/** Dibujo de la medalla (ver Medal.tsx) */
export type Glyph = 'crown' | 'podium' | 'flag' | 'chevrons' | 'bars' | 'ring' | 'bolt' | 'star' | 'trophy'

export type Achievement = Progress & {
  id: AchievementId
  glyph: Glyph
  /** Cantidades necesarias para cada nivel (bronce, plata, oro, platino) */
  thresholds: number[]
  /** Logro estrella: se muestra a todo ancho y con un diseño propio */
  epic: boolean
  /** Se consigue una sola vez (sin niveles): al lograrlo es platino y el contador sigue subiendo */
  single: boolean
}

/** Puntos de un evento completo a partir de los cuales cuenta como "gran evento" y como "evento legendario" */
export const BIG_EVENT_POINTS = 120
export const LEGEND_EVENT_POINTS = 150
/** Puntuación máxima de un evento de 12 carreras: ganarlas todas (12 × 15) */
export const PERFECT_EVENT_POINTS = 180
/** Carreras en una pista para considerarla "dominada" y posición media máxima que se exige */
export const DOMINATION_RACES = 10
export const DOMINATION_AVG_POS = 3
/** Una remontada es ganar justo después de acabar en esta posición o peor */
export const REDEMPTION_FROM = 10

const pointsOf = (position: number) => POINTS[position - 1] ?? 0

type Def = { id: AchievementId; glyph: Glyph; epic?: boolean; single?: boolean; thresholds: (totalTracks: number) => number[]; count: (rows: TimedResult[], totalTracks: number) => number }

/** Eventos completos (12 carreras) con las posiciones del jugador en orden */
function fullEvents(rows: TimedResult[]): number[][] {
  const byEvent = new Map<string, TimedResult[]>()
  for (const r of rows) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r])
  return [...byEvent.values()].filter((rs) => rs.length >= RACES_PER_WAR).map((rs) => rs.map((r) => r.position))
}

/**
 * Pistas "dominadas" (dan derecho al título «Dueño de …»): alguna vez, con al menos DOMINATION_RACES carreras en ella, la posición
 * media llegó a DOMINATION_AVG_POS o mejor. Es una marca que se alcanza una vez: bajar la media después no la quita.
 */
export function ownedTracks(rows: TimedResult[]): string[] {
  const state = new Map<string, { n: number; sum: number }>()
  const owned = new Set<string>()
  for (const r of sortTimeline(rows)) {
    const s = state.get(r.trackId) ?? { n: 0, sum: 0 }
    s.n++
    s.sum += r.position
    state.set(r.trackId, s)
    if (s.n >= DOMINATION_RACES && s.sum / s.n <= DOMINATION_AVG_POS) owned.add(r.trackId)
  }
  return [...owned]
}

const countWhere = (rows: TimedResult[], test: (r: TimedResult) => boolean) => rows.filter(test).length

const DEFS: Def[] = [
  {
    id: 'perfectEvent',
    glyph: 'crown',
    epic: true,
    single: true,
    thresholds: () => [1],
    count: (rows) => fullEvents(rows).filter((ps) => ps.reduce((a, p) => a + pointsOf(p), 0) >= PERFECT_EVENT_POINTS).length,
  },
  { id: 'podiums', glyph: 'podium', thresholds: () => [50, 300, 750, 1250, 2000], count: (rows) => countWhere(rows, (r) => r.position <= 3) },
  { id: 'wins', glyph: 'star', thresholds: () => [10, 50, 150, 500], count: (rows) => countWhere(rows, (r) => r.position === 1) },
  { id: 'top6', glyph: 'chevrons', thresholds: () => [50, 250, 750, 1500, 2500], count: (rows) => countWhere(rows, (r) => r.position <= 6) },
  { id: 'winStreak', glyph: 'bolt', thresholds: () => [2, 3, 5, 8], count: (rows) => streakOf(rows, (r) => r.position === 1).best },
  { id: 'top6Streak', glyph: 'bars', thresholds: () => [5, 10, 25, 50], count: (rows) => streakOf(rows, (r) => r.position <= 6).best },
  { id: 'cleanEvent', glyph: 'flag', thresholds: () => [1, 3, 5, 7, 10], count: (rows) => fullEvents(rows).filter((ps) => ps.every((p) => p <= 6)).length },
  {
    id: 'bigEvent',
    glyph: 'flag',
    thresholds: () => [1, 5, 10, 20, 30],
    count: (rows) => fullEvents(rows).filter((ps) => ps.reduce((a, p) => a + pointsOf(p), 0) >= BIG_EVENT_POINTS).length,
  },
  {
    id: 'legendEvent',
    glyph: 'star',
    single: true,
    thresholds: () => [1],
    count: (rows) => fullEvents(rows).filter((ps) => ps.reduce((a, p) => a + pointsOf(p), 0) >= LEGEND_EVENT_POINTS).length,
  },
  {
    id: 'redemption',
    glyph: 'bolt',
    thresholds: () => [3, 10, 30, 60, 100],
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
  const base = DEFS.map((d): Achievement => {
    const thresholds = d.thresholds(totalTracks)
    const count = d.count(rows, totalTracks)
    return {
      id: d.id,
      glyph: d.glyph,
      epic: !!d.epic,
      single: !!d.single,
      thresholds,
      ...(d.single ? singleProgress(count, thresholds[0], singleTierOf(d.id)) : progressOf(count, thresholds)),
    }
  })
  // El logro supremo: tener todos los demás al máximo (los de varios niveles en platino)
  const done = base.filter(isMaxed).length
  return [...base, { id: 'allAchievements', glyph: 'trophy', epic: true, single: true, thresholds: [base.length], ...singleProgress(done, base.length) }]
}

/** Un logro de una sola vez: sin conseguir es 0 y al lograrlo cuenta como platino. El contador sigue subiendo */
function singleProgress(count: number, threshold: number, tier: Tier = 4): Progress {
  return count >= threshold ? { count, tier, next: null } : { count, tier: 0, next: threshold }
}

/** Nivel con el que se enseña un logro de una sola vez: el evento legendario sale directamente en esmeralda; los demás, en platino */
export const singleTierOf = (id: AchievementId): Tier => (id === 'legendEvent' ? 5 : 4)

/** Conseguido del todo: el logro único logrado, o un logro de niveles en platino */
export const isMaxed = (a: Pick<Achievement, 'single' | 'tier' | 'thresholds'>) => (a.single ? a.tier > 0 : a.tier === a.thresholds.length)

/**
 * Totales de los logros (sin contar el supremo): niveles conseguidos de los posibles (los de varios niveles suman hasta 5 y los
 * de una sola vez, 1) y cuántos están al máximo. Siguen subiendo aunque ya haya platino.
 */
export function achievementTotals(achievements: Achievement[]): { earned: number; possible: number; maxed: number; count: number } {
  const regular = achievements.filter((a) => a.id !== 'allAchievements')
  return {
    earned: regular.reduce((n, a) => n + (a.single ? (a.tier > 0 ? 1 : 0) : a.tier), 0),
    possible: regular.reduce((n, a) => n + (a.single ? 1 : a.thresholds.length), 0),
    maxed: regular.filter(isMaxed).length,
    count: regular.length,
  }
}

/**
 * Vista previa para ver cómo quedan los logros al máximo (solo se enseña en pantalla, no se guarda nada): todos en platino,
 * el evento perfecto conseguido y el supremo desbloqueado, con contadores por encima del último nivel.
 */
export function demoAchievements(real: Achievement[]): Achievement[] {
  const regular = real
    .filter((a) => a.id !== 'allAchievements')
    .map((a): Achievement => {
      const last = a.thresholds[a.thresholds.length - 1]
      return { ...a, tier: (a.single ? singleTierOf(a.id) : a.thresholds.length) as Tier, next: null, count: Math.max(a.count, a.single ? 2 : Math.round(last * 1.2)) }
    })
  const grand = real.find((a) => a.id === 'allAchievements')
  return grand ? [...regular, { ...grand, tier: 4 as Tier, next: null, count: regular.length }] : regular
}
