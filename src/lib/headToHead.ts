import type { TimedResult } from './form'
import { POINTS } from './scoring'

export type HeadToHead = {
  /** Eventos en los que corrieron los dos (con alguna carrera en común) */
  events: number
  /** En cuántos de esos eventos sumó más puntos cada uno (solo en las carreras que corrieron los dos) */
  aWins: number
  bWins: number
  ties: number
  /** Carreras en común, y en cuántas quedó cada uno por delante */
  races: number
  aAhead: number
  bAhead: number
  /** Puntos por carrera en común de cada uno: dice quién rindió mejor cuando coincidieron */
  aPoints: number
  bPoints: number
}

const pts = (position: number) => POINTS[position - 1] ?? 0

/**
 * Cara a cara: lo que pasó en los eventos en que coincidieron (compañeros o rivales). Solo cuentan las carreras que corrieron
 * los dos, para que un cambio de jugador a mitad de war no falsee la cuenta. null si nunca coincidieron. Función pura.
 */
export function headToHead(a: TimedResult[], b: TimedResult[]): HeadToHead | null {
  const bByRace = new Map(b.map((r) => [`${r.eventId}#${r.raceNo}`, r.position]))
  const perEvent = new Map<string, { a: number; b: number }>()
  let races = 0
  let aAhead = 0
  let bAhead = 0
  let aPoints = 0
  let bPoints = 0
  for (const r of a) {
    const other = bByRace.get(`${r.eventId}#${r.raceNo}`)
    if (other === undefined) continue
    races++
    if (r.position < other) aAhead++
    else if (other < r.position) bAhead++
    aPoints += pts(r.position)
    bPoints += pts(other)
    const e = perEvent.get(r.eventId) ?? { a: 0, b: 0 }
    e.a += pts(r.position)
    e.b += pts(other)
    perEvent.set(r.eventId, e)
  }
  if (races === 0) return null
  const evs = [...perEvent.values()]
  return {
    events: evs.length,
    aWins: evs.filter((e) => e.a > e.b).length,
    bWins: evs.filter((e) => e.b > e.a).length,
    ties: evs.filter((e) => e.a === e.b).length,
    races,
    aAhead,
    bAhead,
    aPoints: Math.round((aPoints / races) * 100) / 100,
    bPoints: Math.round((bPoints / races) * 100) / 100,
  }
}
