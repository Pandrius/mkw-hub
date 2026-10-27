import { REDEMPTION_FROM } from './achievements.js'
import { sortTimeline, type TimedResult } from './form.js'
import { POINTS } from './scoring.js'
import { RACES_PER_WAR } from './statMath.js'

/** Récords del salón de la fama */
export type RecordId = 'bestEvent' | 'winsInEvent' | 'winStreak' | 'top6Streak' | 'redemptions' | 'warWins' | 'cleanEvents'
export const RECORD_IDS: RecordId[] = ['bestEvent', 'winsInEvent', 'winStreak', 'top6Streak', 'redemptions', 'warWins', 'cleanEvents']

/** Una marca de un jugador: el valor que alcanzó, cuándo y (si fue en un evento concreto) en cuál */
export type Mark = { value: number; date: string; eventId?: string }
export type RecordEntry = { profileId: string; value: number; date: string; eventId?: string }
/** Clasificación completa de cada récord (todos los jugadores con alguna marca, del mejor al peor) */
export type Records = Record<RecordId, RecordEntry[]>
/** Cada vez que se batió un récord, de la primera marca a la última */
export type RecordHistory = Record<RecordId, RecordEntry[]>

/** Puesto de un jugador en la clasificación de un récord y lo que le falta para el puesto de arriba (null si no tiene marca) */
export function standingIn(list: RecordEntry[], id: string): { rank: number; entry: RecordEntry; gap: number | null } | null {
  const i = list.findIndex((e) => e.profileId === id)
  if (i < 0) return null
  return { rank: i + 1, entry: list[i], gap: i === 0 ? null : list[i - 1].value - list[i].value }
}

const pointsOf = (position: number) => POINTS[position - 1] ?? 0

/** Carreras de cada evento, de la primera a la última, y los eventos por orden de fecha */
function byEvent(rows: TimedResult[]): TimedResult[][] {
  const map = new Map<string, TimedResult[]>()
  for (const r of rows) map.set(r.eventId, [...(map.get(r.eventId) ?? []), r])
  return [...map.values()].map((rs) => [...rs].sort((a, b) => a.raceNo - b.raceNo))
}

/**
 * Las marcas de un jugador en cada récord, de la más antigua a la más reciente: solo se anota una cuando mejora la anterior, así
 * que la última es su mejor valor y su fecha, el día en que lo alcanzó por primera vez.
 */
export function recordMarks(timeline: TimedResult[]): Record<RecordId, Mark[]> {
  const rows = sortTimeline(timeline)
  const events = byEvent(rows)
  const full = events.filter((rs) => rs.length >= RACES_PER_WAR)
  const out: Record<RecordId, Mark[]> = { bestEvent: [], winsInEvent: [], winStreak: [], top6Streak: [], redemptions: [], warWins: [], cleanEvents: [] }

  /** Anota la marca si supera a la última de ese récord */
  const mark = (id: RecordId, value: number, at: TimedResult) => {
    const list = out[id]
    if (value > 0 && value > (list[list.length - 1]?.value ?? 0)) list.push({ value, date: at.date, eventId: at.eventId })
  }
  for (const rs of events) mark('winsInEvent', rs.filter((r) => r.position === 1).length, rs[rs.length - 1])
  let cleanN = 0
  for (const rs of full) {
    mark('bestEvent', rs.reduce((a, r) => a + pointsOf(r.position), 0), rs[rs.length - 1])
    if (rs.every((r) => r.position <= 6)) mark('cleanEvents', ++cleanN, rs[rs.length - 1])
  }

  let wins = 0
  let top6 = 0
  let redemptions = 0
  let warWins = 0
  const warSeen = new Set<string>()
  rows.forEach((r, i) => {
    wins = r.position === 1 ? wins + 1 : 0
    top6 = r.position <= 6 ? top6 + 1 : 0
    mark('winStreak', wins, r)
    mark('top6Streak', top6, r)
    const prev = rows[i - 1]
    if (prev && prev.eventId === r.eventId && r.raceNo === prev.raceNo + 1 && prev.position >= REDEMPTION_FROM && r.position === 1) mark('redemptions', ++redemptions, r)
    if (r.warWon && !warSeen.has(r.eventId)) {
      warSeen.add(r.eventId)
      mark('warWins', ++warWins, r)
    }
  })
  return out
}

/**
 * Los récords de la comunidad a partir de las carreras verificadas de cada jugador (función pura): la clasificación completa de
 * cada uno (cada jugador con su mejor marca; en empate manda quien la logró antes) y la historia de los récords.
 */
export function buildRecords(players: { id: string; timeline: TimedResult[] }[]): { records: Records; history: RecordHistory } {
  const records = Object.fromEntries(RECORD_IDS.map((id) => [id, [] as RecordEntry[]])) as Records
  const history = Object.fromEntries(RECORD_IDS.map((id) => [id, [] as RecordEntry[]])) as RecordHistory
  const all = Object.fromEntries(RECORD_IDS.map((id) => [id, [] as RecordEntry[]])) as Records

  for (const p of players) {
    const marks = recordMarks(p.timeline)
    for (const id of RECORD_IDS) {
      for (const m of marks[id]) all[id].push({ profileId: p.id, ...m })
      const best = marks[id][marks[id].length - 1]
      if (best) records[id].push({ profileId: p.id, ...best })
    }
  }

  for (const id of RECORD_IDS) {
    records[id].sort((a, b) => b.value - a.value || a.date.localeCompare(b.date) || a.profileId.localeCompare(b.profileId))
    // Historia: recorriendo las marcas en el tiempo, solo cuentan las que superan al récord de ese momento
    let top = 0
    for (const m of all[id].sort((a, b) => a.date.localeCompare(b.date) || a.value - b.value || a.profileId.localeCompare(b.profileId))) {
      if (m.value > top) {
        history[id].push(m)
        top = m.value
      }
    }
  }
  return { records, history }
}
