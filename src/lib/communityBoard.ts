import { achievementTotals, computeAchievements, type AchievementId } from './achievements.js'
import type { TimedResult } from './form.js'

/** Periodos de los rankings de logros: todo el tiempo, la semana en curso (desde el lunes) y el día de hoy, ambos en UTC */
export type Period = 'all' | 'week' | 'day'
export const PERIODS: Period[] = ['all', 'week', 'day']

export type BoardKey = AchievementId | 'overall'
export type BoardEntry = { profileId: string; count: number; tier: number }
export type AchievementBoard = Record<Period, Partial<Record<BoardKey, BoardEntry[]>>>

/** Jugadores que salen en cada ranking */
export const BOARD_SIZE = 50

/** Inicio (ISO, UTC) del periodo que contiene `now`; null para todo el tiempo */
export function periodStart(period: Period, now: Date): string | null {
  if (period === 'all') return null
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  // getUTCDay: 0 = domingo; la semana empieza el lunes
  const back = period === 'day' ? 0 : (now.getUTCDay() + 6) % 7
  return new Date(day - back * 86_400_000).toISOString()
}

type PlayerRows = { id: string; timeline: TimedResult[] }

/**
 * Rankings de logros de todos los jugadores (función pura). En el periodo «todo» cuenta el logro entero; en semana y día, lo
 * conseguido solo con las carreras de ese periodo (las rachas y los eventos completos, dentro del periodo). La clasificación
 * general suma niveles: los de siempre o, en semana y día, los que se han subido en el periodo.
 */
export function buildBoard(players: PlayerRows[], totalTracks: number, now: Date, size = BOARD_SIZE): AchievementBoard {
  const board: AchievementBoard = { all: {}, week: {}, day: {} }
  for (const period of PERIODS) {
    const start = periodStart(period, now)
    const lists: Partial<Record<BoardKey, BoardEntry[]>> = {}
    const push = (key: BoardKey, entry: BoardEntry) => (lists[key] ??= []).push(entry)
    for (const p of players) {
      const inside = start ? p.timeline.filter((r) => r.date >= start) : p.timeline
      if (inside.length === 0) continue
      const achievements = computeAchievements(inside, totalTracks)
      for (const a of achievements) {
        if (a.id === 'allAchievements' && period !== 'all') continue
        if (a.count > 0) push(a.id, { profileId: p.id, count: a.count, tier: a.tier })
      }
      // Niveles de hoy menos los que ya tenía antes de empezar el periodo
      const earnedNow = achievementTotals(start ? computeAchievements(p.timeline, totalTracks) : achievements).earned
      const gained = earnedNow - (start ? achievementTotals(computeAchievements(p.timeline.filter((r) => r.date < start), totalTracks)).earned : 0)
      if (gained > 0) push('overall', { profileId: p.id, count: gained, tier: 0 })
    }
    for (const key of Object.keys(lists) as BoardKey[]) {
      lists[key] = lists[key]!.sort((a, b) => b.count - a.count || b.tier - a.tier || a.profileId.localeCompare(b.profileId)).slice(0, size)
    }
    board[period] = lists
  }
  return board
}
