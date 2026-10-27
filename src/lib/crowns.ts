import { achievementTotals, computeAchievements } from './achievements.js'
import type { TimedResult } from './form.js'

/**
 * Coronas de la comunidad. Se gana por ser, en un periodo, quien más niveles de logros ha subido: la «pole» del día, la de la semana
 * (desde el lunes) y el trono histórico (quien más niveles tiene en total). Días y semanas, en UTC.
 */
export type CrownPeriod = 'day' | 'week' | 'all'
export const CROWN_PERIODS: CrownPeriod[] = ['day', 'week', 'all']

export type CrownBoard = {
  /** Quien la lleva ahora: el ganador del último periodo con ganador (sigue siéndolo hasta que otro la gane). null si nadie */
  holder: string | null
  /** Veces que cada jugador la ha ganado: días o semanas ganados y, en el trono, veces que ha llegado a lo más alto */
  counts: Record<string, number>
}
export type Crowns = Record<CrownPeriod, CrownBoard>

/** Lo que tiene un jugador de cada corona (para insignias y títulos) */
export type CrownFacts = { dayNow: boolean; weekNow: boolean; allNow: boolean; dayCount: number; weekCount: number; allCount: number }

export function crownFactsOf(crowns: Crowns | null | undefined, profileId: string): CrownFacts {
  const c = crowns
  return {
    dayNow: c?.day.holder === profileId,
    weekNow: c?.week.holder === profileId,
    allNow: c?.all.holder === profileId,
    dayCount: c?.day.counts[profileId] ?? 0,
    weekCount: c?.week.counts[profileId] ?? 0,
    allCount: c?.all.counts[profileId] ?? 0,
  }
}

const DAY_MS = 86_400_000
const dayOf = (iso: string) => iso.slice(0, 10)
/** Lunes de la semana (UTC) de un día `YYYY-MM-DD` */
const mondayOf = (day: string) => {
  const t = Date.parse(`${day}T00:00:00Z`)
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10)
}

/** Quien más ha ganado en un reparto de puntos (todos los empatados); vacío si nadie ha ganado nada */
function leaders(gains: Map<string, number>): string[] {
  const max = Math.max(0, ...gains.values())
  return max > 0 ? [...gains].filter(([, g]) => g === max).map(([id]) => id) : []
}

/**
 * Las coronas a partir de las carreras verificadas de cada jugador (función pura). Quien empata en un periodo se lleva la victoria
 * de ese periodo igualmente; para la corona «de ahora» desempata tener más niveles en total y, después, el id.
 */
export function buildCrowns(players: { id: string; timeline: TimedResult[] }[], totalTracks: number): Crowns {
  const crowns: Crowns = { day: { holder: null, counts: {} }, week: { holder: null, counts: {} }, all: { holder: null, counts: {} } }
  const days = [...new Set(players.flatMap((p) => p.timeline.map((r) => dayOf(r.date))))].sort()
  if (days.length === 0) return crowns

  // Niveles de cada jugador al empezar cada día activo (y al final de todo): de ahí salen las subidas de cada día
  const earnedAt = (rows: TimedResult[]) => achievementTotals(computeAchievements(rows, totalTracks)).earned
  const levels = new Map<string, number[]>()
  for (const p of players) {
    levels.set(
      p.id,
      [...days.map((d) => earnedAt(p.timeline.filter((r) => dayOf(r.date) < d))), earnedAt(p.timeline)],
    )
  }
  const total = (id: string) => levels.get(id)![days.length]
  const bump = (board: CrownBoard, id: string) => (board.counts[id] = (board.counts[id] ?? 0) + 1)
  const pickHolder = (ids: string[]) => [...ids].sort((a, b) => total(b) - total(a) || a.localeCompare(b))[0] ?? null

  let reigning: string | null = null
  const weekGains = new Map<string, Map<string, number>>()
  const dayWinners: string[][] = []
  days.forEach((day, i) => {
    const gains = new Map(players.map((p) => [p.id, levels.get(p.id)![i + 1] - levels.get(p.id)![i]]))
    const winners = leaders(gains)
    dayWinners.push(winners)
    for (const id of winners) bump(crowns.day, id)

    const wk = weekGains.get(mondayOf(day)) ?? new Map<string, number>()
    for (const [id, g] of gains) wk.set(id, (wk.get(id) ?? 0) + g)
    weekGains.set(mondayOf(day), wk)

    // Trono: cambia de manos solo cuando alguien supera de verdad al que reina
    const scores = new Map(players.map((p) => [p.id, levels.get(p.id)![i + 1]]))
    const top = leaders(scores)
    if (top.length > 0 && !(reigning !== null && top.includes(reigning))) {
      reigning = pickHolder(top)
      bump(crowns.all, reigning!)
    }
  })

  const weeks = [...weekGains.keys()].sort()
  for (const w of weeks) for (const id of leaders(weekGains.get(w)!)) bump(crowns.week, id)

  const lastDay = [...dayWinners].reverse().find((w) => w.length > 0)
  crowns.day.holder = lastDay ? pickHolder(lastDay) : null
  const lastWeek = [...weeks].reverse().map((w) => leaders(weekGains.get(w)!)).find((w) => w.length > 0)
  crowns.week.holder = lastWeek ? pickHolder(lastWeek) : null
  crowns.all.holder = reigning
  return crowns
}
