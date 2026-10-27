import { REDEMPTION_FROM } from './achievements.js'
import { sortTimeline, streakOf, type TimedResult } from './form.js'
import { POINTS } from './scoring.js'
import { RACES_PER_WAR } from './statMath.js'

/** Récords del salón de la fama */
export type RecordId = 'bestEvent' | 'winsInEvent' | 'winStreak' | 'top6Streak' | 'redemptions' | 'warWins' | 'cleanEvents'
export const RECORD_IDS: RecordId[] = ['bestEvent', 'winsInEvent', 'winStreak', 'top6Streak', 'redemptions', 'warWins', 'cleanEvents']

export type RecordEntry = { profileId: string; value: number; eventId?: string; date?: string }
export type Records = Record<RecordId, RecordEntry[]>

/** Jugadores que salen en cada récord */
export const RECORD_SIZE = 3

const pointsOf = (position: number) => POINTS[position - 1] ?? 0

/** Carreras de cada evento, de la primera a la última */
function byEvent(rows: TimedResult[]): TimedResult[][] {
  const map = new Map<string, TimedResult[]>()
  for (const r of rows) map.set(r.eventId, [...(map.get(r.eventId) ?? []), r])
  return [...map.values()].map((rs) => [...rs].sort((a, b) => a.raceNo - b.raceNo))
}

/** Mejor valor de un jugador entre sus eventos (el primero que lo alcanza si hay empate) */
function bestOf(events: TimedResult[][], value: (rs: TimedResult[]) => number): Omit<RecordEntry, 'profileId'> | null {
  let best: Omit<RecordEntry, 'profileId'> | null = null
  for (const rs of events) {
    const v = value(rs)
    if (v > 0 && (!best || v > best.value)) best = { value: v, eventId: rs[0].eventId, date: rs[0].date }
  }
  return best
}

/**
 * Los récords de la comunidad a partir de las carreras verificadas de cada jugador (función pura). Cada jugador sale una vez por
 * récord, con su mejor marca; los empates los desempata quien la consiguió antes.
 */
export function buildRecords(players: { id: string; timeline: TimedResult[] }[], size = RECORD_SIZE): Records {
  const lists: Records = { bestEvent: [], winsInEvent: [], winStreak: [], top6Streak: [], redemptions: [], warWins: [], cleanEvents: [] }
  const add = (id: RecordId, profileId: string, entry: Omit<RecordEntry, 'profileId'> | null) => {
    if (entry && entry.value > 0) lists[id].push({ profileId, ...entry })
  }

  for (const p of players) {
    const rows = sortTimeline(p.timeline)
    const events = byEvent(rows)
    const full = events.filter((rs) => rs.length >= RACES_PER_WAR)

    add('bestEvent', p.id, bestOf(full, (rs) => rs.reduce((a, r) => a + pointsOf(r.position), 0)))
    add('winsInEvent', p.id, bestOf(events, (rs) => rs.filter((r) => r.position === 1).length))
    add('winStreak', p.id, { value: streakOf(rows, (r) => r.position === 1).best })
    add('top6Streak', p.id, { value: streakOf(rows, (r) => r.position <= 6).best })
    let redemptions = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].eventId === rows[i].eventId && rows[i].raceNo === rows[i - 1].raceNo + 1 && rows[i - 1].position >= REDEMPTION_FROM && rows[i].position === 1) redemptions++
    }
    add('redemptions', p.id, { value: redemptions })
    add('warWins', p.id, { value: new Set(rows.filter((r) => r.warWon).map((r) => r.eventId)).size })
    add('cleanEvents', p.id, { value: full.filter((rs) => rs.every((r) => r.position <= 6)).length })
  }

  for (const id of RECORD_IDS) {
    lists[id] = lists[id].sort((a, b) => b.value - a.value || (a.date ?? '').localeCompare(b.date ?? '') || a.profileId.localeCompare(b.profileId)).slice(0, size)
  }
  return lists
}
